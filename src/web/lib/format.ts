/* ==========================================================================
   Display helpers. Money is integer cents everywhere; formatting never turns a
   display string back into a number. Every state that carries a colour in the
   UI also carries one of these words (colour is never the only signal).
   ========================================================================== */

import type { AppState } from '../../shared/api.js';
import type {
  BatchStatus,
  ClarificationStatus,
  OfferStatus,
  PaymentStatus,
  PreferenceStatus,
  WorkshopStatus,
} from '../../shared/types.js';
import { partsInZone, zonedTimeToUtc } from '../../shared/time.js';

export function formatCents(cents: number): string {
  const safe = Number.isInteger(cents) ? cents : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = String(abs % 100).padStart(2, '0');
  return `${sign}$${whole}.${fraction}`;
}

/**
 * Parse a user-typed price ("45", "45.5", "45.50") into integer cents using
 * integer arithmetic only. Returns null when the text is not a plain amount.
 */
export function parseDollarsToCents(input: string): number | null {
  const text = input.trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return null;
  const [wholePart, fractionPart = ''] = text.split('.');
  const whole = Number(wholePart);
  const fraction = Number(fractionPart.padEnd(2, '0'));
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(fraction)) return null;
  const cents = whole * 100 + fraction;
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

/** "4432" → "1h 13m". Short, honest, no jitter. */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export interface CountdownView {
  expired: boolean;
  label: string;
  detail: string;
}

/**
 * Countdown derived from the server's UTC instant, not the wall clock of the
 * device. `fetchedAtMs` is when the state snapshot arrived, so elapsed client
 * time is added to the server's `nowUtc`.
 */
export function countdownFor(
  deadlineUtc: string | null | undefined,
  serverNowUtc: string | null | undefined,
  fetchedAtMs: number,
  clientNowMs = Date.now(),
): CountdownView {
  if (!deadlineUtc) return { expired: false, label: '—', detail: 'No authorization deadline set yet.' };
  const deadlineMs = Date.parse(deadlineUtc);
  if (Number.isNaN(deadlineMs)) return { expired: false, label: '—', detail: 'Deadline unavailable.' };
  const serverNowMs = serverNowUtc && !Number.isNaN(Date.parse(serverNowUtc)) ? Date.parse(serverNowUtc) : fetchedAtMs;
  const nowMs = serverNowMs + Math.max(0, clientNowMs - fetchedAtMs);
  const remaining = deadlineMs - nowMs;
  return {
    expired: remaining <= 0,
    label: formatRemaining(remaining),
    detail: remaining <= 0 ? 'The authorization window has closed.' : 'until the authorization window closes',
  };
}

/* ------------------------------ status words ----------------------------- */

export type Tone = 'neutral' | 'progress' | 'success' | 'warning' | 'danger' | 'info';

export const preferenceStatusWord: Record<PreferenceStatus, string> = {
  DRAFT: 'Not confirmed yet',
  NEEDS_CLARIFICATION: 'Needs clarification',
  CONFIRMED: 'Confirmed',
  WITHDRAWN: 'Withdrawn',
};

export const paymentStatusWord: Record<PaymentStatus, string> = {
  NONE: 'Not started',
  ORDER_CREATED: 'Order created — awaiting approval',
  APPROVED: 'Approved — authorizing',
  AUTHORIZING: 'Authorizing',
  AUTHORIZED: 'Authorized — not charged yet',
  CAPTURING: 'Collecting',
  CAPTURED: 'Captured',
  VOIDING: 'Releasing hold',
  VOIDED: 'Hold released (voided)',
  REFUNDING: 'Refund requested — awaiting confirmation',
  REFUNDED: 'Refunded',
  FAILED: 'Failed — nothing captured',
  UNKNOWN: 'Unknown — checking payment state',
  MANUAL_REVIEW: 'Needs manual attention',
};

export const offerStatusWord: Record<OfferStatus, string> = {
  DRAFT: 'Draft',
  OPEN: 'Open for authorization',
  CLOSED: 'Closed',
  SETTLED: 'Settled',
  CANCELLED: 'Cancelled',
};

export const batchStatusWord: Record<BatchStatus, string> = {
  LOCKED: 'Locked — waiting for capture',
  CAPTURING: 'Collecting',
  CONFIRMED: 'Confirmed',
  COMPENSATING: 'Compensating',
  CANCELLED: 'Cancelled',
  MANUAL_REVIEW: 'Needs manual attention',
};

export const workshopStatusWord: Record<WorkshopStatus, string> = {
  DRAFT: 'Draft',
  COLLECTING_INTEREST: 'Collecting interest',
  CLARIFYING: 'Clarifying conditions',
  OFFER_OPEN: 'Offer open',
  SETTLING: 'Collecting',
  CONFIRMED: 'Confirmed',
  CANCELLING: 'Cancelling',
  CANCELLED: 'Cancelled',
  COMPENSATING: 'Compensating',
  MANUAL_REVIEW: 'Needs manual attention',
};

export const clarificationStatusWord: Record<ClarificationStatus, string> = {
  PROPOSED: 'Proposed — not sent yet',
  SENT: 'Waiting for an answer',
  ANSWERED_YES: 'Answered yes',
  ANSWERED_NO: 'Answered no',
  CANCELLED: 'Cancelled',
};

