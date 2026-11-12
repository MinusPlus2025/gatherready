/* ==========================================================================
   DEV ONLY — synthetic AppState for building and screenshotting the UI before
   the server exists. Loaded exclusively behind `?mock=1` and only when Vite's
   DEV flag is on; the production bundle never reaches this module (the import
   is behind `import.meta.env.DEV`).

   Rules it obeys even though it is fake:
   - `mode.paypal` is always `simulated` and every payment row has
     `simulated: true`; nothing here ever claims real PayPal money moved.
   - The offer, consent copy, quotes and counts are derived from
     `src/shared/sample.ts` so the screens show the same fictional workshop the
     real server seeds.
   - Extraction is labelled `recorded` — it is a checked-in fixture, not a live
     model answer for arbitrary text.
   ========================================================================== */

import type {
  AppState,
  AuditView,
  BatchLineView,
  BatchView,
  CheckoutView,
  ClarificationSuggestionView,
  ClarificationView,
  OfferView,
  ParticipantView,
  PaymentView,
  PlanView,
  PreferenceView,
  ResultView,
  SlotPlanView,
  SlotView,
  WorkshopView,
} from '../../shared/api.js';
import type { OfferTerms, PaymentStatus } from '../../shared/types.js';
import { buildSample, SLOT_IDS, type SampleBundle, type SamplePersona } from '../../shared/sample.js';
import { formatDayLabel, formatInstantLabel, formatRangeLabel, formatTimeRange } from '../../shared/time.js';
import type { WebAction } from './actions.js';
import { formatCents, paymentStatusWord } from './format.js';

/* -------------------------------- module state --------------------------- */

export type MockScene =
  | 'setup'
  | 'preferences'
  | 'plan'
  | 'clarify'
  | 'plan-ready'
  | 'plan-blocked'
  | 'offer'
  | 'returning'
  | 'authorized'
  | 'funding'
  | 'result-confirmed'
  | 'result-not';

const MOCK_SCENES: MockScene[] = [
  'setup',
  'preferences',
  'plan',
  'clarify',
  'plan-ready',
  'plan-blocked',
  'offer',
  'returning',
  'authorized',
  'funding',
  'result-confirmed',
  'result-not',
];

interface MockFlags {
  diegoConfirmed: boolean;
  diegoWithdrawn: boolean;
  diegoAccepted: string[];
  diegoPreferred: string[];
  diegoConditions: Array<{ slotId: string; condition: string; sourceQuote: string }>;
  clarification: 'PROPOSED' | 'SENT' | 'ANSWERED_YES' | 'ANSWERED_NO' | null;
}

let scene: MockScene = 'setup';
let viewerId: string | null = null;
let flags: MockFlags = flagsForScene('setup');

function normalizeScene(value: string | null | undefined): MockScene | null {
  if (!value) return null;
  return MOCK_SCENES.includes(value as MockScene) ? (value as MockScene) : null;
}

/** Route → the mock scene that makes that screen meaningful. */
export function defaultSceneForPath(pathname: string): MockScene {
  if (pathname.startsWith('/organizer/setup')) return 'setup';
  if (pathname.startsWith('/participant/preferences')) return 'preferences';
  if (pathname.startsWith('/organizer/plan')) return 'plan';
  if (pathname.startsWith('/participant/clarify')) return 'clarify';
  if (pathname.startsWith('/organizer/offer')) return 'plan-ready';
  if (pathname.startsWith('/participant/authorize')) return 'offer';
  if (pathname.startsWith('/organizer/funding')) return 'funding';
  if (pathname.startsWith('/organizer/result')) return 'result-confirmed';
  if (pathname.startsWith('/p/')) return 'offer';
  return 'setup';
}

/** Route → the participant the mock should act as (or null for the organizer). */
export function defaultViewerForPath(pathname: string): string | null {
  return pathname.startsWith('/participant') || pathname.startsWith('/p/') ? 'p_diego' : null;
}

const DIEGO_CONDITION = {
  slotId: SLOT_IDS.a,
  condition: 'all the materials are included',
  sourceQuote: 'If all the materials are included I could maybe do Saturday morning too.',
};

