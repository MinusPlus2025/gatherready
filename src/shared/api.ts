/* ==========================================================================
   GatherReady — HTTP contract (frozen)

   Every mutating endpoint returns the whole `AppState` so the UI never has to
   guess. One polling endpoint (`GET /api/state`) keeps screens consistent after
   refresh, back/forward, and repeated clicks.

   Shapes here are display-ready: the server formats instants in the workshop
   timezone so the UI cannot accidentally render a UTC time as local.
   ========================================================================== */

import type {
  ActorKind,
  AuditEvent,
  BatchStatus,
  ClarificationStatus,
  Currency,
  ExtractionMode,
  IsoUtc,
  OfferTerms,
  OfferStatus,
  PaymentStatus,
  PreferenceStatus,
  WorkshopStatus,
} from './types.js';

/* --------------------------------- modes -------------------------------- */

export type PaypalMode = 'sandbox' | 'simulated';
export type AiMode = 'live' | 'recorded' | 'structured';

export interface ModeView {
  /** `simulated` means no PayPal credentials were found; nothing leaves the machine. */
  paypal: PaypalMode;
  /** `live` = a real model answered; `recorded` = checked-in fixture; `structured` = form-only. */
  ai: AiMode;
  /** Public sandbox client id for the PayPal JS SDK, when configured. */
  paypalClientId: string | null;
  llmProvider: string | null;
  llmModel: string | null;
  /** Human sentence the UI must show in the top banner. */
  banner: string;
}

export interface SessionView {
  tenantId: string;
  role: 'organizer' | 'participant';
  viewParticipantId: string | null;
  /** True for the synthetic demo tenant; role switching is only allowed here. */
  synthetic: boolean;
}

/* -------------------------------- workshop ------------------------------- */

export interface SlotView {
  id: string;
  ordinal: 1 | 2 | 3;
  startUtc: IsoUtc;
  endUtc: IsoUtc;
  timezone: string;
  dayLabel: string;
  timeLabel: string;
  /** "Saturday, November 21, 2026 · 10:00–12:00 (America/Los_Angeles)" */
  rangeLabel: string;
}

export interface WorkshopView {
  id: string;
  merchantName: string;
  title: string;
  description: string;
  venue: string;
  timezone: string;
  durationMinutes: number;
  priceCents: number;
  priceLabel: string;
  currency: Currency;
  inclusions: string[];
  minParticipants: number;
  capacity: number;
  authDeadlineUtc: IsoUtc;
  authDeadlineLabel: string;
  cancellationPolicyVersion: string;
  cancellationSummary: string;
  failureHandlingSummary: string;
  status: WorkshopStatus;
  slots: SlotView[];
}

/* ------------------------------ participants ----------------------------- */

export interface ParticipantView {
  id: string;
  displayName: string;
  persona: string | null;
  preferenceStatus: PreferenceStatus;
  paymentStatus: PaymentStatus;
  /** True when the current session is acting as this participant. */
  isMe: boolean;
  /** Only exposed for the synthetic demo so the demo script can switch views. */
  demo: boolean;
}

export interface ConditionView {
  slotId: string;
  slotLabel: string;
  condition: string;
  sourceQuote: string;
}

export interface PreferenceView {
  participantId: string;
  displayName: string;
  version: number;
  status: PreferenceStatus;
  acceptedSlotIds: string[];
  acceptedSlotLabels: string[];
  preferredSlotIds: string[];
  preferredSlotLabels: string[];
  conditions: ConditionView[];
  uncertainties: Array<{ field: string; question: string; sourceQuote: string }>;
  extractionMode: ExtractionMode;
  extractionModel: string | null;
  /** Only shown to the participant himself. Organizers see constraints, not private reasons. */
  sourceText: string | null;
  confirmedAt: IsoUtc | null;
}

/* ---------------------------------- plan --------------------------------- */

export interface SlotPlanView {
  slotId: string;
  ordinal: 1 | 2 | 3;
  label: string;
  fits: number;
  fitNames: string[];
  conditionalCount: number;
  conditionalNames: string[];
  reachableMax: number;
  meetsMinimum: boolean;
  preferredSatisfiedCount: number;
}

export interface ClarificationSuggestionView {
  participantId: string;
  participantName: string;
  clarificationId: string | null;
  slotId: string;
  slotLabel: string;
  /** The participant's own condition, whitespace-trimmed, from their confirmed card. */
  conditionText: string;
  questionText: string;
  factLabel: string;
  factValue: string;
  gapClosed: number;
  sourceQuote: string;
}

export interface PlanView {
  slots: SlotPlanView[];
  minimum: number;
  capacity: number;
  workableSlotId: string | null;
  /** One suggested question at most, per brief §5.2. */
  suggestion: ClarificationSuggestionView | null;
  reason: string;
  planInputsHash: string;
  counts: {
    interested: number;
    confirmedPreferences: number;
    fitsThisPlan: number;
    authorized: number;
    captured: number;
  };
}

/* ------------------------------ clarifications --------------------------- */

export interface ClarificationView {
  id: string;
  participantId: string;
  participantName: string;
  slotId: string;
  slotLabel: string;
  questionText: string;
  questionSource: 'ai' | 'template';
  factLabel: string;
  factValue: string;
  conditionText: string;
  sourceQuote: string;
  status: ClarificationStatus;
  answer: 'YES' | 'NO' | null;
  sentAt: IsoUtc | null;
  answeredAt: IsoUtc | null;
  isMine: boolean;
}