const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  NONE: 'neutral',
  ORDER_CREATED: 'progress',
  APPROVED: 'progress',
  AUTHORIZING: 'progress',
  AUTHORIZED: 'success',
  CAPTURING: 'progress',
  CAPTURED: 'success',
  VOIDING: 'progress',
  VOIDED: 'neutral',
  REFUNDING: 'progress',
  REFUNDED: 'success',
  FAILED: 'danger',
  UNKNOWN: 'warning',
  MANUAL_REVIEW: 'danger',
};

export function paymentTone(status: PaymentStatus): Tone {
  return PAYMENT_TONE[status];
}

export function batchTone(status: BatchStatus): Tone {
  switch (status) {
    case 'LOCKED':
      return 'info';
    case 'CAPTURING':
      return 'progress';
    case 'CONFIRMED':
      return 'success';
    case 'CANCELLED':
      return 'neutral';
    case 'COMPENSATING':
      return 'warning';
    case 'MANUAL_REVIEW':
      return 'danger';
    default:
      return 'neutral';
  }
}

/* --------------------------- funding timeline ---------------------------- */

export const FUNDING_STEPS = ['Awaiting approval', 'Authorized', 'Collecting', 'Captured'] as const;

export interface FundingStage {
  /** 0..3 index into FUNDING_STEPS; the furthest step this status reached. */
  step: number;
  /** `progress` means the step is happening now. */
  state: 'done' | 'current' | 'blocked';
  word: string;
  tone: Tone;
  ended: 'voided' | 'refunding' | 'attention' | null;
}

export function fundingStage(status: PaymentStatus): FundingStage {
  const word = paymentStatusWord[status];
  const tone = paymentTone(status);
  switch (status) {
    case 'NONE':
      return { step: 0, state: 'current', word, tone: 'neutral', ended: null };
    case 'ORDER_CREATED':
    case 'APPROVED':
      return { step: 0, state: 'current', word, tone, ended: null };
    case 'AUTHORIZING':
    case 'AUTHORIZED':
      return { step: 1, state: status === 'AUTHORIZED' ? 'done' : 'current', word, tone, ended: null };
    case 'CAPTURING':
      return { step: 2, state: 'current', word, tone, ended: null };
    case 'CAPTURED':
      return { step: 3, state: 'done', word, tone, ended: null };
    case 'VOIDING':
      return { step: 1, state: 'current', word, tone, ended: 'voided' };
    case 'VOIDED':
      return { step: 1, state: 'blocked', word, tone, ended: 'voided' };
    case 'REFUNDING':
      return { step: 3, state: 'current', word, tone, ended: 'refunding' };
    case 'REFUNDED':
      return { step: 3, state: 'blocked', word, tone, ended: 'refunding' };
    case 'FAILED':
      return { step: 3, state: 'blocked', word, tone, ended: 'attention' };
    case 'UNKNOWN':
    case 'MANUAL_REVIEW':
      return { step: 3, state: 'blocked', word, tone, ended: 'attention' };
    default:
      return { step: 0, state: 'current', word, tone, ended: null };
  }
}

/* ------------------------------- polling --------------------------------- */

const IN_FLIGHT: PaymentStatus[] = [
  'ORDER_CREATED',
  'APPROVED',
  'AUTHORIZING',
  'CAPTURING',
  'VOIDING',
  'REFUNDING',
  'UNKNOWN',
];

/**
 * The UI re-reads GET /api/state every 4s only while a money state is actually
 * moving, or right after the browser returned from PayPal. Everything else is
 * driven by an explicit action response.
 */
export function needsMoneyPolling(state: AppState | null): boolean {
  if (!state) return false;
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('gr_awaiting_paypal') === '1') {
    const mine = state.payments.find((p) => p.isMine);
    if (!mine || IN_FLIGHT.includes(mine.status) || mine.status === 'NONE') return true;
  }
  if (state.payments.some((p) => IN_FLIGHT.includes(p.status))) return true;
  if (state.batch && (state.batch.status === 'CAPTURING' || state.batch.status === 'COMPENSATING')) return true;
  if (state.result && state.result.outcome === 'PENDING') return true;
  return false;
}

/* ----------------------------- misc helpers ------------------------------ */

export function isIanaTimezone(value: string): boolean {
  if (!value || value.trim() !== value) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * `<input type="datetime-local">` value for an instant, rendered as wall time in
 * the workshop's IANA zone (not the browser's), so the organizer edits the same
 * clock the participants read.
 */
export function zoneInputFromIso(instantUtc: string, timezone: string): string {
  try {
    const p = partsInZone(instantUtc, timezone);
    return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
  } catch {
    return '';
  }
}

/** Inverse of `zoneInputFromIso`. Returns null for an unreadable value. */
export function isoFromZoneInput(value: string, timezone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  try {
    return zonedTimeToUtc({
      timezone,
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
    });
  } catch {
    return null;
  }
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function shortId(id: string | null): string {
  if (!id) return '—';
  return id.length > 14 ? `${id.slice(0, 10)}…` : id;
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(' ');
}