function flagsForScene(next: MockScene): MockFlags {
  const hasPreference = [
    'preferences',
    'plan',
    'clarify',
    'plan-ready',
    'plan-blocked',
    'offer',
    'returning',
    'authorized',
    'funding',
    'result-confirmed',
    'result-not',
  ].includes(next);
  // Diego stays a draft while the organizer is planning: the solo question is
  // exactly about the condition he has not settled yet. He becomes confirmed
  // only after answering yes, or after a no that keeps his original preference.
  const confirmed = [
    'plan-ready',
    'plan-blocked',
    'offer',
    'returning',
    'authorized',
    'funding',
    'result-confirmed',
    'result-not',
  ].includes(next);
  const yes = [
    'plan-ready',
    'offer',
    'returning',
    'authorized',
    'funding',
    'result-confirmed',
    'result-not',
  ].includes(next);
  const conditionsOpen = next === 'preferences' || next === 'plan' || next === 'clarify';
  return {
    diegoConfirmed: confirmed,
    diegoWithdrawn: false,
    diegoAccepted: hasPreference ? (yes ? [SLOT_IDS.b, SLOT_IDS.a] : [SLOT_IDS.b]) : [],
    diegoPreferred: hasPreference ? [SLOT_IDS.b] : [],
    diegoConditions: conditionsOpen ? [{ ...DIEGO_CONDITION }] : [],
    clarification:
      next === 'plan'
        ? 'PROPOSED'
        : next === 'clarify'
          ? 'SENT'
          : yes
            ? 'ANSWERED_YES'
            : next === 'plan-blocked'
              ? 'ANSWERED_NO'
              : null,
  };
}

/* --------------------------------- utils -------------------------------- */

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function hoursAgo(hours: number): string {
  return minutesAgo(hours * 60);
}

const PERSONA_IDS: Record<string, string> = {
  alice: 'p_alice',
  ben: 'p_ben',
  cara: 'p_cara',
  diego: 'p_diego',
  elise: 'p_elise',
  finn: 'p_finn',
};

/** The four people whose confirmed preference accepts the offer slot (after Diego's yes). */
const OFFER_PARTICIPANT_KEYS = ['alice', 'ben', 'cara', 'diego'];

const OFFER_HASH = '4f1c9d2ab7e35c8061f4a9d2cbe78105d36a4f9b2c8e7d10a5b3c6e9f2d4a7b1';
const SHORT_HASH = OFFER_HASH.slice(0, 12);

const CANCELLATION_SUMMARY =
  'You can withdraw before the authorization deadline and your hold is released with no charge. After capture, cancellations follow the studio’s 48-hour policy.';
const FAILURE_SUMMARY =
  'If fewer than 4 people authorize, or any capture fails, nothing is kept: uncaptured authorizations are voided and every captured charge is refunded. Refunds are shown only once PayPal confirms them.';

/* ------------------------------ workshop view ---------------------------- */

function buildWorkshop(bundle: SampleBundle, status: WorkshopView['status']): WorkshopView {
  const draft = bundle.draft;
  const slots: SlotView[] = draft.slots.map((slot, index) => {
    const id = [SLOT_IDS.a, SLOT_IDS.b, SLOT_IDS.c][index]!;
    return {
      id,
      ordinal: (index + 1) as 1 | 2 | 3,
      startUtc: slot.startUtc,
      endUtc: slot.endUtc,
      timezone: draft.timezone,
      dayLabel: formatDayLabel(slot.startUtc, draft.timezone),
      timeLabel: formatTimeRange(slot.startUtc, slot.endUtc, draft.timezone),
      rangeLabel: formatRangeLabel(slot.startUtc, slot.endUtc, draft.timezone),
    };
  });
  return {
    id: 'ws_demo',
    merchantName: draft.merchantName,
    title: draft.title,
    description: draft.description,
    venue: draft.venue,
    timezone: draft.timezone,
    durationMinutes: draft.durationMinutes,
    priceCents: draft.priceCents,
    priceLabel: formatCents(draft.priceCents),
    currency: 'USD',
    inclusions: draft.inclusions,
    minParticipants: draft.minParticipants,
    capacity: draft.capacity,
    authDeadlineUtc: draft.authDeadlineUtc,
    authDeadlineLabel: formatInstantLabel(draft.authDeadlineUtc, draft.timezone),
    cancellationPolicyVersion: 'v1',
    cancellationSummary: CANCELLATION_SUMMARY,
    failureHandlingSummary: FAILURE_SUMMARY,
    coverImageUrl: '/images/pottery-workshop.jpg',
    status,
    slots,
  };
}

/* ----------------------------- preferences view -------------------------- */

