/* ==========================================================================
   GatherReady — shared domain types (frozen contract)

   Rules:
   - Money is integer cents (USD only in this MVP). Never floats.
   - Times are stored as UTC ISO-8601 strings ending in `Z`; display always
     goes through the workshop IANA timezone.
   - These are storage/domain shapes. HTTP response shapes live in api.ts.
   ========================================================================== */

export const CURRENCY = 'USD' as const;
export type Currency = typeof CURRENCY;

/** UTC instant, ISO-8601 with `Z`. */
export type IsoUtc = string;

/* ------------------------------- workshop ------------------------------- */

export type WorkshopStatus =
  | 'DRAFT'
  | 'COLLECTING_INTEREST'
  | 'CLARIFYING'
  | 'OFFER_OPEN'
  | 'SETTLING'
  | 'CONFIRMED'
  | 'CANCELLING'
  | 'CANCELLED'
  | 'COMPENSATING'
  | 'MANUAL_REVIEW';

export interface Slot {
  id: string;
  workshopId: string;
  ordinal: 1 | 2 | 3;
  startUtc: IsoUtc;
  endUtc: IsoUtc;
  /** IANA zone used only for display; the instant is authoritative. */
  displayTimezone: string;
  /** Human label, e.g. "Saturday, November 21, 2026". */
  dayLabel: string;
  /** Human label, e.g. "10:00–12:00". */
  timeLabel: string;
}

export interface Workshop {
  id: string;
  tenantId: string;
  merchantName: string;
  title: string;
  description: string;
  venue: string;
  timezone: string;
  durationMinutes: number;
  priceCents: number;
  currency: Currency;
  inclusions: string[];
  minParticipants: number;
  capacity: number;
  /** Authorization window closes at this instant; workshop starts after it. */
  authDeadlineUtc: IsoUtc;
  cancellationPolicyVersion: string;
  cancellationSummary: string;
  failureHandlingSummary: string;
  status: WorkshopStatus;
  version: number;
  /** Synthetic demo cover photo; real workshops may leave this null. */
  coverImageUrl?: string | null;
  createdAt: IsoUtc;
  updatedAt: IsoUtc;
}

/* ------------------------------ preferences ----------------------------- */

export type PreferenceStatus = 'DRAFT' | 'NEEDS_CLARIFICATION' | 'CONFIRMED' | 'WITHDRAWN';

export interface ConditionalSlot {
  slotId: string;
  /** Plain-language condition the participant himself wrote, e.g. "if materials are included". */
  condition: string;
  /** Verbatim substring of the participant's own sentence. */
  sourceQuote: string;
}

export interface Uncertainty {
  field: 'time' | 'date' | 'timezone' | 'condition' | 'other';
  question: string;
  sourceQuote: string;
}

export interface Preference {
  id: string;
  participantId: string;
  version: number;
  status: PreferenceStatus;
  /** Short-lived original text; never written to logs. */
  sourceText: string;
  acceptedSlotIds: string[];
  preferredSlotIds: string[];
  conditionalSlots: ConditionalSlot[];
  uncertainties: Uncertainty[];
  /** How the structured constraints were produced. */
  extractionMode: ExtractionMode;
  extractionModel: string | null;
  confirmedAt: IsoUtc | null;
  createdAt: IsoUtc;
  updatedAt: IsoUtc;
}

export type ExtractionMode = 'live' | 'recorded' | 'structured' | 'failed' | 'seed';

export interface Participant {
  id: string;
  tenantId: string;
  workshopId: string;
  displayName: string;
  /** sha256 of the access token; the plaintext token is shown once at creation. */
  tokenHash: string;
  /** Demo-only: which synthetic persona this is (null for real entries). */
  persona: string | null;
  createdAt: IsoUtc;
}

/* ----------------------------- clarifications --------------------------- */

export type ClarificationStatus =
  | 'PROPOSED'
  | 'SENT'
  | 'ANSWERED_YES'
  | 'ANSWERED_NO'
  | 'CANCELLED';

