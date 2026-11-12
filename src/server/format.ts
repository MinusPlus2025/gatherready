import type {
  AppState,
  AuditView,
  BatchLineView,
  BatchView,
  CheckoutView,
  ClarificationView,
  ConditionView,
  ModeView,
  NoticeView,
  OfferView,
  ParticipantView,
  PaymentView,
  PlanView,
  PreferenceView,
  ResultView,
  SlotPlanView,
  SlotView,
  WorkshopView,
  ConsentCopyView,
} from '../shared/api.js';
import type {
  AuditEvent,
  Clarification,
  Consent,
  Offer,
  Participant,
  Payment,
  PlanResult,
  Preference,
  SettlementBatch,
  Slot,
  Workshop,
} from '../shared/types.js';
import { formatInstantLabel, formatRangeLabel, formatTimeRange, formatDayLabel } from '../shared/time.js';
import { CONSENT_CHECKBOX_LABEL, CONSENT_TEXT_VERSION, consentText, offerTermsRows } from './domain/offer.js';
import { computePlan } from './domain/solver.js';
import type { AppConfig } from './config.js';

/* ==========================================================================
   View formatting — the one place that decides what each role may see.

   Safety decisions:
   - A participant only ever sees their own preference, clarification and
     payment. The organizer sees constraints and counts, never the participant's
     private source sentence (except the condition text needed to review a
     question).
   - Every instant is rendered in the workshop timezone by src/shared/time.ts.
   - Simulated vs sandbox is never inferred by the UI; the server states it.
   ========================================================================== */

export function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export function buildMode(cfg: AppConfig): ModeView {
  const paypal: ModeView['paypal'] = cfg.paypal.live ? 'sandbox' : 'simulated';
  const ai: ModeView['ai'] =
    cfg.llm.provider === 'none' ? 'structured' : 'live';
  const parts: string[] = [];
  if (paypal === 'simulated') {
    parts.push('Simulated PayPal — no real money. Sandbox keys are not configured.');
  } else {
    parts.push('PayPal sandbox · No real money.');
  }
  if (ai === 'live') {
    parts.push(`Live AI · ${cfg.llm.model}`);
  } else {
    parts.push('AI offline — preferences use the structured form and checked-in recorded samples.');
  }
  return {
    paypal,
    ai,
    paypalClientId: paypal === 'sandbox' ? cfg.paypal.jsClientId : null,
    llmProvider: cfg.llm.provider === 'none' ? null : cfg.llm.provider,
    llmModel: cfg.llm.provider === 'none' ? null : cfg.llm.model,
    banner: parts.join(' '),
  };
}

export function workshopView(w: Workshop, slots: Slot[]): WorkshopView {
  const slotViews: SlotView[] = slots
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((s) => ({
      id: s.id,
      ordinal: s.ordinal,
      startUtc: s.startUtc,
      endUtc: s.endUtc,
      timezone: s.displayTimezone,
      dayLabel: formatDayLabel(s.startUtc, s.displayTimezone),
      timeLabel: formatTimeRange(s.startUtc, s.endUtc, s.displayTimezone),
      rangeLabel: formatRangeLabel(s.startUtc, s.endUtc, s.displayTimezone),
    }));
  return {
    id: w.id,
    merchantName: w.merchantName,
    title: w.title,
    description: w.description,
    venue: w.venue,
    timezone: w.timezone,
    durationMinutes: w.durationMinutes,
    priceCents: w.priceCents,
    priceLabel: formatMoney(w.priceCents, w.currency),
    currency: w.currency,
    inclusions: w.inclusions,
    minParticipants: w.minParticipants,
    capacity: w.capacity,
    authDeadlineUtc: w.authDeadlineUtc,
    authDeadlineLabel: formatInstantLabel(w.authDeadlineUtc, w.timezone),
    cancellationPolicyVersion: w.cancellationPolicyVersion,
    cancellationSummary: w.cancellationSummary,
    failureHandlingSummary: w.failureHandlingSummary,
    status: w.status,
    slots: slotViews,
  };
}

export function slotLabelOf(slots: Slot[], slotId: string): string {
  const s = slots.find((x) => x.id === slotId);
  if (!s) return slotId;
  return `${formatDayLabel(s.startUtc, s.displayTimezone)} · ${formatTimeRange(s.startUtc, s.endUtc, s.displayTimezone)}`;
}