function buildPreference(
  persona: SamplePersona,
  workshop: WorkshopView,
  viewer: string | null,
  isDiego: boolean,
  confirmed: boolean,
): PreferenceView {
  const id = PERSONA_IDS[persona.key]!;
  const acceptedIds = isDiego ? flags.diegoAccepted : persona.preference.acceptedSlotIds;
  const preferredIds = isDiego ? flags.diegoPreferred : persona.preference.preferredSlotIds;
  const conditions = isDiego ? flags.diegoConditions : [];
  const labelOf = (slotId: string): string => workshop.slots.find((s) => s.id === slotId)?.rangeLabel ?? slotId;
  const conditionViews = conditions.map((c) => ({
    slotId: c.slotId,
    slotLabel: labelOf(c.slotId),
    condition: c.condition,
    sourceQuote: c.sourceQuote,
  }));

  return {
    participantId: id,
    displayName: persona.displayName,
    version: isDiego && !confirmed ? 0 : 1,
    status: isDiego && flags.diegoWithdrawn ? 'WITHDRAWN' : confirmed ? 'CONFIRMED' : 'DRAFT',
    acceptedSlotIds: acceptedIds,
    acceptedSlotLabels: acceptedIds.map(labelOf),
    preferredSlotIds: preferredIds,
    preferredSlotLabels: preferredIds.map(labelOf),
    conditions: conditionViews,
    uncertainties: [],
    extractionMode: 'recorded',
    extractionModel: null,
    sourceText: viewer === id ? persona.sourceText : null,
    confirmedAt: confirmed && !flags.diegoWithdrawn ? hoursAgo(2) : null,
  };
}

/* --------------------------------- plan ---------------------------------- */

function buildPlan(
  participants: ParticipantView[],
  preferences: PreferenceView[],
  workshop: WorkshopView,
): PlanView {
  const confirmed = preferences.filter((p) => p.status === 'CONFIRMED');
  const fitsFor = (slotId: string): PreferenceView[] =>
    confirmed.filter((p) => p.acceptedSlotIds.includes(slotId));
  const conditionalFor = (slotId: string): PreferenceView[] =>
    preferences.filter((p) => p.status !== 'WITHDRAWN' && p.conditions.some((c) => c.slotId === slotId));

  const slots: SlotPlanView[] = workshop.slots.map((slot) => {
    const fits = fitsFor(slot.id);
    const conditional = conditionalFor(slot.id);
    return {
      slotId: slot.id,
      ordinal: slot.ordinal,
      label: `${slot.dayLabel} · ${slot.timeLabel}`,
      fits: fits.length,
      fitNames: fits.map((p) => p.displayName),
      conditionalCount: conditional.length,
      conditionalNames: conditional.map((p) => p.displayName),
      reachableMax: fits.length + conditional.length,
      meetsMinimum: fits.length >= workshop.minParticipants,
      preferredSatisfiedCount: confirmed.filter((p) => p.preferredSlotIds.includes(slot.id)).length,
    };
  });

  const ranked = [...slots].sort((a, b) => {
    if (a.meetsMinimum !== b.meetsMinimum) return a.meetsMinimum ? -1 : 1;
    // A slot that can still reach the minimum with a yes is a better plan than
    // one that is already out of reach, even with fewer open conditions.
    const aReachable = a.reachableMax >= workshop.minParticipants;
    const bReachable = b.reachableMax >= workshop.minParticipants;
    if (aReachable !== bReachable) return aReachable ? -1 : 1;
    if (a.conditionalCount !== b.conditionalCount) return a.conditionalCount - b.conditionalCount;
    if (a.preferredSatisfiedCount !== b.preferredSatisfiedCount) {
      return b.preferredSatisfiedCount - a.preferredSatisfiedCount;
    }
    if (a.fits !== b.fits) return b.fits - a.fits;
    return a.ordinal - b.ordinal;
  });
  const best = ranked[0]!;
  const workable = slots.find((s) => s.meetsMinimum) ?? null;

  const suggestionVisible =
    !workable && (flags.clarification === 'PROPOSED' || flags.clarification === 'SENT');
  const suggestion: ClarificationSuggestionView | null = suggestionVisible
    ? {
        participantId: PERSONA_IDS.diego!,
        participantName: 'Diego',
        clarificationId: 'clr_diego_materials',
        slotId: SLOT_IDS.a,
        slotLabel: workshop.slots.find((s) => s.id === SLOT_IDS.a)?.rangeLabel ?? 'Saturday morning',
        conditionText: DIEGO_CONDITION.condition,
        questionText: diorQuestion(workshop),
        factLabel: 'Materials',
        factValue: 'All clay, tools and firing are included in the $45 price.',
        gapClosed: 1,
        sourceQuote: DIEGO_CONDITION.sourceQuote,
      }
    : null;

  return {
    slots,
    minimum: workshop.minParticipants,
    capacity: workshop.capacity,
    workableSlotId: workable?.slotId ?? null,
    suggestion,
    reason: workable
      ? `Every confirmed preference fits ${labelOf(workable, workshop)}. The plan meets the minimum of ${workshop.minParticipants}.`
      : suggestion
        ? `No time reaches the minimum of ${workshop.minParticipants} yet. One pending condition on ${suggestion.slotLabel} is the difference.`
        : `No time reaches the minimum of ${workshop.minParticipants}, and there is no open question left to close the gap. A new time or a new participant is needed.`,
    planInputsHash: 'c41d9a7f2b6e8053',
    counts: {
      interested: participants.length,
      confirmedPreferences: confirmed.length,
      fitsThisPlan: best.fits,
      authorized: 0,
      captured: 0,
    },
  };
}