export interface Clarification {
  id: string;
  participantId: string;
  workshopId: string;
  /** Preference version the condition came from. */
  fromPreferenceVersion: number;
  slotId: string;
  conditionText: string;
  sourceQuote: string;
  questionText: string;
  /** AI-generated or deterministic template; the UI always shows which. */
  questionSource: 'ai' | 'template';
  /** The merchant fact that makes the question answerable. */
  factLabel: string;
  factValue: string;
  status: ClarificationStatus;
  answer: 'YES' | 'NO' | null;
  sentAt: IsoUtc | null;
  answeredAt: IsoUtc | null;
  createdAt: IsoUtc;
}

/* --------------------------------- plans -------------------------------- */

export interface SlotPlan {
  slotId: string;
  /** Participants with a confirmed preference that accepts this slot right now. */
  fitParticipantIds: string[];
  /** Participants whose only path to this slot is an unresolved condition. */
  conditionalParticipantIds: string[];
  /** Preference version confirmed; used to invalidate stale plans. */
  planInputsHash: string;
  meetsMinimum: boolean;
  /** fit + conditional — the ceiling if every pending question were answered yes. */
  reachableMax: number;
  preferredSatisfiedCount: number;
}

export interface ClarificationSuggestion {
  participantId: string;
  clarificationId: string | null;
  slotId: string;
  /** The participant's own condition, verbatim paraphrase from their confirmed card. */
  conditionText: string;
  questionText: string;
  factLabel: string;
  factValue: string;
  /** How many people would fit if this question were answered yes. */
  gapClosed: number;
  sourceQuote: string;
}

export interface PlanResult {
  slots: SlotPlan[];
  minimum: number;
  capacity: number;
  /** Slot that currently satisfies every rule, if any. */
  workableSlotId: string | null;
  suggestion: ClarificationSuggestion | null;
  /** Deterministic, human-readable reason when nothing works. */
  reason: string;
  planInputsHash: string;
}

/* -------------------------------- offers -------------------------------- */

export type OfferStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'SETTLED' | 'CANCELLED';

/** Everything the participant must see before the PayPal button. Immutable once published. */
export interface OfferTerms {
  schemaVersion: 1;
  workshopId: string;
  offerVersion: number;
  merchantName: string;
  workshopTitle: string;
  workshopDescription: string;
  venue: string;
  timezone: string;
  slotId: string;
  startUtc: IsoUtc;
  endUtc: IsoUtc;
  durationMinutes: number;
  priceCents: number;
  currency: Currency;
  inclusions: string[];
  minParticipants: number;
  capacity: number;
  authDeadlineUtc: IsoUtc;
  cancellationPolicyVersion: string;
  cancellationSummary: string;
  failureHandlingSummary: string;
}

export interface Offer {
  id: string;
  tenantId: string;
  workshopId: string;
  version: number;
  slotId: string;
  terms: OfferTerms;
  /** sha256 over canonical JSON of terms. Stable across restarts. */
  offerHash: string;
  status: OfferStatus;
  confirmedByMerchantAt: IsoUtc;
  createdAt: IsoUtc;
  closedAt: IsoUtc | null;
}

export interface Consent {
  id: string;
  tenantId: string;
  participantId: string;
  offerId: string;
  offerHash: string;
  amountCents: number;
  currency: Currency;
  /** Version of the exact consent copy shown. */
  textVersion: string;
  acceptedAt: IsoUtc;
}

/* -------------------------------- payments ------------------------------ */

export type PaymentStatus =
  | 'NONE'
  | 'ORDER_CREATED'
  | 'APPROVED'
  | 'AUTHORIZING'
  | 'AUTHORIZED'
  | 'CAPTURING'
  | 'CAPTURED'
  | 'VOIDING'
  | 'VOIDED'
  | 'REFUNDING'
  | 'REFUNDED'
  | 'FAILED'
  | 'UNKNOWN'
  | 'MANUAL_REVIEW';

