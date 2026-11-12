/* ==========================================================================
   State-transition and capture guards (CONTRACT §3.4)

   Safety decisions:
   - Terminal states never regress: a CONFIRMED workshop cannot go back to
     collecting interest, and a REFUNDED payment cannot become CAPTURED again.
     Provider statuses that arrive late or out of order must never be read as a
     success we already reported.
   - `captureGuard` is the single gate in front of PayPal capture. It requires
     ALL of: status AUTHORIZED, authorization younger than 48 hours, deadline
     not passed, offer still open, and no withdrawal. Anything unknown is a
     refusal, never an optimistic pass.
   - Times come from injected ISO strings; the module never reads the wall
     clock, so every guard path is deterministic and testable.
   ========================================================================== */

import { hoursBetween } from '../../shared/time.js';
import type { PaymentStatus, WorkshopStatus } from '../../shared/types.js';

/** Allowed forward transitions. Same-state is allowed (idempotent re-observe). */
const WORKSHOP_TRANSITIONS: Readonly<Partial<Record<WorkshopStatus, readonly WorkshopStatus[]>>> = {
  DRAFT: ['COLLECTING_INTEREST', 'CANCELLED'],
  COLLECTING_INTEREST: ['CLARIFYING', 'OFFER_OPEN', 'CANCELLED'],
  CLARIFYING: ['COLLECTING_INTEREST', 'OFFER_OPEN', 'CANCELLED'],
  OFFER_OPEN: ['CLARIFYING', 'SETTLING', 'CANCELLED'],
  SETTLING: ['CONFIRMED', 'CANCELLING', 'COMPENSATING', 'MANUAL_REVIEW'],
  CANCELLING: ['CANCELLED', 'COMPENSATING', 'MANUAL_REVIEW'],
  COMPENSATING: ['CANCELLED', 'MANUAL_REVIEW'],
  MANUAL_REVIEW: ['CONFIRMED', 'CANCELLING', 'COMPENSATING', 'CANCELLED'],
  CONFIRMED: [],
  CANCELLED: [],
};

const PAYMENT_TRANSITIONS: Readonly<Partial<Record<PaymentStatus, readonly PaymentStatus[]>>> = {
  NONE: ['ORDER_CREATED', 'FAILED'],
  ORDER_CREATED: ['APPROVED', 'FAILED', 'UNKNOWN'],
  APPROVED: ['AUTHORIZING', 'FAILED', 'UNKNOWN'],
  AUTHORIZING: ['AUTHORIZED', 'FAILED', 'UNKNOWN'],
  AUTHORIZED: ['CAPTURING', 'VOIDING', 'FAILED', 'UNKNOWN'],
  CAPTURING: ['CAPTURED', 'FAILED', 'UNKNOWN'],
  CAPTURED: ['REFUNDING'],
  VOIDING: ['VOIDED', 'FAILED', 'UNKNOWN'],
  VOIDED: [],
  REFUNDING: ['REFUNDED', 'FAILED', 'UNKNOWN', 'MANUAL_REVIEW'],
  REFUNDED: [],
  FAILED: [],
  // An UNKNOWN provider outcome is never treated as success. It must be
  // reconciled (query) or resolved by a human before any further transition.
  UNKNOWN: ['MANUAL_REVIEW'],
  MANUAL_REVIEW: ['AUTHORIZED', 'CAPTURED', 'VOIDED', 'REFUNDED', 'FAILED', 'MANUAL_REVIEW'],
};

function allowed<T extends string>(
  table: Readonly<Partial<Record<T, readonly T[]>>>,
  from: T,
  to: T,
): boolean {
  if (from === to) return true; // idempotent re-observation, never a regression
  return (table[from] ?? []).includes(to);
}

export function canTransitionWorkshop(from: WorkshopStatus, to: WorkshopStatus): boolean {
  return allowed(WORKSHOP_TRANSITIONS, from, to);
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return allowed(PAYMENT_TRANSITIONS, from, to);
}

export interface CaptureGuardInput {
  paymentStatus: PaymentStatus;
  authorizedAt: string | null;
  nowUtc: string;
  offerOpen: boolean;
  deadlineUtc: string;
  withdrawn: boolean;
}

export interface CaptureGuardResult {
  allowed: boolean;
  reason: string;
}

const MAX_AUTHORIZATION_HOURS = 48;

/**
 * The single deterministic gate in front of a capture. Returns a reason in both
 * directions so logs and the UI can state exactly why money did or did not move.
 */
export function captureGuard(input: CaptureGuardInput): CaptureGuardResult {
  if (input.paymentStatus !== 'AUTHORIZED') {
    return {
      allowed: false,
      reason: `payment status is ${input.paymentStatus}; only an AUTHORIZED payment can be captured`,
    };
  }
  if (!input.authorizedAt) {
    return { allowed: false, reason: 'the PayPal authorization time is unknown' };
  }
  const authorizedMs = Date.parse(input.authorizedAt);
  const nowMs = Date.parse(input.nowUtc);
  const deadlineMs = Date.parse(input.deadlineUtc);
  if (Number.isNaN(authorizedMs)) {
    return { allowed: false, reason: 'the PayPal authorization time is not a valid instant' };
  }
  if (Number.isNaN(nowMs)) {
    return { allowed: false, reason: 'the current time is not a valid instant' };
  }
  if (Number.isNaN(deadlineMs)) {
    return { allowed: false, reason: 'the authorization deadline is not a valid instant' };
  }

  const ageHours = hoursBetween(input.authorizedAt, input.nowUtc);
  if (ageHours < 0) {
    return { allowed: false, reason: 'the authorization time is in the future' };
  }
  if (ageHours >= MAX_AUTHORIZATION_HOURS) {
    return {
      allowed: false,
      reason: `the authorization is ${ageHours.toFixed(1)} hours old; PayPal captures are limited to under ${MAX_AUTHORIZATION_HOURS} hours`,
    };
  }
  if (input.withdrawn) {
    return { allowed: false, reason: 'the participant has withdrawn from this plan' };
  }
  if (!input.offerOpen) {
    return { allowed: false, reason: 'the offer is no longer open' };
  }
  if (nowMs >= deadlineMs) {
    return { allowed: false, reason: 'the authorization deadline has passed' };
  }
  return {
    allowed: true,
    reason: `authorization is ${ageHours.toFixed(1)} hours old, the offer is open and the deadline has not passed`,
  };
}