function labelOf(slot: SlotPlanView, workshop: WorkshopView): string {
  return workshop.slots.find((s) => s.id === slot.slotId)?.rangeLabel ?? slot.label;
}

function diorQuestion(workshop: WorkshopView): string {
  const slot = workshop.slots.find((s) => s.id === SLOT_IDS.a);
  const range = slot ? `${slot.dayLabel} · ${slot.timeLabel}` : 'the Saturday morning session';
  return `Would ${range} work for you if all clay, tools and firing are included in the $45 price?`;
}

/* ----------------------------- clarifications ---------------------------- */

function buildClarification(workshop: WorkshopView): ClarificationView[] {
  if (!flags.clarification) return [];
  const answeredAt =
    flags.clarification === 'ANSWERED_YES' || flags.clarification === 'ANSWERED_NO' ? minutesAgo(45) : null;
  const sentAt = flags.clarification === 'SENT' ? minutesAgo(90) : null;
  return [
    {
      id: 'clr_diego_materials',
      participantId: PERSONA_IDS.diego!,
      participantName: 'Diego',
      slotId: SLOT_IDS.a,
      slotLabel: workshop.slots.find((s) => s.id === SLOT_IDS.a)?.rangeLabel ?? 'Saturday morning',
      questionText: diorQuestion(workshop),
      questionSource: 'template',
      factLabel: 'Materials',
      factValue: 'All clay, tools and firing are included in the $45 price.',
      conditionText: DIEGO_CONDITION.condition,
      sourceQuote: DIEGO_CONDITION.sourceQuote,
      status: flags.clarification,
      answer: flags.clarification === 'ANSWERED_YES' ? 'YES' : flags.clarification === 'ANSWERED_NO' ? 'NO' : null,
      sentAt,
      answeredAt,
      isMine: viewerId === PERSONA_IDS.diego,
    },
  ];
}

/* ---------------------------------- offer -------------------------------- */

function buildOffer(bundle: SampleBundle, workshop: WorkshopView, viewer: string | null): OfferView {
  const draft = bundle.draft;
  const slot = workshop.slots.find((s) => s.id === SLOT_IDS.a)!;
  const terms: OfferTerms = {
    schemaVersion: 1,
    workshopId: workshop.id,
    offerVersion: 1,
    merchantName: draft.merchantName,
    workshopTitle: draft.title,
    workshopDescription: draft.description,
    venue: draft.venue,
    timezone: draft.timezone,
    slotId: slot.id,
    startUtc: slot.startUtc,
    endUtc: slot.endUtc,
    durationMinutes: draft.durationMinutes,
    priceCents: draft.priceCents,
    currency: 'USD',
    inclusions: draft.inclusions,
    minParticipants: draft.minParticipants,
    capacity: draft.capacity,
    authDeadlineUtc: draft.authDeadlineUtc,
    cancellationPolicyVersion: 'v1',
    cancellationSummary: CANCELLATION_SUMMARY,
    failureHandlingSummary: FAILURE_SUMMARY,
  };
  const dateTime = `${formatDayLabel(slot.startUtc, draft.timezone)} · ${formatTimeRange(slot.startUtc, slot.endUtc, draft.timezone)}`;
  const termsRows = [
    { label: 'Merchant', value: draft.merchantName },
    { label: 'Workshop', value: draft.title },
    { label: 'Date & time', value: dateTime },
    { label: 'Timezone', value: draft.timezone },
    { label: 'Venue', value: draft.venue },
    { label: 'Includes', value: draft.inclusions.join(' · ') },
    { label: 'Total', value: `${formatCents(draft.priceCents)} USD` },
    { label: 'Minimum', value: `${draft.minParticipants} participants (maximum ${draft.capacity})` },
    { label: 'Authorization deadline', value: workshop.authDeadlineLabel },
    { label: 'Cancellation', value: CANCELLATION_SUMMARY },
    { label: 'If collection fails', value: FAILURE_SUMMARY },
  ];
  const consentText = `I authorize ${draft.merchantName} to charge ${formatCents(draft.priceCents)} USD to my PayPal account for ${draft.title} on ${formatDayLabel(slot.startUtc, draft.timezone)} only if at least ${draft.minParticipants} people authorize before the deadline. If the workshop is not confirmed, this authorization is voided and I am not charged.`;

  return {
    id: 'offer_demo_v1',
    version: 1,
    offerHash: OFFER_HASH,
    shortHash: SHORT_HASH,
    status: 'OPEN',
    slotId: slot.id,
    slotLabel: slot.rangeLabel,
    terms,
    termsRows,
    consent: {
      textVersion: 'v1',
      text: consentText,
      checkboxLabel: 'I have read the summary above and I agree to this authorization.',
    },
    viewerIncluded: viewer !== null && OFFER_PARTICIPANT_KEYS.includes(keyFor(viewer)),
    viewerConsented: viewer !== null && paymentStatusFor(viewer) !== 'NONE',
    authDeadlineLabel: workshop.authDeadlineLabel,
    isOpen: true,
  };
}

