import { randomBytes } from 'node:crypto';
import type { AppState, CheckoutView, CreateWorkshopRequest, NoticeView, PreferenceView, RevisePreferencesRequest } from '../shared/api.js';
import { buildSample } from '../shared/sample.js';
import { addHours, nowIso } from '../shared/time.js';
import type {
  AuditEvent,
  Clarification,
  Consent,
  Offer,
  OfferTerms,
  Participant,
  Payment,
  Preference,
  SettlementBatch,
  Slot,
  Workshop,
} from '../shared/types.js';
import type { AppConfig } from './config.js';
import { buildState, formatMoney, preferenceViews, slotLabelOf } from './format.js';
import type { Repo } from './repo.js';
import { newId, newParticipantToken, sha256Hex, tokenHash } from './repo.js';
import { validateWorkshopDraft } from './domain/validation.js';
import type { ValidatedWorkshop } from './domain/validation.js';
import { computePlan } from './domain/solver.js';
import { CONSENT_TEXT_VERSION, hashOfferTerms, validateOfferTerms } from './domain/offer.js';
import { canTransitionWorkshop } from './domain/state.js';
import { createLlm } from './ai/provider.js';
import { extractPreferences } from './ai/extract.js';
import type { ExtractOutcome } from './ai/extract.js';
import { proposeClarification } from './ai/clarify.js';
import type { LlmClient } from './ai/provider.js';
import { createPaypal } from './payments/paypal.js';
import type { Paypal } from './payments/paypal.js';
import { executeBatch, lockBatch } from './payments/settlement.js';

/* ==========================================================================
   Service — the only place that sequences product state changes.

   Safety decisions:
   - Every money path is deterministic code; the model is only called for
     extraction and for proposing one question.
   - Confirming preferences is the participant's click; publishing the offer is
     the merchant's click; capturing is a separate, server-validated action.
   - Nothing here trusts client-supplied amounts, slots, hashes or offer ids.
   ========================================================================== */

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public fields?: Array<{ field: string; message: string }>,
  ) {
    super(message);
  }
}

export interface SessionContext {
  sessionHash: string;
  tenantId: string;
  synthetic: boolean;
  viewParticipantId: string | null;
}

export interface SettleOutcome {
  batch: SettlementBatch;
  error?: string;
}

export class Service {
  readonly paypal: Paypal;
  readonly llm: LlmClient;

  constructor(
    public readonly cfg: AppConfig,
    public readonly repo: Repo,
    private readonly clock: () => string = nowIso,
  ) {
    this.paypal = createPaypal(cfg);
    this.llm = createLlm(cfg);
  }

  now(): string {
    return this.clock();
  }

  /* ------------------------------ session ------------------------------- */

  /** Create a fresh isolated synthetic tenant for a new browser session. */
  newTenant(now = this.now()): string {
    return this.repo.createTenant(true, now);
  }

  ctxFor(tenantId: string, viewParticipantId: string | null, sessionHash: string): SessionContext {
    const tenant = this.repo.getTenant(tenantId);
    if (!tenant) throw new AppError('TENANT_NOT_FOUND', 'session expired — reload the page', 401);
    return { sessionHash, tenantId, synthetic: tenant.synthetic, viewParticipantId };
  }

  /** Resolve a participant access token; returns the tenant it belongs to. */
  resolveParticipantToken(token: string): Participant | null {
    return this.repo.getParticipantByTokenHash(tokenHash(token));
  }

  /* ---------------------------- state builder --------------------------- */

  state(ctx: SessionContext, extras: { checkout?: CheckoutView | null; notice?: NoticeView | null } = {}): AppState {
    const workshop = this.repo.getLatestWorkshop(ctx.tenantId);
    const slots = workshop ? this.repo.listSlots(workshop.id) : [];
    const participants = workshop ? this.repo.listParticipants(workshop.id) : [];
    const preferences = workshop ? this.repo.listPreferences(workshop.id) : [];
    const clarifications = workshop ? this.repo.listClarifications(workshop.id) : [];
    const offers = workshop ? this.repo.allOffers(workshop.id) : [];
    const openOffer = offers.find((o) => o.status === 'OPEN') ?? null;
    const latestOffer = openOffer ?? offers.slice().sort((a, b) => b.version - a.version)[0] ?? null;
    const consents = latestOffer ? this.repo.listConsents(latestOffer.id) : [];
    const payments = workshop ? this.repo.listPaymentsByWorkshop(workshop.id) : [];
    const batch = latestOffer ? this.repo.getBatchByOffer(latestOffer.id) : null;
    const audit = workshop ? this.repo.listAudit(workshop.id) : [];
    return buildState({
      cfg: this.cfg,
      workshop,
      slots,
      participants,
      preferences,
      clarifications,
      offers,
      consents,
      payments,
      batch,
      audit,
      tenantId: ctx.tenantId,
      synthetic: ctx.synthetic,
      viewParticipantId: ctx.viewParticipantId,
      now: this.now(),
      checkout: extras.checkout ?? this.checkoutFor(ctx, payments, latestOffer),
      notice: extras.notice ?? null,
    });
  }