export interface Payment {
  id: string;
  tenantId: string;
  workshopId: string;
  participantId: string;
  offerId: string;
  offerHash: string;
  status: PaymentStatus;
  /** Raw provider status, kept for audit; never used as the app state. */
  providerStatus: string | null;
  resourceType: string | null;
  orderId: string | null;
  authorizationId: string | null;
  captureId: string | null;
  refundId: string | null;
  /** PayPal approval URL for a created order; not a secret, but only shown to its owner. */
  approveUrl: string | null;
  amountCents: number;
  currency: Currency;
  /** True when this row was produced by the simulated adapter (no sandbox keys). */
  simulated: boolean;
  observedAt: IsoUtc | null;
  /** When the authorization became AUTHORIZED (drives the 48h capture guard). */
  authorizedAt: IsoUtc | null;
  capturedAt: IsoUtc | null;
  createdAt: IsoUtc;
  updatedAt: IsoUtc;
}

/* ------------------------------- settlement ----------------------------- */

export type BatchStatus =
  | 'LOCKED'
  | 'CAPTURING'
  | 'CONFIRMED'
  | 'COMPENSATING'
  | 'CANCELLED'
  | 'MANUAL_REVIEW';

export interface SettlementBatch {
  id: string;
  tenantId: string;
  workshopId: string;
  offerId: string;
  offerHash: string;
  status: BatchStatus;
  /** Payment ids locked in this batch; the membership never changes after LOCKED. */
  paymentIds: string[];
  expectedParticipantCount: number;
  expectedCents: number;
  capturedCents: number;
  refundedCents: number;
  reason: string | null;
  startedAt: IsoUtc;
  deadlineUtc: IsoUtc;
  finishedAt: IsoUtc | null;
}

export type OperationAction =
  | 'CREATE_ORDER'
  | 'AUTHORIZE'
  | 'CAPTURE'
  | 'VOID'
  | 'REFUND'
  | 'QUERY_ORDER'
  | 'QUERY_AUTHORIZATION'
  | 'QUERY_CAPTURE'
  | 'QUERY_REFUND';

export type OperationStatus = 'PENDING' | 'IN_FLIGHT' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';

export interface OperationRecord {
  id: string;
  tenantId: string;
  batchId: string | null;
  paymentId: string | null;
  action: OperationAction;
  /** Stable PayPal-Request-Id; retries reuse it. */
  idempotencyKey: string;
  requestHash: string;
  status: OperationStatus;
  attempts: number;
  providerRef: string | null;
  lastError: string | null;
  nextCheckAt: IsoUtc | null;
  createdAt: IsoUtc;
  updatedAt: IsoUtc;
}

export interface WebhookEventRecord {
  eventId: string;
  verified: boolean;
  eventType: string;
  resourceType: string | null;
  resourceId: string | null;
  rawSha256: string;
  receivedAt: IsoUtc;
  processedAt: IsoUtc | null;
  outcome: string | null;
}

export type ActorKind = 'ORGANIZER' | 'PARTICIPANT' | 'SYSTEM' | 'DEMO';

export interface AuditEvent {
  id: string;
  tenantId: string;
  actorKind: ActorKind;
  /** Never an email or token: synthetic display name / role id only. */
  actorRef: string;
  workshopId: string | null;
  type: string;
  subjectId: string | null;
  payload: Record<string, unknown>;
  createdAt: IsoUtc;
}

/* -------------------------------- results ------------------------------- */

export interface ReceiptLine {
  participantId: string;
  displayName: string;
  status: PaymentStatus;
  amountCents: number;
  orderId: string | null;
  authorizationId: string | null;
  captureId: string | null;
  refundId: string | null;
  simulated: boolean;
  detail: string;
}

export interface WorkshopResult {
  outcome: 'CONFIRMED' | 'NOT_CONFIRMED' | 'PENDING' | 'NEEDS_ATTENTION';
  headline: string;
  lines: ReceiptLine[];
  capturedCents: number;
  refundedCents: number;
  pendingActionCount: number;
}

/* ------------------------------ validation ------------------------------ */

export interface FieldError {
  field: string;
  message: string;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] };

export interface WorkshopDraftInput {
  merchantName: string;
  title: string;
  description: string;
  venue: string;
  timezone: string;
  durationMinutes: number;
  priceCents: number;
  inclusions: string[];
  minParticipants: number;
  capacity: number;
  authDeadlineUtc: IsoUtc;
  slots: Array<{ startUtc: IsoUtc; endUtc: IsoUtc }>;
}