function keyFor(participantId: string): string {
  return participantId.replace(/^p_/, '');
}

/* -------------------------------- payments ------------------------------- */

function paymentStatusFor(participantId: string): PaymentStatus {
  const key = keyFor(participantId);
  const included = OFFER_PARTICIPANT_KEYS.includes(key);
  switch (scene) {
    case 'returning':
      return key === 'diego' ? 'AUTHORIZING' : 'NONE';
    case 'authorized':
      return key === 'diego' ? 'AUTHORIZED' : 'NONE';
    case 'funding':
      return included ? 'AUTHORIZED' : 'NONE';
    case 'result-confirmed':
      return included ? 'CAPTURED' : 'NONE';
    case 'result-not':
      if (key === 'alice') return 'REFUNDED';
      if (key === 'ben') return 'VOIDED';
      if (key === 'cara') return 'REFUNDING';
      if (key === 'diego') return 'MANUAL_REVIEW';
      return 'NONE';
    default:
      return 'NONE';
  }
}

function buildPayments(participants: ParticipantView[], offer: OfferView | null): PaymentView[] {
  if (!offer) return [];
  return participants.map((participant) => {
    const status = paymentStatusFor(participant.id);
    const hasProvider = status !== 'NONE';
    const amountCents = offer.terms.priceCents;
    const captured = status === 'CAPTURED' || status === 'REFUNDED' || status === 'REFUNDING';
    const authorized =
      captured || status === 'AUTHORIZED' || status === 'VOIDED' || status === 'MANUAL_REVIEW';
    return {
      id: `pay_${keyFor(participant.id)}`,
      participantId: participant.id,
      participantName: participant.displayName,
      status,
      statusLabel: paymentStatusWord[status],
      providerStatus:
        status === 'CAPTURED'
          ? 'COMPLETED'
          : status === 'REFUNDED'
            ? 'REFUNDED'
            : status === 'REFUNDING'
              ? 'REFUND PENDING'
              : status === 'VOIDED'
                ? 'VOIDED'
                : status === 'MANUAL_REVIEW'
                  ? 'UNKNOWN'
                  : status === 'AUTHORIZING'
                    ? 'CREATED'
                    : status === 'AUTHORIZED'
                      ? 'CREATED'
                      : null,
      amountCents,
      amountLabel: formatCents(amountCents),
      orderId: hasProvider ? `SIM-ORDER-${keyFor(participant.id).toUpperCase()}` : null,
      authorizationId: authorized ? `SIM-AUTH-${keyFor(participant.id).toUpperCase()}` : null,
      captureId: captured ? `SIM-CAP-${keyFor(participant.id).toUpperCase()}` : null,
      refundId: status === 'REFUNDED' ? `SIM-REF-${keyFor(participant.id).toUpperCase()}` : status === 'REFUNDING' ? `SIM-REF-${keyFor(participant.id).toUpperCase()}` : null,
      approveUrl: null,
      simulated: true,
      isMine: viewerId === participant.id,
      updatedAt: minutesAgo(5),
    };
  });
}

function lineFor(payment: PaymentView): BatchLineView {
  const detail =
    payment.status === 'CAPTURED'
      ? 'Captured by the simulated PayPal adapter — no real money.'
      : payment.status === 'VOIDED'
        ? 'Authorization voided; the hold is released. Nothing was captured.'
        : payment.status === 'REFUNDING'
          ? 'Refund requested. Not counted as refunded until PayPal confirms it.'
          : payment.status === 'REFUNDED'
            ? 'Refund confirmed by PayPal.'
            : payment.status === 'MANUAL_REVIEW'
              ? 'Outcome unknown — a person must check the PayPal dashboard. Nothing is retried automatically.'
              : payment.status === 'AUTHORIZED'
                ? 'Authorization valid, not captured yet.'
                : payment.statusLabel;
  return {
    participantId: payment.participantId,
    participantName: payment.participantName,
    amountCents: payment.amountCents,
    amountLabel: payment.amountLabel,
    status: payment.status,
    statusLabel: payment.statusLabel,
    captureId: payment.captureId,
    refundId: payment.refundId,
    detail,
  };
}