  private checkoutFor(ctx: SessionContext, payments: Payment[], offer: Offer | null): CheckoutView | null {
    if (!offer || !ctx.viewParticipantId) return null;
    const payment = payments.find((p) => p.participantId === ctx.viewParticipantId && p.offerId === offer.id);
    if (!payment || !payment.orderId || !payment.approveUrl) return null;
    if (!['ORDER_CREATED', 'APPROVED', 'AUTHORIZING'].includes(payment.status)) return null;
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      approveUrl: payment.approveUrl,
      amountLabel: formatMoney(payment.amountCents, payment.currency),
      simulated: payment.simulated,
      simulatedApprovePath: payment.simulated ? `/return?token=${encodeURIComponent(payment.orderId)}` : null,
    };
  }

  /* ------------------------------ audit --------------------------------- */

  audit(
    ctx: SessionContext,
    actorKind: AuditEvent['actorKind'],
    actorRef: string,
    type: string,
    subjectId: string | null,
    payload: Record<string, unknown> = {},
    workshopId: string | null = null,
  ): void {
    this.repo.insertAudit({
      id: newId('aud'),
      tenantId: ctx.tenantId,
      actorKind,
      actorRef,
      workshopId: workshopId ?? this.repo.getLatestWorkshop(ctx.tenantId)?.id ?? null,
      type,
      subjectId,
      payload,
      createdAt: this.now(),
    });
  }

  /* ---------------------------- guards ---------------------------------- */

  private requireWorkshop(ctx: SessionContext): Workshop {
    const w = this.repo.getLatestWorkshop(ctx.tenantId);
    if (!w) throw new AppError('NO_WORKSHOP', 'create a workshop first', 404);
    return w;
  }

  private requireOrganizer(ctx: SessionContext): Workshop {
    if (ctx.viewParticipantId) {
      throw new AppError('ORGANIZER_ONLY', 'only the organizer can do that', 403);
    }
    return this.requireWorkshop(ctx);
  }

  private requireParticipant(ctx: SessionContext, participantId?: string): Participant {
    const id = ctx.viewParticipantId ?? (ctx.synthetic ? participantId ?? null : null);
    if (!id) throw new AppError('PARTICIPANT_REQUIRED', 'open this page as a participant', 403);
    const p = this.repo.getParticipant(id);
    if (!p || p.tenantId !== ctx.tenantId) throw new AppError('PARTICIPANT_NOT_FOUND', 'participant not found', 404);
    return p;
  }

  private participantOfWorkshop(ctx: SessionContext, participantId?: string): Participant {
    return this.requireParticipant(ctx, participantId);
  }

  /* --------------------------- workshop create -------------------------- */

  async createWorkshop(ctx: SessionContext, body: CreateWorkshopRequest): Promise<AppState> {
    if (ctx.viewParticipantId) throw new AppError('ORGANIZER_ONLY', 'only the organizer can create a workshop', 403);
    const existing = this.repo.getLatestWorkshop(ctx.tenantId);
    if (existing) {
      throw new AppError('WORKSHOP_EXISTS', 'this demo tenant already has a workshop — reset the demo first', 409);
    }
    const now = this.now();

    if (body.sample) {
      const sample = buildSample(now, this.cfg.demo.workshopOffsetDays);
      const validated = validateWorkshopDraft(sample.draft, now);
      if (!validated.ok) {
        throw new AppError('SAMPLE_INVALID', 'the synthetic sample failed validation', 500, validated.errors);
      }
      const workshop = this.insertWorkshop(ctx, validated.value, now, '/images/pottery-workshop.jpg');
      const slots = this.repo.listSlots(workshop.id);
      for (const persona of sample.personas) {
        const token = newParticipantToken();
        const participant: Participant = {
          id: newId('par'),
          tenantId: ctx.tenantId,
          workshopId: workshop.id,
          displayName: persona.displayName,
          tokenHash: tokenHash(token),
          persona: persona.key,
          createdAt: now,
        };
        this.repo.insertParticipant(participant);
        const pref: Preference = {
          id: newId('pref'),
          participantId: participant.id,
          version: persona.preference.status === 'CONFIRMED' ? 1 : 0,
          status: persona.preference.status,
          sourceText: persona.sourceText,
          acceptedSlotIds: persona.preference.acceptedSlotIds,
          preferredSlotIds: persona.preference.preferredSlotIds,
          conditionalSlots: persona.preference.conditions,
          uncertainties: [],
          extractionMode: 'seed',
          extractionModel: null,
          confirmedAt: persona.preference.status === 'CONFIRMED' ? now : null,
          createdAt: now,
          updatedAt: now,
        };
        this.repo.insertPreference(pref, ctx.tenantId, workshop.id);
      }
      this.repo.updateWorkshopStatus(workshop.id, 'CLARIFYING', now);
      this.audit(ctx, 'DEMO', 'synthetic-seed', 'sample.loaded', workshop.id, {
        participants: sample.personas.length,
        slots: slots.length,
      });
      return this.state(ctx, {
        notice: {
          kind: 'info',
          message:
            'Sample workshop loaded. Five participants have pre-confirmed preferences; Diego is left for you to run the full flow.',
        },
      });
    }

    if (!body.draft) throw new AppError('DRAFT_REQUIRED', 'workshop details are required', 400);
    const validated = validateWorkshopDraft(body.draft, now);
    if (!validated.ok) {
      throw new AppError('INVALID_WORKSHOP', 'workshop details are not valid', 400, validated.errors);
    }
    const workshop = this.insertWorkshop(ctx, validated.value, now);
    this.audit(ctx, 'ORGANIZER', 'organizer', 'workshop.created', workshop.id, {
      slots: validated.value.slots.length,
      priceCents: validated.value.priceCents,
    });
    return this.state(ctx, { notice: { kind: 'info', message: 'Workshop created.' } });
  }

  private insertWorkshop(
    ctx: SessionContext,
    value: ValidatedWorkshop,
    now: string,
    coverImageUrl: string | null = null,
  ): Workshop {
    const workshop: Workshop = {
      id: newId('wsh'),
      tenantId: ctx.tenantId,
      merchantName: value.merchantName,
      title: value.title,
      description: value.description,
      venue: value.venue,
      timezone: value.timezone,
      durationMinutes: value.durationMinutes,
      priceCents: value.priceCents,
      currency: 'USD',
      inclusions: value.inclusions,
      minParticipants: value.minParticipants,
      capacity: value.capacity,
      authDeadlineUtc: value.authDeadlineUtc,
      cancellationPolicyVersion: 'v1',
      cancellationSummary:
        'If fewer than the minimum number of people authorize this exact plan before the deadline, no one is charged: holds are released and completed charges are refunded in full.',
      failureHandlingSummary:
        'Collection is per person, not atomic. If any authorized payment cannot be collected, the workshop is not confirmed; uncaptured holds are released and captured amounts are refunded.',
      status: 'COLLECTING_INTEREST',
      version: 1,
      coverImageUrl,
      createdAt: now,
      updatedAt: now,
    };
    this.repo.insertWorkshop(workshop);
    for (const slot of value.slots) {
      this.repo.insertSlot({
        id: slot.id,
        workshopId: workshop.id,
        ordinal: slot.ordinal,
        startUtc: slot.startUtc,
        endUtc: slot.endUtc,
        displayTimezone: workshop.timezone,
        dayLabel: slot.dayLabel,
        timeLabel: slot.timeLabel,
      });
    }
    return workshop;
  }

  /** Organizer adds one participant and gets the access link once. */
  addParticipant(ctx: SessionContext, displayName: string): { state: AppState; token: string } {
    const workshop = this.requireOrganizer(ctx);
    const now = this.now();
    const count = this.repo.countParticipants(workshop.id);
    if (count >= 12) throw new AppError('TOO_MANY_PARTICIPANTS', 'the MVP accepts at most 12 intent records', 409);
    const token = newParticipantToken();
    const participant: Participant = {
      id: newId('par'),
      tenantId: ctx.tenantId,
      workshopId: workshop.id,
      displayName: displayName.trim().slice(0, 60) || `Participant ${count + 1}`,
      tokenHash: tokenHash(token),
      persona: null,
      createdAt: now,
    };
    this.repo.insertParticipant(participant);
    this.repo.updateWorkshopStatus(workshop.id, 'CLARIFYING', now);
    this.audit(ctx, 'ORGANIZER', 'organizer', 'participant.added', participant.id, { name: participant.displayName });
    return { state: this.state(ctx), token };
  }

  /* --------------------------- preferences ------------------------------ */

  async parsePreferences(
    ctx: SessionContext,
    input: {
      sourceText: string;
      structured?: {
        acceptedSlotIds: string[];
        preferredSlotIds: string[];
        conditions: Array<{ slotId: string; condition: string }>;
      };
    },
  ): Promise<AppState> {
    const workshop = this.requireWorkshop(ctx);
    const participant = this.participantOfWorkshop(ctx);
    const now = this.now();
    const slots = this.repo.listSlots(workshop.id);
    const existing = this.repo.getPreferenceByParticipant(participant.id);
    const version = (existing?.version ?? 0) + 1;

    let accepted: string[] = [];
    let preferred: string[] = [];
    let conditions: Preference['conditionalSlots'] = [];
    let uncertainties: Preference['uncertainties'] = [];
    let mode: Preference['extractionMode'] = 'structured';
    let model: string | null = null;
    let notice: NoticeView | null = null;

    if (input.structured) {
      const allowed = new Set(slots.map((s) => s.id));
      accepted = input.structured.acceptedSlotIds.filter((id: string) => allowed.has(id));
      preferred = input.structured.preferredSlotIds.filter((id: string) => allowed.has(id));
      conditions = input.structured.conditions
        .filter((c) => allowed.has(c.slotId))
        .map((c) => ({ slotId: c.slotId, condition: c.condition.slice(0, 200), sourceQuote: c.condition.slice(0, 200) }));
      notice = {
        kind: 'info',
        message: 'Structured preferences saved as a draft. Review and confirm them — nothing counts until you confirm.',
      };
    } else {
      const facts = [
        { label: 'Materials', value: workshop.inclusions.join('; ') },
        { label: 'Cancellation', value: workshop.cancellationSummary },
        { label: 'Schedule', value: slots.map((s) => slotLabelOf(slots, s.id)).join(' / ') },
      ];
      const dayStart = addHours(now, -24);
      const callsToday = this.repo.countLlmCallsSince(dayStart);
      let outcome: ExtractOutcome;
      if (callsToday >= this.cfg.llm.maxCallsPerDay) {
        // Bounded spend: never exceed the daily cap, fall back visibly.
        outcome = {
          mode: 'structured' as const,
          model: null,
          attempts: 0,
          note: 'Daily AI call budget reached — use the structured form.',
          result: {
            schema_version: '1' as const,
            source_id: participant.id,
            accepted_slot_ids: [],
            preferred_slot_ids: [],
            conditional_slots: [],
            uncertainties: [
              {
                field: 'condition' as const,
                question: 'Which of the three times could work for you?',
                source_quote: '',
              },
            ],
            requires_confirmation: true as const,
          },
        };
      } else {
        this.repo.recordLlmCall(ctx.tenantId, 'extract', now);
        outcome = await extractPreferences(this.llm, {
          sourceId: participant.id,
          sourceText: input.sourceText,
          slots: slots.map((s) => ({ id: s.id, label: slotLabelOf(slots, s.id) })),
          merchantFacts: facts,
        });
      }
      accepted = outcome.result.accepted_slot_ids.filter((id) => slots.some((s) => s.id === id));
      preferred = outcome.result.preferred_slot_ids.filter((id) => slots.some((s) => s.id === id));
      conditions = outcome.result.conditional_slots
        .filter((c) => slots.some((s) => s.id === c.slot_id))
        .map((c) => ({ slotId: c.slot_id, condition: c.condition, sourceQuote: c.source_quote }));
      uncertainties = outcome.result.uncertainties.map((u) => ({
        field: u.field,
        question: u.question,
        sourceQuote: u.source_quote,
      }));
      mode = outcome.mode;
      model = outcome.model;
      notice =
        outcome.mode === 'live'
          ? { kind: 'info', message: `Live AI read of your message (${outcome.model}). Edit anything that is wrong, then confirm.` }
          : {
              kind: 'warn',
              message: outcome.mode === 'failed' ? 'AI could not extract reliable times. Nothing was accepted automatically. Retry your sentence or pick times directly.' : `No live AI used (${outcome.mode}). The card below comes from ${outcome.mode === 'recorded' ? 'a checked-in recorded sample' : 'the structured form'} — review every line before confirming.`,
            };
    }

    const pref: Preference = {
      id: existing?.id ?? newId('pref'),
      participantId: participant.id,
      version,
      status: 'DRAFT',
      sourceText: input.sourceText.slice(0, 600),
      acceptedSlotIds: accepted,
      preferredSlotIds: preferred,
      conditionalSlots: conditions,
      uncertainties,
      extractionMode: mode,
      extractionModel: model,
      confirmedAt: null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existing) this.repo.updatePreference(pref);
    else this.repo.insertPreference(pref, ctx.tenantId, workshop.id);
    // A new draft invalidates any pending question based on the previous version.
    for (const c of this.repo.listClarifications(workshop.id)) {
      if (c.participantId === participant.id && (c.status === 'PROPOSED' || c.status === 'SENT')) {
        this.repo.updateClarification({ ...c, status: 'CANCELLED' });
      }
    }
    this.audit(ctx, 'PARTICIPANT', participant.displayName, 'preferences.parsed', participant.id, {
      mode,
      attempts: 0,
      accepted: accepted.length,
      conditional: conditions.length,
    });
    return this.state(ctx, { notice });
  }

  /* Extract without persisting. Used when a participant edits a saved
     preference: the confirmed version must stay valid until they explicitly
     confirm the replacement. */
  async previewPreferences(
    ctx: SessionContext,
    input: {
      sourceText: string;
      structured?: {
        acceptedSlotIds: string[];
        preferredSlotIds: string[];
        conditions: Array<{ slotId: string; condition: string }>;
      };
    },
  ): Promise<{ preference: PreferenceView }> {
    const workshop = this.requireWorkshop(ctx);
    const participant = this.participantOfWorkshop(ctx);
    const now = this.now();
    const slots = this.repo.listSlots(workshop.id);
    const existing = this.repo.getPreferenceByParticipant(participant.id);
    const version = (existing?.version ?? 0) + 1;
    const participants = this.repo.listParticipants(workshop.id);
    let accepted: string[] = [];
    let preferred: string[] = [];
    let conditions: Preference['conditionalSlots'] = [];
    let uncertainties: Preference['uncertainties'] = [];
    let mode: Preference['extractionMode'] = 'structured';
    let model: string | null = null;
    if (input.structured) {
      const allowed = new Set(slots.map((slot) => slot.id));
      accepted = input.structured.acceptedSlotIds.filter((id) => allowed.has(id));
      preferred = input.structured.preferredSlotIds.filter((id) => allowed.has(id));
      conditions = input.structured.conditions
        .filter((condition) => allowed.has(condition.slotId))
        .map((condition) => ({
          slotId: condition.slotId,
          condition: condition.condition.slice(0, 200),
          sourceQuote: condition.condition.slice(0, 200),
        }));
    } else {
      const facts = [
        { label: 'Materials', value: workshop.inclusions.join('; ') },
        { label: 'Cancellation', value: workshop.cancellationSummary },
        { label: 'Schedule', value: slots.map((slot) => slotLabelOf(slots, slot.id)).join(' / ') },
      ];
      const callsToday = this.repo.countLlmCallsSince(addHours(now, -24));
      if (callsToday >= this.cfg.llm.maxCallsPerDay) {
        throw new AppError('LLM_BUDGET', 'Daily AI call budget reached — use the structured form.', 429);
      }
      this.repo.recordLlmCall(ctx.tenantId, 'extract', now);
      const outcome = await extractPreferences(this.llm, {
        sourceId: participant.id,
        sourceText: input.sourceText,
        slots: slots.map((slot) => ({ id: slot.id, label: slotLabelOf(slots, slot.id) })),
        merchantFacts: facts,
      });
      accepted = outcome.result.accepted_slot_ids.filter((id) => slots.some((slot) => slot.id === id));
      preferred = outcome.result.preferred_slot_ids.filter((id) => slots.some((slot) => slot.id === id));
      conditions = outcome.result.conditional_slots
        .filter((condition) => slots.some((slot) => slot.id === condition.slot_id))
        .map((condition) => ({
          slotId: condition.slot_id,
          condition: condition.condition,
          sourceQuote: condition.source_quote,
        }));
      uncertainties = outcome.result.uncertainties.map((entry) => ({
        field: entry.field,
        question: entry.question,
        sourceQuote: entry.source_quote,
      }));
      mode = outcome.mode;
      model = outcome.model;
    }
    const draft: Preference = {
      id: existing?.id ?? newId('pref'),
      participantId: participant.id,
      version,
      status: 'DRAFT',
      sourceText: input.sourceText.slice(0, 600),
      acceptedSlotIds: accepted,
      preferredSlotIds: preferred,
      conditionalSlots: conditions,
      uncertainties,
      extractionMode: mode,
      extractionModel: model,
      confirmedAt: null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const view = preferenceViews([draft], participants, slots, participant.id)[0];
    if (!view) throw new AppError('PREVIEW_FAILED', 'could not preview preferences', 500);
    return { preference: view };
  }

  /* Replace a saved preference only on explicit confirmation. The client sends
     the reviewed draft plus the version it started from; quotes are checked
     against the new sentence, so a stale tab cannot overwrite silently. */
  revisePreferences(ctx: SessionContext, body: RevisePreferencesRequest): AppState {
    const workshop = this.requireWorkshop(ctx);
    const participant = this.participantOfWorkshop(ctx);
    const pref = this.repo.getPreferenceByParticipant(participant.id);
    if (!pref) throw new AppError('NO_PREFERENCE', 'write your preferences first', 404);
    if (pref.version !== body.baseVersion) {
      throw new AppError('STALE_PREFERENCE', 'your saved preference changed in another tab — reload and review again', 409);
    }
    const slots = this.repo.listSlots(workshop.id);
    const allowed = new Set(slots.map((slot) => slot.id));
    const accepted = [...new Set(body.acceptedSlotIds)].filter((id) => allowed.has(id));
    const preferred = [...new Set(body.preferredSlotIds)].filter((id) => allowed.has(id) && accepted.includes(id));
    for (const condition of body.conditions) {
      if (!allowed.has(condition.slotId)) throw new AppError('BAD_SLOT', 'a condition references an unknown time', 400);
      if (condition.sourceQuote && !normalize(body.sourceText).includes(normalize(condition.sourceQuote))) {
        throw new AppError('QUOTE_NOT_VERBATIM', 'a condition quote is not from your own message', 400);
      }
    }
    for (const id of accepted) {
      if (body.conditions.some((condition) => condition.slotId === id)) {
        throw new AppError('SLOT_BOTH_ACCEPTED_AND_CONDITIONAL', `time ${id} cannot be both accepted and conditional`, 400);
      }
    }
    const now = this.now();
    const next: Preference = {
      ...pref,
      version: pref.version + 1,
      status: 'CONFIRMED',
      sourceText: body.sourceText.slice(0, 600),
      acceptedSlotIds: accepted,
      preferredSlotIds: preferred,
      conditionalSlots: body.conditions.map((condition) => ({
        slotId: condition.slotId,
        condition: condition.condition.slice(0, 200),
        sourceQuote: condition.sourceQuote.slice(0, 400),
      })),
      uncertainties: body.uncertainties.map((entry) => ({
        field: entry.field as Preference['uncertainties'][number]['field'],
        question: entry.question,
        sourceQuote: entry.sourceQuote,
      })),
      extractionMode: body.extractionMode,
      extractionModel: body.extractionModel,
      confirmedAt: now,
      updatedAt: now,
    };
    this.repo.updatePreference(next);
    this.audit(ctx, 'PARTICIPANT', participant.displayName, 'preferences.revised', participant.id, { version: next.version });
    return this.state(ctx, { notice: { kind: 'info', message: 'Preferences updated and confirmed.' } });
  }

  confirmPreferences(
    ctx: SessionContext,
    body: {
      version: number;
      acceptedSlotIds: string[];
      preferredSlotIds: string[];
      conditions: Array<{ slotId: string; condition: string; sourceQuote: string }>;
      uncertainties: Array<{ field: string; question: string; sourceQuote: string }>;
    },
  ): AppState {
    const workshop = this.requireWorkshop(ctx);
    const participant = this.participantOfWorkshop(ctx);
    const now = this.now();
    const pref = this.repo.getPreferenceByParticipant(participant.id);
    if (!pref) throw new AppError('NO_PREFERENCE', 'write your preferences first', 404);
    if (pref.version !== body.version) {
      throw new AppError('STALE_PREFERENCE', 'your draft changed in another tab — reload and review again', 409);
    }
    const slots = this.repo.listSlots(workshop.id);
    const allowed = new Set(slots.map((s) => s.id));
    const accepted = [...new Set(body.acceptedSlotIds)].filter((id) => allowed.has(id));
    const preferredList = [...new Set(body.preferredSlotIds)].filter((id) => allowed.has(id));
    for (const c of body.conditions) {
      if (!allowed.has(c.slotId)) throw new AppError('BAD_SLOT', 'a condition references an unknown time', 400);
      // Quotes must come from the participant's own sentence (the brief's core rule).
      if (c.sourceQuote && !normalize(pref.sourceText).includes(normalize(c.sourceQuote))) {
        throw new AppError('QUOTE_NOT_VERBATIM', 'a condition quote is not from your own message', 400);
      }
    }
    const acceptedAndConditional = accepted.filter((id) => body.conditions.some((c) => c.slotId === id));
    for (const id of acceptedAndConditional) {
      throw new AppError('SLOT_BOTH_ACCEPTED_AND_CONDITIONAL', `time ${id} cannot be both accepted and conditional`, 400);
    }
    const next: Preference = {
      ...pref,
      version: pref.version + 1,
      status: 'CONFIRMED',
      acceptedSlotIds: accepted,
      preferredSlotIds: preferredList,
      conditionalSlots: body.conditions.map((c) => ({
        slotId: c.slotId,
        condition: c.condition,
        sourceQuote: c.sourceQuote,
      })),
      uncertainties: body.uncertainties.map((u) => ({
        field: u.field as Preference['uncertainties'][number]['field'],
        question: u.question,
        sourceQuote: u.sourceQuote,
      })),
      confirmedAt: now,
      updatedAt: now,
    };
    this.repo.updatePreference(next);
    if (workshop.status === 'COLLECTING_INTEREST' || workshop.status === 'DRAFT') {
      this.repo.updateWorkshopStatus(workshop.id, 'CLARIFYING', now);
    }
    this.audit(ctx, 'PARTICIPANT', participant.displayName, 'preferences.confirmed', participant.id, {
      version: next.version,
      accepted: accepted.length,
      preferred: preferredList.length,
      conditions: next.conditionalSlots.length,
    });
    return this.state(ctx, {
      notice: { kind: 'info', message: 'Preferences confirmed. Only these constraints count toward a plan.' },
    });
  }

  /* ------------------------- clarifications ----------------------------- */

  async proposeClarification(ctx: SessionContext, participantId?: string): Promise<AppState> {
    const workshop = this.requireOrganizer(ctx);
    const now = this.now();
    const slots = this.repo.listSlots(workshop.id);
    const plan = this.computePlan(workshop, slots);
    let targetId = participantId ?? plan.suggestion?.participantId ?? null;
    if (!targetId) {
      throw new AppError('NO_GAP', plan.reason || 'no clarification would change the outcome right now', 409);
    }
    const participant = this.repo.getParticipant(targetId);
    if (!participant || participant.tenantId !== ctx.tenantId) {
      throw new AppError('PARTICIPANT_NOT_FOUND', 'participant not found', 404);
    }
    const existing = this.repo.findUnansweredClarification(participant.id);
    if (existing) return this.state(ctx, { notice: { kind: 'info', message: 'That participant already has an open question.' } });

    const pref = this.repo.getPreferenceByParticipant(participant.id);
    if (!pref || pref.status !== 'CONFIRMED') {
      throw new AppError('PREFERENCE_NOT_CONFIRMED', 'the participant has not confirmed their preferences yet', 409);
    }
    const suggestion = plan.suggestion;
    // Pick the condition (and the slot) that actually closes the gap.
    const condition = pref.conditionalSlots.find((c) => c.slotId === suggestion?.slotId) ?? pref.conditionalSlots[0];
    if (!condition) {
      throw new AppError('NO_CONDITION', 'there is no open condition to clarify for this participant', 409);
    }
    const targetSlotId = suggestion?.slotId ?? condition.slotId;
    const slot = slots.find((s) => s.id === targetSlotId);
    if (!slot) throw new AppError('BAD_SLOT', 'the suggested time no longer exists', 409);

    const fact = pickFact(condition.condition, workshop);
    const slotText = slotLabelOf(slots, targetSlotId);
    this.repo.recordLlmCall(ctx.tenantId, 'clarify', now);
    const proposed = await proposeClarification(this.llm, {
      participantName: participant.displayName,
      condition: condition.condition,
      sourceQuote: condition.sourceQuote,
      slotLabel: slotText,
      factLabel: fact.label,
      factValue: fact.value,
    });
    const clarification: Clarification = {
      id: newId('clr'),
      participantId: participant.id,
      workshopId: workshop.id,
      fromPreferenceVersion: pref.version,
      slotId: targetSlotId,
      conditionText: condition.condition,
      sourceQuote: condition.sourceQuote,
      questionText: proposed.questionText,
      questionSource: proposed.questionSource,
      factLabel: fact.label,
      factValue: fact.value,
      status: 'PROPOSED',
      answer: null,
      sentAt: null,
      answeredAt: null,
      createdAt: now,
    };
    this.repo.insertClarification(clarification, ctx.tenantId);
    this.audit(ctx, 'ORGANIZER', 'organizer', 'clarification.proposed', clarification.id, {
      participant: participant.displayName,
      source: proposed.questionSource,
      gapClosed: suggestion?.gapClosed ?? 0,
    });
    return this.state(ctx, {
      notice: {
        kind: 'info',
        message: `One question prepared for ${participant.displayName}. Review it, then send it in-app.`,
      },
    });
  }

  sendClarification(ctx: SessionContext, id: string): AppState {
    this.requireOrganizer(ctx);
    const c = this.repo.getClarification(id);
    if (!c || c.workshopId !== this.repo.getLatestWorkshop(ctx.tenantId)?.id) {
      throw new AppError('CLARIFICATION_NOT_FOUND', 'clarification not found', 404);
    }
    if (c.status !== 'PROPOSED') throw new AppError('CLARIFICATION_NOT_PROPOSED', 'this question was already handled', 409);
    this.repo.updateClarification({ ...c, status: 'SENT', sentAt: this.now() });
    this.audit(ctx, 'ORGANIZER', 'organizer', 'clarification.sent', c.id, { participantId: c.participantId });
    return this.state(ctx, { notice: { kind: 'info', message: 'Question sent in-app to that participant.' } });
  }

  async answerClarification(ctx: SessionContext, id: string, answer: 'YES' | 'NO'): Promise<AppState> {
    const workshop = this.requireWorkshop(ctx);
    const participant = this.participantOfWorkshop(ctx);
    const now = this.now();
    const c = this.repo.getClarification(id);
    if (!c || c.participantId !== participant.id || c.workshopId !== workshop.id) {
      throw new AppError('CLARIFICATION_NOT_FOUND', 'question not found', 404);
    }
    if (c.status !== 'SENT' && c.status !== 'PROPOSED') {
      throw new AppError('ALREADY_ANSWERED', 'you already answered this question', 409);
    }
    const pref = this.repo.getPreferenceByParticipant(participant.id);
    if (!pref) throw new AppError('NO_PREFERENCE', 'no preferences to update', 409);

    this.repo.updateClarification({
      ...c,
      status: answer === 'YES' ? 'ANSWERED_YES' : 'ANSWERED_NO',
      answer,
      answeredAt: now,
    });

    if (answer === 'YES') {
      const accepted = [...new Set([...pref.acceptedSlotIds, c.slotId])];
      const next: Preference = {
        ...pref,
        version: pref.version + 1,
        acceptedSlotIds: accepted,
        conditionalSlots: pref.conditionalSlots.filter((x) => x.slotId !== c.slotId),
        confirmedAt: now,
        updatedAt: now,
      };
      this.repo.updatePreference(next);
      this.audit(ctx, 'PARTICIPANT', participant.displayName, 'clarification.answered', c.id, {
        answer,
        acceptedAdded: c.slotId,
        version: next.version,
      });
      return this.state(ctx, {
        notice: { kind: 'info', message: 'Thanks — that time now counts for you. Nothing was charged.' },
      });
    }

    // A refusal is respected: keep the preference, bump the version so stale plans cannot apply,
    // and never ask again. No discount, no pressure, no majority override.
    const next: Preference = { ...pref, version: pref.version + 1, updatedAt: now };
    this.repo.updatePreference(next);
    this.audit(ctx, 'PARTICIPANT', participant.displayName, 'clarification.answered', c.id, { answer, version: next.version });
    return this.state(ctx, {
      notice: { kind: 'info', message: 'Understood — your original preference stands and you will not be asked again.' },
    });
  }

  /* ------------------------------ offers -------------------------------- */

  publishOffer(ctx: SessionContext, slotId: string): AppState {
    const workshop = this.requireOrganizer(ctx);
    const now = this.now();
    if (now >= workshop.authDeadlineUtc) {
      throw new AppError('DEADLINE_PASSED', 'the authorization deadline has passed', 409);
    }
    if (workshop.status === 'OFFER_OPEN' || workshop.status === 'SETTLING' || workshop.status === 'CONFIRMED') {
      throw new AppError('OFFER_ALREADY_OPEN', 'an offer is already open — changes need a new round and new consent', 409);
    }
    const slots = this.repo.listSlots(workshop.id);
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) throw new AppError('BAD_SLOT', 'unknown time', 400);
    const plan = this.computePlan(workshop, slots);
    const slotPlan = plan.slots.find((s) => s.slotId === slotId);
    if (!slotPlan || slotPlan.fitParticipantIds.length < workshop.minParticipants) {
      throw new AppError(
        'NOT_ENOUGH_CONFIRMED',
        `this plan has ${slotPlan?.fitParticipantIds.length ?? 0} confirmed participants; the minimum is ${workshop.minParticipants}`,
        409,
      );
    }
    const version = this.repo.nextOfferVersion(workshop.id);
    const terms: OfferTerms = {
      schemaVersion: 1,
      workshopId: workshop.id,
      offerVersion: version,
      merchantName: workshop.merchantName,
      workshopTitle: workshop.title,
      workshopDescription: workshop.description,
      venue: workshop.venue,
      timezone: workshop.timezone,
      slotId: slot.id,
      startUtc: slot.startUtc,
      endUtc: slot.endUtc,
      durationMinutes: workshop.durationMinutes,
      priceCents: workshop.priceCents,
      currency: workshop.currency,
      inclusions: workshop.inclusions,
      minParticipants: workshop.minParticipants,
      capacity: workshop.capacity,
      authDeadlineUtc: workshop.authDeadlineUtc,
      cancellationPolicyVersion: workshop.cancellationPolicyVersion,
      cancellationSummary: workshop.cancellationSummary,
      failureHandlingSummary: workshop.failureHandlingSummary,
    };
    const validated = validateOfferTerms(terms);
    if (!validated.ok) throw new AppError('INVALID_OFFER', 'the offer terms are not valid', 500, validated.errors);
    const offer: Offer = {
      id: newId('off'),
      tenantId: ctx.tenantId,
      workshopId: workshop.id,
      version,
      slotId: slot.id,
      terms,
      offerHash: hashOfferTerms(terms),
      status: 'OPEN',
      confirmedByMerchantAt: now,
      createdAt: now,
      closedAt: null,
    };
    this.repo.insertOffer(offer);
    this.repo.updateWorkshopStatus(workshop.id, 'OFFER_OPEN', now);
    this.audit(ctx, 'ORGANIZER', 'organizer', 'offer.published', offer.id, {
      slotId: slot.id,
      offerVersion: version,
      offerHash: offer.offerHash,
      priceCents: terms.priceCents,
    });
    return this.state(ctx, {
      notice: {
        kind: 'info',
        message: `Offer v${version} published for ${slotLabelOf(slots, slot.id)}. Price, time and terms are now frozen.`,
      },
    });
  }

  /* ----------------------------- checkout ------------------------------- */

  async startCheckout(ctx: SessionContext, body: { participantId?: string; consent?: boolean }): Promise<AppState> {
    const workshop = this.requireWorkshop(ctx);
    const now = this.now();
    const participant = this.participantOfWorkshop(ctx, body.participantId);
    if (body.consent !== true) throw new AppError('CONSENT_REQUIRED', 'tick the consent box before continuing to PayPal', 400);
    const offer = this.repo.getOpenOffer(workshop.id);
    if (!offer) throw new AppError('NO_OFFER', 'the organizer has not published an offer', 404);
    if (now >= offer.terms.authDeadlineUtc) throw new AppError('DEADLINE_PASSED', 'the authorization window has closed', 409);

    const pref = this.repo.getPreferenceByParticipant(participant.id);
    if (!pref || pref.status !== 'CONFIRMED') {
      throw new AppError('PREFERENCE_NOT_CONFIRMED', 'confirm your preferences first', 409);
    }
    if (!pref.acceptedSlotIds.includes(offer.slotId)) {
      throw new AppError('NOT_INCLUDED', 'this offer is for a time you have not accepted', 409);
    }
    const existing = this.repo.getPaymentByParticipantAndOffer(participant.id, offer.id);
    if (existing && ['AUTHORIZED', 'CAPTURING', 'CAPTURED', 'REFUNDING', 'REFUNDED', 'VOIDING', 'VOIDED'].includes(existing.status)) {
      throw new AppError('ALREADY_AUTHORIZED', 'this payment is already authorized or charged', 409);
    }
    if (existing?.orderId && existing.approveUrl) {
      // Idempotent: a double click returns the same PayPal order, never a second one.
      return this.state(ctx);
    }
    const activeCount = this.repo
      .listPaymentsByOffer(offer.id)
      .filter((p) => ['ORDER_CREATED', 'APPROVED', 'AUTHORIZING', 'AUTHORIZED'].includes(p.status)).length;
    if (activeCount >= offer.terms.capacity) {
      throw new AppError('OFFER_FULL', 'this plan already has the maximum number of participants', 409);
    }

    const idempotencyKey = `create-order:${offer.id}:${participant.id}`;
    const paymentId = existing?.id ?? newId('pay');
    let order;
    try {
      order = await this.paypal.createAuthorizeOrder(
        {
          amountCents: offer.terms.priceCents,
          currency: offer.terms.currency,
          description: `${offer.terms.workshopTitle} · ${slotLabelOf(this.repo.listSlots(workshop.id), offer.slotId)}`,
          customId: paymentId,
          invoiceId: `${offer.id}:${participant.id}`,
          returnUrl: `${this.cfg.publicBaseUrl}/return`,
          cancelUrl: `${this.cfg.publicBaseUrl}/cancel`,
        },
        idempotencyKey,
      );
    } catch (err) {
      throw new AppError('PAYPAL_ORDER_FAILED', errorMessage(err), 502);
    }

    const consent: Consent = {
      id: newId('cns'),
      tenantId: ctx.tenantId,
      participantId: participant.id,
      offerId: offer.id,
      offerHash: offer.offerHash,
      amountCents: offer.terms.priceCents,
      currency: offer.terms.currency,
      textVersion: CONSENT_TEXT_VERSION,
      acceptedAt: now,
    };
    this.repo.tx(() => {
      try {
        this.repo.insertConsent(consent);
      } catch {
        // one consent per participant+offer; a retry keeps the first click's time
      }
      if (existing) {
        this.repo.updatePayment(existing.id, {
          status: 'ORDER_CREATED',
          orderId: order.orderId,
          approveUrl: order.approveUrl,
          providerStatus: order.status,
          resourceType: 'order',
          simulated: this.paypal.mode === 'simulated',
          observedAt: now,
          updatedAt: now,
        });
      } else {
        const payment: Payment = {
          id: paymentId,
          tenantId: ctx.tenantId,
          workshopId: workshop.id,
          participantId: participant.id,
          offerId: offer.id,
          offerHash: offer.offerHash,
          status: 'ORDER_CREATED',
          providerStatus: order.status,
          resourceType: 'order',
          orderId: order.orderId,
          authorizationId: null,
          captureId: null,
          refundId: null,
          approveUrl: order.approveUrl,
          amountCents: offer.terms.priceCents,
          currency: offer.terms.currency,
          simulated: this.paypal.mode === 'simulated',
          observedAt: now,
          authorizedAt: null,
          capturedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        this.repo.insertPayment(payment);
      }
      this.repo.insertOperation({
        id: newId('op'),
        tenantId: ctx.tenantId,
        batchId: null,
        paymentId,
        action: 'CREATE_ORDER',
        idempotencyKey,
        requestHash: sha256Hex(`${offer.offerHash}:${participant.id}:${offer.terms.priceCents}`),
        status: 'SUCCEEDED',
        attempts: 1,
        providerRef: order.orderId,
        lastError: null,
        nextCheckAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });
    this.audit(ctx, 'PARTICIPANT', participant.displayName, 'consent.recorded', consent.id, {
      offerId: offer.id,
      offerHash: offer.offerHash,
      amountCents: offer.terms.priceCents,
      textVersion: consent.textVersion,
    });
    this.audit(ctx, 'PARTICIPANT', participant.displayName, 'checkout.order_created', paymentId, {
      orderId: order.orderId,
      simulated: this.paypal.mode === 'simulated',
    });
    return this.state(ctx, {
      notice: {
        kind: 'info',
        message:
          this.paypal.mode === 'simulated'
            ? 'Simulated PayPal order created. No real money. Complete the simulated approval to continue.'
            : 'PayPal order created. Continue to PayPal to approve the authorization.',
      },
    });
  }

  async completeCheckout(ctx: SessionContext, orderId: string): Promise<AppState> {
    const now = this.now();
    const payment = this.repo.getPaymentByOrderId(orderId);
    // Ownership check before anything else: knowing an order id is never permission.
    if (!payment || payment.tenantId !== ctx.tenantId) {
      throw new AppError('ORDER_NOT_FOUND', 'order not found', 404);
    }
    const workshop = this.requireWorkshop(ctx);
    if (ctx.viewParticipantId && payment.participantId !== ctx.viewParticipantId) {
      throw new AppError('ORDER_NOT_FOUND', 'order not found', 404);
    }
    if (['AUTHORIZED', 'CAPTURING', 'CAPTURED', 'REFUNDING', 'REFUNDED', 'VOIDED'].includes(payment.status)) {
      return this.state(ctx, { notice: { kind: 'info', message: 'This payment was already recorded.' } });
    }
    const offer = this.repo.getOffer(payment.offerId);
    if (!offer) throw new AppError('OFFER_NOT_FOUND', 'offer not found', 409);

    let order;
    try {
      order = await this.paypal.getOrder(orderId);
    } catch (err) {
      throw new AppError('PAYPAL_QUERY_FAILED', errorMessage(err), 502);
    }
    this.repo.updatePayment(payment.id, {
      providerStatus: order.status,
      resourceType: 'order',
      observedAt: now,
      updatedAt: now,
    });
    if (order.status === 'CREATED') {
      throw new AppError('NOT_APPROVED', 'PayPal has not recorded the approval yet — finish the PayPal approval first', 409);
    }
    if (order.status !== 'APPROVED' && order.status !== 'COMPLETED') {
      throw new AppError('ORDER_NOT_APPROVABLE', `PayPal order is ${order.status}; nothing was authorized`, 409);
    }

    const expected = offer.terms.priceCents;
    if (order.amountCents !== expected || order.currency !== offer.terms.currency) {
      this.repo.updatePayment(payment.id, { status: 'MANUAL_REVIEW', updatedAt: now });
      throw new AppError('AMOUNT_MISMATCH', 'the PayPal order amount does not match the frozen offer — not authorized', 409);
    }

    let auth;
    try {
      auth = await this.paypal.authorizeOrder(orderId, `authorize:${orderId}`);
    } catch (err) {
      this.repo.updatePayment(payment.id, {
        status: 'UNKNOWN',
        providerStatus: 'AUTHORIZE_ERROR',
        updatedAt: now,
      });
      throw new AppError('AUTHORIZATION_FAILED', errorMessage(err), 502);
    }
    if (auth.amountCents !== expected || auth.currency !== offer.terms.currency) {
      this.repo.updatePayment(payment.id, { status: 'MANUAL_REVIEW', updatedAt: now });
      throw new AppError('AMOUNT_MISMATCH', 'PayPal authorized a different amount — manual review required', 409);
    }
    this.repo.tx(() => {
      this.repo.updatePayment(payment.id, {
        status: auth.status === 'AUTHORIZED' || auth.status === 'CAPTURED' ? 'AUTHORIZED' : 'UNKNOWN',
        authorizationId: auth.authorizationId,
        providerStatus: auth.status,
        resourceType: 'authorization',
        observedAt: now,
        authorizedAt: now,
        updatedAt: now,
      });
      this.repo.insertOperation({
        id: newId('op'),
        tenantId: ctx.tenantId,
        batchId: null,
        paymentId: payment.id,
        action: 'AUTHORIZE',
        idempotencyKey: `authorize:${orderId}`,
        requestHash: sha256Hex(`${orderId}:${expected}`),
        status: auth.status === 'AUTHORIZED' || auth.status === 'CAPTURED' ? 'SUCCEEDED' : 'UNKNOWN',
        attempts: 1,
        providerRef: auth.authorizationId,
        lastError: null,
        nextCheckAt: null,
        createdAt: now,
        updatedAt: now,
      });
      this.repo.insertAudit({
        id: newId('aud'),
        tenantId: ctx.tenantId,
        actorKind: 'SYSTEM',
        actorRef: 'paypal-adapter',
        workshopId: workshop.id,
        type: 'checkout.authorized',
        subjectId: payment.id,
        payload: {
          authorizationId: auth.authorizationId,
          amountCents: expected,
          simulated: this.paypal.mode === 'simulated',
        },
        createdAt: now,
      });
    });
    return this.state(ctx, {
      notice: {
        kind: 'info',
        message:
          this.paypal.mode === 'simulated'
            ? 'Simulated authorization recorded. No money has moved; a capture only happens when the organizer collects.'
            : 'Authorization recorded. This is a temporary hold, not a charge.',
      },
    });
  }

  /* ------------------------------ withdraw ------------------------------ */

  async withdraw(ctx: SessionContext, participantId?: string): Promise<AppState> {
    const workshop = this.requireWorkshop(ctx);
    const now = this.now();
    const participant = this.participantOfWorkshop(ctx, participantId);
    const offer = this.repo.getOpenOffer(workshop.id);
    const batch = offer ? this.repo.getBatchByOffer(offer.id) : null;
    if (batch && ['LOCKED', 'CAPTURING', 'COMPENSATING'].includes(batch.status)) {
      throw new AppError('SETTLEMENT_IN_PROGRESS', 'collection is in progress; withdrawal is not accepted right now', 409);
    }
    if (batch && batch.status === 'CONFIRMED') {
      throw new AppError('ALREADY_CONFIRMED', 'the workshop is confirmed — the merchant cancellation policy applies', 409);
    }
    const pref = this.repo.getPreferenceByParticipant(participant.id);
    if (!pref || pref.status === 'WITHDRAWN') {
      throw new AppError('NOTHING_TO_WITHDRAW', 'there is nothing to withdraw', 409);
    }
    this.repo.updatePreference({ ...pref, status: 'WITHDRAWN', version: pref.version + 1, updatedAt: now });

    const payment = offer ? this.repo.getPaymentByParticipantAndOffer(participant.id, offer.id) : null;
    if (payment && payment.status === 'AUTHORIZED' && payment.authorizationId) {
      const key = `void:${payment.authorizationId}`;
      this.repo.updatePayment(payment.id, { status: 'VOIDING', updatedAt: now });
      try {
        const result = await this.paypal.voidAuthorization(payment.authorizationId, key);
        this.repo.tx(() => {
          this.repo.updatePayment(payment.id, {
            status: result.status === 'VOIDED' || result.status === 'CAPTURED' ? (result.status === 'VOIDED' ? 'VOIDED' : 'CAPTURED') : 'UNKNOWN',
            providerStatus: result.status,
            observedAt: this.now(),
            updatedAt: this.now(),
          });
          this.repo.insertOperation({
            id: newId('op'),
            tenantId: ctx.tenantId,
            batchId: null,
            paymentId: payment.id,
            action: 'VOID',
            idempotencyKey: key,
            requestHash: sha256Hex(payment.authorizationId ?? ''),
            status: result.status === 'VOIDED' ? 'SUCCEEDED' : 'UNKNOWN',
            attempts: 1,
            providerRef: payment.authorizationId,
            lastError: null,
            nextCheckAt: null,
            createdAt: this.now(),
            updatedAt: this.now(),
          });
        });
      } catch (err) {
        this.repo.updatePayment(payment.id, { status: 'UNKNOWN', updatedAt: this.now() });
        this.audit(ctx, 'PARTICIPANT', participant.displayName, 'participant.withdrawn', payment.id, {
          voidFailed: errorMessage(err),
        });
        return this.state(ctx, {
          notice: {
            kind: 'warn',
            message: 'You withdrew, but releasing the hold did not complete. It will be reconciled; nothing has been charged.',
          },
        });
      }
    }
    this.audit(ctx, 'PARTICIPANT', participant.displayName, 'participant.withdrawn', participant.id, {
      paymentStatus: payment?.status ?? 'NONE',
    });
    return this.state(ctx, {
      notice: { kind: 'info', message: 'You withdrew. Your preference no longer counts and any hold is released.' },
    });
  }

  /* ------------------------------- settle ------------------------------- */

  async settle(ctx: SessionContext): Promise<AppState> {
    const workshop = this.requireOrganizer(ctx);
    const now = this.now();
    const offer = this.repo.getOpenOffer(workshop.id);
    if (!offer) throw new AppError('NO_OFFER', 'publish an offer before collecting', 409);
    const locked = await lockBatch(
      { repo: this.repo, paypal: this.paypal, now: () => this.now() },
      workshop.id,
    );
    if (!locked.ok) throw new AppError(locked.code, locked.message, 409);
    if (workshop.status === 'OFFER_OPEN') this.repo.updateWorkshopStatus(workshop.id, 'SETTLING', now);
    const result = await executeBatch({ repo: this.repo, paypal: this.paypal, now: () => this.now() }, locked.batch.id);
    const finalBatch = this.repo.getBatch(locked.batch.id);
    if (finalBatch?.status === 'CONFIRMED') {
      this.audit(ctx, 'SYSTEM', 'settlement', 'batch.confirmed', finalBatch.id, {
        capturedCents: finalBatch.capturedCents,
      });
      return this.state(ctx, {
        notice: { kind: 'info', message: 'All charges were captured and the workshop is confirmed.' },
      });
    }
    this.audit(ctx, 'SYSTEM', 'settlement', 'batch.cancelled', finalBatch?.id ?? '', {
      status: finalBatch?.status,
      reason: result.error ?? finalBatch?.reason ?? null,
    });
    return this.state(ctx, {
      notice: {
        kind: 'warn',
        message:
          result.error ??
          'Collection did not complete. The workshop is not confirmed; holds and charges are being released and refunded.',
      },
    });
  }

  /* ------------------------------- helpers ------------------------------ */

  computePlan(workshop: Workshop, slots: Slot[]) {
    const preferences = this.repo.listPreferences(workshop.id);
    const participants = this.repo.listParticipants(workshop.id);
    const clarifications = this.repo.listClarifications(workshop.id);
    return computePlan({
      minimum: workshop.minParticipants,
      capacity: workshop.capacity,
      slots: slots
        .slice()
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((s) => ({ id: s.id, ordinal: s.ordinal, label: slotLabelOf(slots, s.id) })),
      preferences: preferences.map((p) => ({
        participantId: p.participantId,
        displayName: participants.find((x) => x.id === p.participantId)?.displayName ?? 'Participant',
        version: p.version,
        status: p.status,
        acceptedSlotIds: p.acceptedSlotIds,
        preferredSlotIds: p.preferredSlotIds,
        conditionalSlots: p.conditionalSlots,
      })),
      clarifications: clarifications.map((c) => ({
        id: c.id,
        participantId: c.participantId,
        slotId: c.slotId,
        status: c.status,
        answer: c.answer,
      })),
    });
  }
}

/* ------------------------------ utilities -------------------------------- */

function normalize(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function pickFact(condition: string, workshop: Workshop): { label: string; value: string } {
  const c = condition.toLowerCase();
  if (/material|clay|tool|apron|firing|glaz|include/.test(c)) {
    return { label: 'Materials', value: `All materials are included: ${workshop.inclusions.join('; ')}.` };
  }
  if (/cancel|refund|policy/.test(c)) {
    return { label: 'Cancellation', value: workshop.cancellationSummary };
  }
  return { label: 'Schedule', value: `Each session runs ${workshop.durationMinutes} minutes at the studio in ${workshop.venue}.` };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function randomSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sessionHashOf(token: string): string {
  return sha256Hex(`gatherready.session:${token}`);
}