export function participantViews(
  participants: Participant[],
  preferences: Preference[],
  payments: Payment[],
  viewParticipantId: string | null,
  synthetic: boolean,
): ParticipantView[] {
  return participants.map((p) => {
    const pref = preferences.find((x) => x.participantId === p.id);
    const pay = payments.find((x) => x.participantId === p.id);
    return {
      id: p.id,
      displayName: p.displayName,
      persona: synthetic ? p.persona : null,
      preferenceStatus: pref?.status ?? 'DRAFT',
      paymentStatus: pay?.status ?? 'NONE',
      isMe: viewParticipantId === p.id,
      demo: synthetic,
    };
  });
}

export function preferenceViews(
  preferences: Preference[],
  participants: Participant[],
  slots: Slot[],
  viewerId: string | null,
): PreferenceView[] {
  return preferences.map((pref) => {
    const person = participants.find((p) => p.id === pref.participantId);
    const isMe = viewerId === pref.participantId;
    return {
      participantId: pref.participantId,
      displayName: person?.displayName ?? 'Participant',
      version: pref.version,
      status: pref.status,
      acceptedSlotIds: pref.acceptedSlotIds,
      acceptedSlotLabels: pref.acceptedSlotIds.map((id) => slotLabelOf(slots, id)),
      preferredSlotIds: pref.preferredSlotIds,
      preferredSlotLabels: pref.preferredSlotIds.map((id) => slotLabelOf(slots, id)),
      conditions: pref.conditionalSlots.map<ConditionView>((c) => ({
        slotId: c.slotId,
        slotLabel: slotLabelOf(slots, c.slotId),
        condition: c.condition,
        sourceQuote: c.sourceQuote,
      })),
      uncertainties: pref.uncertainties,
      extractionMode: pref.extractionMode,
      extractionModel: pref.extractionModel,
      sourceText: isMe ? pref.sourceText : null,
      confirmedAt: isMe ? pref.confirmedAt : null,
    };
  });
}

export function planView(
  plan: PlanResult,
  slots: Slot[],
  participants: Participant[],
  payments: Payment[],
  preferences: Preference[],
  viewerId: string | null = null,
): PlanView {
  const nameOf = (id: string): string => {
    if (viewerId && id !== viewerId) return 'Another participant';
    return participants.find((p) => p.id === id)?.displayName ?? 'Participant';
  };
  const slotViews: SlotPlanView[] = plan.slots.map((s) => ({
    slotId: s.slotId,
    ordinal: (slots.find((x) => x.id === s.slotId)?.ordinal ?? 1) as 1 | 2 | 3,
    label: slotLabelOf(slots, s.slotId),
    fits: s.fitParticipantIds.length,
    fitNames: s.fitParticipantIds.map(nameOf),
    conditionalCount: s.conditionalParticipantIds.length,
    conditionalNames: s.conditionalParticipantIds.map(nameOf),
    reachableMax: s.reachableMax,
    meetsMinimum: s.meetsMinimum,
    preferredSatisfiedCount: s.preferredSatisfiedCount,
  }));
  const counts = {
    interested: participants.length,
    confirmedPreferences: preferences.filter((p) => p.status === 'CONFIRMED').length,
    fitsThisPlan: plan.workableSlotId
      ? slotViews.find((s) => s.slotId === plan.workableSlotId)?.fits ?? 0
      : 0,
    authorized: payments.filter((p) => p.status === 'AUTHORIZED').length,
    captured: payments.filter((p) => p.status === 'CAPTURED').length,
  };
  const suggestion = plan.suggestion
    ? {
        participantId: plan.suggestion.participantId,
        participantName: nameOf(plan.suggestion.participantId),
        clarificationId: plan.suggestion.clarificationId,
        slotId: plan.suggestion.slotId,
        slotLabel: slotLabelOf(slots, plan.suggestion.slotId),
        conditionText: plan.suggestion.conditionText,
        questionText: plan.suggestion.questionText,
        factLabel: plan.suggestion.factLabel,
        factValue: plan.suggestion.factValue,
        gapClosed: plan.suggestion.gapClosed,
        sourceQuote: plan.suggestion.sourceQuote,
      }
    : null;
  return {
    slots: slotViews,
    minimum: plan.minimum,
    capacity: plan.capacity,
    workableSlotId: plan.workableSlotId,
    suggestion,
    reason: plan.reason,
    planInputsHash: plan.planInputsHash,
    counts,
  };
}