function buildBatch(payments: PaymentView[], workshop: WorkshopView, offer: OfferView): BatchView | null {
  const included = payments.filter((p) => p.status !== 'NONE');
  if (included.length === 0) return null;
  const status =
    scene === 'funding' ? 'LOCKED' : scene === 'result-confirmed' ? 'CONFIRMED' : 'MANUAL_REVIEW';
  const captured = included.filter(
    (p) => p.status === 'CAPTURED' || p.status === 'REFUNDED' || p.status === 'REFUNDING',
  ).length;
  const refunded = included.filter((p) => p.status === 'REFUNDED').length;
  return {
    id: 'batch_demo_1',
    status,
    expectedParticipantCount: included.length,
    expectedCents: included.length * workshop.priceCents,
    capturedCents: captured * workshop.priceCents,
    refundedCents: refunded * workshop.priceCents,
    expectedLabel: formatCents(included.length * workshop.priceCents),
    capturedLabel: formatCents(captured * workshop.priceCents),
    refundedLabel: formatCents(refunded * workshop.priceCents),
    deadlineUtc: workshop.authDeadlineUtc,
    deadlineLabel: workshop.authDeadlineLabel,
    reason:
      status === 'MANUAL_REVIEW'
        ? 'Capture did not complete for every participant. Void and refund states are being confirmed with PayPal before anything is retried.'
        : null,
    lines: included.map(lineFor),
  };
}

function buildResult(payments: PaymentView[]): ResultView {
  const lines = payments.filter((p) => p.status !== 'NONE').map(lineFor);
  if (scene === 'result-confirmed') {
    const capturedCents = lines.filter((l) => l.status === 'CAPTURED').length * 4500;
    return {
      outcome: 'CONFIRMED',
      headline: 'Workshop confirmed',
      detail:
        'Every authorization was captured against the same fixed offer. Each participant has a receipt line below; the studio has been paid.',
      lines,
      capturedLabel: formatCents(capturedCents),
      refundedLabel: formatCents(0),
      pendingActionCount: 0,
    };
  }
  return {
    outcome: 'NOT_CONFIRMED',
    headline: 'Workshop not confirmed',
    detail:
      'One or more captures did not complete, so the batch was rolled back. Holds that were never captured are released, captured charges are refunded, and anything uncertain needs a person to check PayPal.',
    lines,
    capturedLabel: formatCents(9000),
    refundedLabel: formatCents(4500),
    pendingActionCount: 2,
  };
}

/* --------------------------------- audit --------------------------------- */

function buildAudit(workshop: WorkshopView | null, offer: OfferView | null): AuditView[] {
  if (!workshop) return [];
  const tz = workshop.timezone;
  const rows: Array<Omit<AuditView, 'id' | 'createdAt' | 'createdAtLabel'> & { at: string }> = [
    {
      actorKind: 'ORGANIZER',
      actorRef: 'Organizer',
      type: 'workshop.created',
      subjectId: workshop.id,
      summary: `Workshop created with ${workshop.slots.length} candidate times.`,
      at: hoursAgo(26),
    },
    {
      actorKind: 'PARTICIPANT',
      actorRef: 'Alice',
      type: 'preference.confirmed',
      subjectId: PERSONA_IDS.alice ?? null,
      summary: 'Preference confirmed (Saturday 10:00–12:00).',
      at: hoursAgo(22),
    },
  ];
  if (flags.clarification) {
    rows.push({
      actorKind: 'ORGANIZER',
      actorRef: 'Organizer',
      type: 'clarification.sent',
      subjectId: 'clr_diego_materials',
      summary: 'One question sent to Diego about materials.',
      at: hoursAgo(2),
    });
  }
  if (flags.clarification === 'ANSWERED_YES' || flags.clarification === 'ANSWERED_NO') {
    rows.push({
      actorKind: 'PARTICIPANT',
      actorRef: 'Diego',
      type: 'clarification.answered',
      subjectId: 'clr_diego_materials',
      summary:
        flags.clarification === 'ANSWERED_YES'
          ? 'Diego answered yes; his preference was updated and re-confirmed.'
          : 'Diego answered no; his original preference is kept and he is not asked again.',
      at: minutesAgo(45),
    });
  }
  if (offer) {
    rows.push({
      actorKind: 'ORGANIZER',
      actorRef: 'Organizer',
      type: 'offer.published',
      subjectId: offer.id,
      summary: `Fixed offer published for ${offer.slotLabel}. Fingerprint ${offer.shortHash}.`,
      at: minutesAgo(120),
    });
  }
  if (scene === 'funding') {
    rows.push({
      actorKind: 'ORGANIZER',
      actorRef: 'Organizer',
      type: 'batch.locked',
      subjectId: 'batch_demo_1',
      summary: 'Batch locked with 4 authorized participants ($180.00).',
      at: minutesAgo(30),
    });
  }
  if (scene === 'result-confirmed' && offer) {
    rows.push({
      actorKind: 'SYSTEM',
      actorRef: 'Settlement',
      type: 'workshop.confirmed',
      subjectId: workshop.id,
      summary: 'All 4 captures completed. Workshop confirmed.',
      at: minutesAgo(20),
    });
  }
  if (scene === 'result-not' && offer) {
    rows.push({
      actorKind: 'SYSTEM',
      actorRef: 'Settlement',
      type: 'batch.compensating',
      subjectId: 'batch_demo_1',
      summary: 'Capture failed for 2 participants. Void and refund operations started.',
      at: minutesAgo(15),
    });
  }
  return rows
    .slice()
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((row) => ({
      id: `audit_${row.type}`,
      actorKind: row.actorKind,
      actorRef: row.actorRef,
      type: row.type,
      subjectId: row.subjectId,
      summary: row.summary,
      createdAt: row.at,
      createdAtLabel: formatInstantLabel(row.at, tz),
    }));
}