/* --------------------------------- offers -------------------------------- */

export interface ConsentCopyView {
  textVersion: string;
  /** Exact sentence shown above the unchecked box. Rendered verbatim. */
  text: string;
  checkboxLabel: string;
}

export interface OfferView {
  id: string;
  version: number;
  offerHash: string;
  /** First 12 chars of the hash — what the UI shows as the plan fingerprint. */
  shortHash: string;
  status: OfferStatus;
  slotId: string;
  slotLabel: string;
  terms: OfferTerms;
  /** Rows the participant must be able to see before the PayPal button, in order. */
  termsRows: Array<{ label: string; value: string }>;
  consent: ConsentCopyView;
  /** Whether the current participant's confirmed preference fits this offer. */
  viewerIncluded: boolean;
  viewerConsented: boolean;
  authDeadlineLabel: string;
  isOpen: boolean;
}

/* -------------------------------- payments ------------------------------- */

export interface PaymentView {
  id: string;
  participantId: string;
  participantName: string;
  status: PaymentStatus;
  statusLabel: string;
  providerStatus: string | null;
  amountCents: number;
  amountLabel: string;
  orderId: string | null;
  authorizationId: string | null;
  captureId: string | null;
  refundId: string | null;
  approveUrl: string | null;
  simulated: boolean;
  isMine: boolean;
  updatedAt: IsoUtc;
}

export interface BatchLineView {
  participantId: string;
  participantName: string;
  amountCents: number;
  amountLabel: string;
  status: PaymentStatus;
  statusLabel: string;
  captureId: string | null;
  refundId: string | null;
  detail: string;
}

export interface BatchView {
  id: string;
  status: BatchStatus;
  expectedParticipantCount: number;
  expectedCents: number;
  capturedCents: number;
  refundedCents: number;
  expectedLabel: string;
  capturedLabel: string;
  refundedLabel: string;
  deadlineUtc: IsoUtc;
  deadlineLabel: string;
  reason: string | null;
  lines: BatchLineView[];
}

/* --------------------------------- result -------------------------------- */

export interface ResultView {
  outcome: 'CONFIRMED' | 'NOT_CONFIRMED' | 'PENDING' | 'NEEDS_ATTENTION';
  headline: string;
  detail: string;
  lines: BatchLineView[];
  capturedLabel: string;
  refundedLabel: string;
  pendingActionCount: number;
}

/* ------------------------------- audit trail ----------------------------- */

export interface AuditView {
  id: string;
  actorKind: ActorKind;
  actorRef: string;
  type: string;
  subjectId: string | null;
  summary: string;
  createdAt: IsoUtc;
  createdAtLabel: string;
}

/* ------------------------------ demo / checkout -------------------------- */

export interface CheckoutView {
  paymentId: string;
  orderId: string;
  approveUrl: string;
  amountLabel: string;
  simulated: boolean;
  /** Present when PayPal is simulated; the UI uses it to finish the sandbox stand-in. */
  simulatedApprovePath: string | null;
}

export interface DemoView {
  /** Synthetic tenants may switch roles; real tenants may not. */
  canSwitchRoles: boolean;
  participantCount: number;
  sampleLoaded: boolean;
}

/* --------------------------------- notices ------------------------------- */

export interface NoticeView {
  kind: 'info' | 'warn' | 'error';
  message: string;
}

/* ------------------------------- AppState -------------------------------- */

export interface AppState {
  mode: ModeView;
  session: SessionView;
  nowUtc: IsoUtc;
  workshop: WorkshopView | null;
  participants: ParticipantView[];
  preferences: PreferenceView[];
  plan: PlanView | null;
  clarifications: ClarificationView[];
  offer: OfferView | null;
  payments: PaymentView[];
  batch: BatchView | null;
  result: ResultView | null;
  audit: AuditView[];
  checkout: CheckoutView | null;
  demo: DemoView;
  notice: NoticeView | null;
}

/* ------------------------------- requests -------------------------------- */

export interface CreateWorkshopRequest {
  /** When true the server builds the fixed synthetic demo workshop relative to now. */
  sample?: boolean;
  draft?: {
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
  };
}

export interface ParsePreferencesRequest {
  sourceText: string;
  /** Optional structured path (no AI needed): times the person ticked. */
  structured?: {
    acceptedSlotIds: string[];
    preferredSlotIds: string[];
    conditions: Array<{ slotId: string; condition: string }>;
  };
}

export interface ConfirmPreferencesRequest {
  version: number;
  acceptedSlotIds: string[];
  preferredSlotIds: string[];
  conditions: Array<{ slotId: string; condition: string; sourceQuote: string }>;
  uncertainties: Array<{ field: string; question: string; sourceQuote: string }>;
}

export interface AnswerClarificationRequest {
  answer: 'YES' | 'NO';
}

export interface PublishOfferRequest {
  slotId: string;
}

export interface StartCheckoutRequest {
  participantId?: string;
  /** Must be true: the unchecked checkbox is validated server-side, not just in the browser. */
  consent: boolean;
}

export interface DemoViewRequest {
  participantId: string | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Array<{ field: string; message: string }>;
  };
}