export function clarificationViews(
  clarifications: Clarification[],
  participants: Participant[],
  slots: Slot[],
  viewerId: string | null,
): ClarificationView[] {
  return clarifications
    .filter((c) => viewerId === null || c.participantId === viewerId)
    .map((c) => ({
      id: c.id,
      participantId: c.participantId,
      participantName: participants.find((p) => p.id === c.participantId)?.displayName ?? 'Participant',
      slotId: c.slotId,
      slotLabel: slotLabelOf(slots, c.slotId),
      questionText: c.questionText,
      questionSource: c.questionSource,
      factLabel: c.factLabel,
      factValue: c.factValue,
      conditionText: c.conditionText,
      sourceQuote: c.sourceQuote,
      status: c.status,
      answer: c.answer,
      sentAt: c.sentAt,
      answeredAt: c.answeredAt,
      isMine: viewerId === c.participantId,
    }));
}

export function consentCopy(): ConsentCopyView {
  return {
    textVersion: CONSENT_TEXT_VERSION,
    text: consentText(),
    checkboxLabel: CONSENT_CHECKBOX_LABEL,
  };
}

export function offerView(
  offer: Offer,
  workshop: Workshop,
  viewerPreference: Preference | null,
  viewerConsent: Consent | null,
): OfferView {
  const terms = offer.terms;
  return {
    id: offer.id,
    version: offer.version,
    offerHash: offer.offerHash,
    shortHash: offer.offerHash.slice(0, 12),
    status: offer.status,
    slotId: offer.slotId,
    slotLabel: `${formatDayLabel(terms.startUtc, terms.timezone)} · ${formatTimeRange(terms.startUtc, terms.endUtc, terms.timezone)}`,
    terms,
    termsRows: offerTermsRows(terms),
    consent: consentCopy(),
    viewerIncluded: Boolean(viewerPreference && viewerPreference.acceptedSlotIds.includes(offer.slotId)),
    viewerConsented: Boolean(viewerConsent),
    authDeadlineLabel: formatInstantLabel(workshop.authDeadlineUtc, workshop.timezone),
    isOpen: offer.status === 'OPEN',
  };
}

const PAYMENT_LABELS: Record<Payment['status'], string> = {
  NONE: 'Not started',
  ORDER_CREATED: 'Awaiting approval',
  APPROVED: 'Approved with PayPal',
  AUTHORIZING: 'Authorizing',
  AUTHORIZED: 'Authorized — not charged',
  CAPTURING: 'Collecting',
  CAPTURED: 'Charged',
  VOIDING: 'Releasing hold',
  VOIDED: 'Hold released',
  REFUNDING: 'Refunding',
  REFUNDED: 'Refunded',
  FAILED: 'Failed — needs attention',
  UNKNOWN: 'Checking with PayPal',
  MANUAL_REVIEW: 'Needs manual review',
};

export function paymentStatusLabel(status: Payment['status']): string {
  return PAYMENT_LABELS[status] ?? status;
}

export function paymentView(p: Payment, name: string, viewerId: string | null): PaymentView {
  return {
    id: p.id,
    participantId: p.participantId,
    participantName: name,
    status: p.status,
    statusLabel: paymentStatusLabel(p.status),
    providerStatus: p.providerStatus,
    amountCents: p.amountCents,
    amountLabel: formatMoney(p.amountCents, p.currency),
    orderId: p.orderId,
    authorizationId: p.authorizationId,
    captureId: p.captureId,
    refundId: p.refundId,
    approveUrl: p.approveUrl,
    simulated: p.simulated,
    isMine: viewerId === p.participantId,
    updatedAt: p.updatedAt,
  };
}

export function batchLineView(p: Payment, name: string): BatchLineView {
  return {
    participantId: p.participantId,
    participantName: name,
    amountCents: p.amountCents,
    amountLabel: formatMoney(p.amountCents, p.currency),
    status: p.status,
    statusLabel: paymentStatusLabel(p.status),
    captureId: p.captureId,
    refundId: p.refundId,
    detail: p.simulated ? 'Simulated PayPal — no real money' : 'PayPal sandbox',
  };
}

export function batchView(
  batch: SettlementBatch,
  payments: Payment[],
  participants: Participant[],
  timezone: string,
): BatchView {
  const lines = batch.paymentIds
    .map((id) => payments.find((p) => p.id === id))
    .filter((p): p is Payment => Boolean(p))
    .map((p) => batchLineView(p, participants.find((x) => x.id === p.participantId)?.displayName ?? 'Participant'));
  return {
    id: batch.id,
    status: batch.status,
    expectedParticipantCount: batch.expectedParticipantCount,
    expectedCents: batch.expectedCents,
    capturedCents: batch.capturedCents,
    refundedCents: batch.refundedCents,
    expectedLabel: formatMoney(batch.expectedCents),
    capturedLabel: formatMoney(batch.capturedCents),
    refundedLabel: formatMoney(batch.refundedCents),
    deadlineUtc: batch.deadlineUtc,
    deadlineLabel: formatInstantLabel(batch.deadlineUtc, timezone),
    reason: batch.reason,
    lines,
  };
}