/* ------------------------------- full state ------------------------------ */

function build(): AppState {
  const now = nowIso();
  const hasWorkshop = scene !== 'setup';
  if (!hasWorkshop) {
    return {
      mode: mockMode(),
      session: mockSession(),
      nowUtc: now,
      workshop: null,
      participants: [],
      preferences: [],
      plan: null,
      clarifications: [],
      offer: null,
      payments: [],
      batch: null,
      result: null,
      audit: [],
      checkout: null,
      demo: { canSwitchRoles: true, participantCount: 0, sampleLoaded: false },
      notice: mockNotice(),
    };
  }

  const bundle = buildSample(now, 9);
  const workshopStatus: WorkshopView['status'] =
    scene === 'result-confirmed'
      ? 'CONFIRMED'
      : scene === 'result-not'
        ? 'CANCELLED'
        : scene === 'offer' || scene === 'returning' || scene === 'authorized' || scene === 'funding'
          ? 'OFFER_OPEN'
          : scene === 'plan' ||
              scene === 'clarify' ||
              scene === 'plan-ready' ||
              scene === 'plan-blocked'
            ? 'CLARIFYING'
            : 'COLLECTING_INTEREST';
  const workshop = buildWorkshop(bundle, workshopStatus);

  const participants: ParticipantView[] = bundle.personas.map((persona) => {
    const id = PERSONA_IDS[persona.key]!;
    const isDiego = persona.key === 'diego';
    const confirmed = isDiego ? flags.diegoConfirmed : persona.preference.status === 'CONFIRMED';
    return {
      id,
      displayName: persona.displayName,
      persona: persona.key,
      preferenceStatus: isDiego && flags.diegoWithdrawn ? 'WITHDRAWN' : confirmed ? 'CONFIRMED' : 'DRAFT',
      paymentStatus: paymentStatusFor(id),
      isMe: viewerId === id,
      demo: true,
    };
  });

  const preferences: PreferenceView[] = bundle.personas.map((persona) => {
    const isDiego = persona.key === 'diego';
    const confirmed = isDiego ? flags.diegoConfirmed : persona.preference.status === 'CONFIRMED';
    return buildPreference(persona, workshop, viewerId, isDiego, confirmed);
  });

  const offer =
    scene === 'offer' ||
    scene === 'returning' ||
    scene === 'authorized' ||
    scene === 'funding' ||
    scene === 'result-confirmed' ||
    scene === 'result-not'
      ? buildOffer(bundle, workshop, viewerId)
      : null;

  const payments = buildPayments(participants, offer);

  const planVisible =
    scene === 'plan' ||
    scene === 'clarify' ||
    scene === 'plan-ready' ||
    scene === 'plan-blocked' ||
    scene === 'offer' ||
    scene === 'returning' ||
    scene === 'authorized' ||
    scene === 'funding' ||
    scene === 'result-confirmed' ||
    scene === 'result-not';
  const plan = planVisible ? buildPlan(participants, preferences, workshop) : null;
  if (plan) {
    plan.counts.authorized = payments.filter((p) => p.status === 'AUTHORIZED').length;
    plan.counts.captured = payments.filter((p) => p.status === 'CAPTURED').length;
  }

  const batch = offer ? buildBatch(payments, workshop, offer) : null;
  const result = scene === 'result-confirmed' || scene === 'result-not' ? buildResult(payments) : null;

  const checkout: CheckoutView | null =
    scene === 'returning' && offer
      ? {
          paymentId: 'pay_diego',
          orderId: 'SIM-ORDER-DIEGO',
          approveUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=SIM-ORDER-DIEGO',
          amountLabel: offer.terms.priceCents ? formatCents(offer.terms.priceCents) : '$45.00',
          simulated: true,
          simulatedApprovePath: '/api/demo/simulated-approve?orderId=SIM-ORDER-DIEGO',
        }
      : null;

  return {
    mode: mockMode(),
    session: mockSession(),
    nowUtc: now,
    workshop,
    participants,
    preferences,
    plan,
    clarifications: buildClarification(workshop),
    offer,
    payments,
    batch,
    result,
    audit: buildAudit(workshop, offer),
    checkout,
    demo: { canSwitchRoles: true, participantCount: participants.length, sampleLoaded: true },
    notice: mockNotice(),
  };
}

function mockSession(): AppState['session'] {
  return {
    tenantId: 'tenant_demo',
    role: viewerId ? 'participant' : 'organizer',
    viewParticipantId: viewerId,
    synthetic: true,
  };
}

function mockMode(): AppState['mode'] {
  return {
    paypal: 'simulated',
    ai: 'recorded',
    paypalClientId: null,
    llmProvider: null,
    llmModel: null,
    banner:
      'Sandbox · No real money. This prototype runs on Simulated PayPal: no PayPal account is contacted and no real payment is made.',
  };
}

function mockNotice(): AppState['notice'] {
  return {
    kind: 'info',
    message:
      'Dev mock: the synthetic sample workshop from src/shared/sample.ts, loaded behind ?mock=1. Every payment row is simulated.',
  };
}

/* --------------------------------- public -------------------------------- */

export function loadMockState(sceneParam: string | null, viewerParam: string | null): AppState {
  scene = normalizeScene(sceneParam) ?? 'setup';
  viewerId = viewerParam;
  flags = flagsForScene(scene);
  return build();
}

export function applyMockAction(action: WebAction): AppState {
  switch (action.type) {
    case 'workshop.create':
      scene = 'preferences';
      flags = flagsForScene(scene);
      break;
    case 'preferences.parse': {
      const structured = action.payload.structured;
      if (structured) {
        flags.diegoAccepted = [...structured.acceptedSlotIds];
        flags.diegoPreferred = [...structured.preferredSlotIds];
        flags.diegoConditions = structured.conditions.map((c) => ({
          slotId: c.slotId,
          condition: c.condition,
          sourceQuote: c.condition,
        }));
        flags.diegoConfirmed = false;
      }
      scene = 'preferences';
      break;
    }
    case 'preferences.confirm':
      flags.diegoConfirmed = true;
      flags.diegoAccepted = [...action.payload.acceptedSlotIds];
      flags.diegoPreferred = [...action.payload.preferredSlotIds];
      flags.diegoConditions = action.payload.conditions.map((c) => ({ ...c }));
      scene = 'preferences';
      break;
    case 'plans.compute':
      scene = 'plan';
      break;
    case 'clarifications.propose':
      flags.clarification = 'PROPOSED';
      break;
    case 'clarifications.send':
      flags.clarification = 'SENT';
      scene = 'clarify';
      break;
    case 'clarifications.answer':
      flags.clarification = action.payload.answer === 'YES' ? 'ANSWERED_YES' : 'ANSWERED_NO';
      if (action.payload.answer === 'YES') {
        flags.diegoAccepted = [SLOT_IDS.b, SLOT_IDS.a];
        flags.diegoConditions = [];
        flags.diegoConfirmed = true;
        scene = 'plan-ready';
      } else {
        flags.diegoAccepted = [SLOT_IDS.b];
        flags.diegoConditions = [];
        flags.diegoConfirmed = true;
        scene = 'plan-blocked';
      }
      break;
    case 'offers.publish':
      scene = 'offer';
      break;
    case 'checkout.start':
      scene = 'returning';
      break;
    case 'checkout.complete':
      scene = 'authorized';
      break;
    case 'participants.withdraw':
      flags.diegoWithdrawn = true;
      break;
    case 'workshops.settle':
      scene = 'result-confirmed';
      break;
    case 'demo.view':
      viewerId = action.payload.participantId;
      break;
    case 'demo.reset':
      scene = 'setup';
      viewerId = null;
      flags = flagsForScene('setup');
      break;
  }
  return build();
}

/** The synthetic token used by the /p/:token demo route under ?mock=1. */
export const MOCK_PARTICIPANT_TOKEN = 'mockdemo_mockdemo_mockdemo_mockdemo_mockdem';