export function resultView(
  workshop: Workshop,
  batch: SettlementBatch | null,
  payments: Payment[],
  participants: Participant[],
  viewerId: string | null = null,
): ResultView | null {
  if (!batch) return null;
  const lines = batch.paymentIds
    .map((id) => payments.find((p) => p.id === id))
    .filter((p): p is Payment => Boolean(p))
    .filter((p) => !viewerId || p.participantId === viewerId)
    .map((p) => batchLineView(p, participants.find((x) => x.id === p.participantId)?.displayName ?? 'Participant'));
  const pendingActionCount = payments.filter((p) =>
    ['REFUNDING', 'VOIDING', 'UNKNOWN', 'MANUAL_REVIEW', 'FAILED'].includes(p.status),
  ).length;

  let outcome: ResultView['outcome'];
  let headline: string;
  let detail: string;
  if (workshop.status === 'CONFIRMED' || batch.status === 'CONFIRMED') {
    outcome = 'CONFIRMED';
    headline = 'Workshop confirmed';
    detail = `${lines.length} participants were charged ${formatMoney(batch.capturedCents)} in total. Each charge was confirmed with PayPal individually.`;
  } else if (batch.status === 'COMPENSATING' || batch.status === 'MANUAL_REVIEW') {
    outcome = 'NEEDS_ATTENTION';
    headline = 'Workshop not confirmed — compensation in progress';
    detail =
      'Some charges could not be collected. Releasing holds and refunding completed charges is in progress; the list below is the source of truth. A refund is only marked complete when PayPal reports it complete.';
  } else if (batch.status === 'CANCELLED' || workshop.status === 'CANCELLED' || workshop.status === 'CANCELLING') {
    outcome = 'NOT_CONFIRMED';
    headline = 'Workshop not confirmed';
    detail =
      'Not enough participants authorized this exact plan before the deadline, so no one was charged. Any temporary holds are released and any completed charge is refunded.';
  } else {
    outcome = 'PENDING';
    headline = 'Collecting authorizations';
    detail = 'The workshop is confirmed only after every authorized payment is captured and the minimum is met.';
  }
  return {
    outcome,
    headline,
    detail,
    lines,
    capturedLabel: formatMoney(batch.capturedCents),
    refundedLabel: formatMoney(batch.refundedCents),
    pendingActionCount,
  };
}

const AUDIT_SUMMARY: Record<string, string> = {
  'workshop.created': 'Workshop created',
  'sample.loaded': 'Synthetic demo workshop loaded',
  'preferences.parsed': 'Preference analyzed and drafted',
  'preferences.confirmed': 'Participant confirmed their preferences',
  'clarification.proposed': 'Clarification question proposed',
  'clarification.sent': 'Clarification question sent in-app',
  'clarification.answered': 'Participant answered the clarification',
  'offer.published': 'Fixed offer published',
  'consent.recorded': 'Participant consented to the exact offer',
  'checkout.order_created': 'PayPal order created',
  'checkout.authorized': 'PayPal authorization recorded',
  'participant.withdrawn': 'Participant withdrew and requested a hold release',
  'batch.locked': 'Settlement batch locked',
  'batch.captured': 'Charges captured',
  'batch.confirmed': 'Workshop confirmed',
  'batch.compensating': 'Collection failed — compensation started',
  'batch.cancelled': 'Workshop cancelled',
  'webhook.received': 'PayPal webhook processed',
};

function factFromCondition(condition: string, workshop: Workshop): { label: string; value: string } {
  const c = condition.toLowerCase();
  if (/material|clay|tool|apron|firing|glaz|include/.test(c)) {
    return { label: 'Materials', value: `All materials are included: ${workshop.inclusions.join('; ')}.` };
  }
  if (/cancel|refund|policy/.test(c)) {
    return { label: 'Cancellation', value: workshop.cancellationSummary };
  }
  return {
    label: 'Schedule',
    value: `Each session runs ${workshop.durationMinutes} minutes at the studio in ${workshop.venue}.`,
  };
}

export function auditViews(events: AuditEvent[], timezone: string): AuditView[] {
  return events.map((e) => ({
    id: e.id,
    actorKind: e.actorKind,
    actorRef: e.actorRef,
    type: e.type,
    subjectId: e.subjectId,
    summary: AUDIT_SUMMARY[e.type] ?? e.type,
    createdAt: e.createdAt,
    createdAtLabel: formatInstantLabel(e.createdAt, timezone),
  }));
}

export interface StateInputs {
  cfg: AppConfig;
  workshop: Workshop | null;
  slots: Slot[];
  participants: Participant[];
  preferences: Preference[];
  clarifications: Clarification[];
  offers: Offer[];
  consents: Consent[];
  payments: Payment[];
  batch: SettlementBatch | null;
  audit: AuditEvent[];
  tenantId: string;
  synthetic: boolean;
  viewParticipantId: string | null;
  now: string;
  checkout: CheckoutView | null;
  notice: NoticeView | null;
}

/** Builds the whole AppState. The plan is always recomputed from confirmed data. */
export function buildState(inputs: StateInputs): AppState {
  const {
    cfg,
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
    tenantId,
    synthetic,
    viewParticipantId,
    now,
    checkout,
    notice,
  } = inputs;

  const openOffer = offers.find((o) => o.status === 'OPEN') ?? null;
  const latestOffer = openOffer ?? offers.slice().sort((a, b) => b.version - a.version)[0] ?? null;

  let plan: PlanResult | null = null;
  if (workshop && preferences.length > 0) {
    plan = computePlan({
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

  // The deterministic solver may not own merchant facts; hydrate the single
  // suggestion with the confirmed fact it depends on, so the organizer can see
  // exactly what would be asked before anything is created or sent.
  if (plan?.suggestion && workshop) {
    const fact = factFromCondition(plan.suggestion.conditionText ?? '', workshop);
    plan.suggestion.factLabel = plan.suggestion.factLabel || fact.label;
    plan.suggestion.factValue = plan.suggestion.factValue || fact.value;
    plan.suggestion.questionText =
      plan.suggestion.questionText ||
      `${fact.value} Would ${slotLabelOf(slots, plan.suggestion.slotId)} work for you?`;
  }

  const viewerPreference = viewParticipantId
    ? preferences.find((p) => p.participantId === viewParticipantId) ?? null
    : null;
  const viewerConsent = latestOffer
    ? consents.find((c) => c.offerId === latestOffer.id && c.participantId === viewParticipantId) ?? null
    : null;

  // Isolation: a participant view never carries another participant's private
  // constraints. The synthetic demo keeps the roster so its role switcher works;
  // real (non-synthetic) views see only themselves.
  const visiblePreferences = viewParticipantId
    ? preferences.filter((p) => p.participantId === viewParticipantId)
    : preferences;
  const visiblePayments = viewParticipantId ? payments.filter((p) => p.participantId === viewParticipantId) : payments;
  const visibleParticipants = viewParticipantId
    ? participants.filter((p) => p.id === viewParticipantId || synthetic)
    : participants;

  return {
    mode: buildMode(cfg),
    session: {
      tenantId,
      role: viewParticipantId ? 'participant' : 'organizer',
      viewParticipantId,
      synthetic,
    },
    nowUtc: now,
    workshop: workshop ? workshopView(workshop, slots) : null,
    participants: participantViews(participants, preferences, payments, viewParticipantId, synthetic),
    preferences: preferenceViews(visiblePreferences, participants, slots, viewParticipantId),
    plan: plan ? planView(plan, slots, participants, payments, preferences, viewParticipantId) : null,
    clarifications: clarificationViews(clarifications, participants, slots, viewParticipantId),
    offer: latestOffer && workshop ? offerView(latestOffer, workshop, viewerPreference, viewerConsent) : null,
    payments: visiblePayments.map((p) =>
      paymentView(p, participants.find((x) => x.id === p.participantId)?.displayName ?? 'Participant', viewParticipantId),
    ),
    batch:
      batch && workshop
        ? batchView(
            batch,
            viewParticipantId ? payments.filter((p) => p.participantId === viewParticipantId) : payments,
            participants,
            workshop.timezone,
          )
        : null,
    result: workshop ? resultView(workshop, batch, payments, participants, viewParticipantId) : null,
    audit: auditViews(audit, workshop?.timezone ?? 'UTC'),
    checkout,
    demo: {
      canSwitchRoles: synthetic,
      participantCount: visibleParticipants.length,
      sampleLoaded: Boolean(workshop),
    },
    notice,
  };
}
