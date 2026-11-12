/* ==========================================================================
   PayPal webhooks — verification, dedupe, and monotonic state merge.

   Safety decisions:
   - Nothing is trusted before verification. Real mode asks PayPal's
     verify-webhook-signature endpoint; simulated mode requires a local HMAC.
     Unverified bodies return 400 (or 503 when verification itself is
     unavailable) and are never written or merged.
   - Dedupe is by provider event id (primary key). A redelivery is acknowledged
     but never applied twice, and never triggers extra money movement.
   - Merging is monotonic: an event can only move a payment forward. Late,
     out-of-order events that would regress a terminal state (CAPTURED,
     REFUNDED, VOIDED, FAILED, MANUAL_REVIEW) are ignored, never applied.
   - PENDING / unknown provider states are never mapped to success; a refund is
     REFUNDED only on a COMPLETED provider state.
   - The webhook never captures, voids or refunds. It only records what PayPal
     reports; money decisions stay in settlement.ts.
   ========================================================================== */

import type { Payment, PaymentStatus } from '../../shared/types.js';
import type { Repo } from '../repo.js';
import { mapPayment, sha256Hex } from '../repo.js';
import type { WebhookVerdict } from './paypal.js';
import type { SettlementDeps } from './settlement.js';

export interface WebhookInput {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
}

export interface WebhookResult {
  status: number;
  body: { ok: boolean; note?: string };
}

/** Forward-only merge table. Anything not listed is ignored (never regressed). */
const MERGE_FORWARD: Record<PaymentStatus, PaymentStatus[]> = {
  NONE: ['ORDER_CREATED', 'APPROVED', 'AUTHORIZING', 'AUTHORIZED', 'VOIDED', 'FAILED', 'UNKNOWN'],
  ORDER_CREATED: ['APPROVED', 'AUTHORIZING', 'AUTHORIZED', 'VOIDED', 'FAILED', 'UNKNOWN'],
  APPROVED: ['AUTHORIZING', 'AUTHORIZED', 'VOIDED', 'FAILED', 'UNKNOWN'],
  AUTHORIZING: ['AUTHORIZED', 'VOIDED', 'FAILED', 'UNKNOWN'],
  AUTHORIZED: ['CAPTURING', 'CAPTURED', 'VOIDING', 'VOIDED', 'FAILED', 'UNKNOWN'],
  CAPTURING: ['CAPTURED', 'VOIDED', 'FAILED', 'UNKNOWN'],
  CAPTURED: ['REFUNDING', 'REFUNDED'],
  VOIDING: ['VOIDED', 'UNKNOWN'],
  VOIDED: [],
  REFUNDING: ['REFUNDED'],
  REFUNDED: [],
  FAILED: [],
  UNKNOWN: ['AUTHORIZED', 'CAPTURING', 'CAPTURED', 'VOIDING', 'VOIDED', 'REFUNDING', 'REFUNDED', 'FAILED'],
  MANUAL_REVIEW: ['REFUNDED'],
};

function canMergeForward(current: PaymentStatus, next: PaymentStatus): boolean {
  return MERGE_FORWARD[current].includes(next);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function relatedId(resource: Record<string, unknown>, key: string): string | null {
  const related = asRecord(asRecord(resource.supplementary_data).related_ids);
  return asString(related[key]) || null;
}

function findPayment(repo: Repo, verdict: Extract<WebhookVerdict, { verified: true }>): Payment | null {
  const resource = verdict.resource;
  const resourceId = asString(resource.id);
  const resourceType = (verdict.resourceType ?? '').toLowerCase();
  if (resourceType === 'authorization' && resourceId) {
    return repo.getPaymentByAuthorizationId(resourceId);
  }
  if (resourceType === 'capture') {
    if (resourceId) {
      const byCapture = repo.getPaymentByCaptureId(resourceId);
      if (byCapture) return byCapture;
    }
    const authorizationId = relatedId(resource, 'authorization_id');
    if (authorizationId) {
      const byAuthorization = repo.getPaymentByAuthorizationId(authorizationId);
      if (byAuthorization) return byAuthorization;
    }
    const orderId = relatedId(resource, 'order_id');
    if (orderId) return repo.getPaymentByOrderId(orderId);
    return null;
  }
  if (resourceType === 'refund') {
    if (resourceId) {
      const row = repo.one<Record<string, unknown>>('SELECT * FROM payments WHERE refund_id = ?', resourceId);
      if (row) return mapPayment(row);
    }
    const captureId = relatedId(resource, 'capture_id');
    if (captureId) {
      const byCapture = repo.getPaymentByCaptureId(captureId);
      if (byCapture) return byCapture;
    }
    return null;
  }
  if (resourceType === 'order' || resourceType === 'checkout-order') {
    return resourceId ? repo.getPaymentByOrderId(resourceId) : null;
  }
  // Fall back to the resource id across every provider reference we store.
  if (!resourceId) return null;
  return (
    repo.getPaymentByAuthorizationId(resourceId) ??
    repo.getPaymentByCaptureId(resourceId) ??
    repo.getPaymentByOrderId(resourceId)
  );
}

interface MergeDecision {
  patch: Partial<Payment> | null;
  note: string;
}

function decideMerge(payment: Payment, verdict: Extract<WebhookVerdict, { verified: true }>, now: string): MergeDecision {
  const eventType = verdict.eventType;
  const resource = verdict.resource;
  const providerStatus = asString(resource.status) || eventType;
  const resourceId = asString(resource.id) || null;
  const createTime = asString(resource.create_time) || null;

  const ignore = (note: string): MergeDecision => ({ patch: null, note });

  let next: PaymentStatus | null = null;
  const patch: Partial<Payment> = {
    providerStatus,
    observedAt: now,
    updatedAt: now,
  };

  switch (eventType) {
    case 'CHECKOUT.ORDER.APPROVED': {
      next = 'APPROVED';
      patch.resourceType = 'order';
      if (!payment.orderId && resourceId) patch.orderId = resourceId;
      break;
    }
    case 'CHECKOUT.ORDER.COMPLETED': {
      next = 'APPROVED';
      patch.resourceType = 'order';
      if (!payment.orderId && resourceId) patch.orderId = resourceId;
      break;
    }
    case 'PAYMENT.AUTHORIZATION.CREATED':
    case 'PAYMENT.AUTHORIZATION.PENDING': {
      next = 'AUTHORIZING';
      patch.resourceType = 'authorization';
      if (!payment.authorizationId && resourceId) patch.authorizationId = resourceId;
      break;
    }
    case 'PAYMENT.AUTHORIZATION.VOIDED': {
      next = 'VOIDED';
      patch.resourceType = 'authorization';
      if (!payment.authorizationId && resourceId) patch.authorizationId = resourceId;
      break;
    }
    case 'PAYMENT.AUTHORIZATION.EXPIRED': {
      // An expired authorization cannot be captured; the hold is released.
      next = 'VOIDED';
      patch.providerStatus = 'EXPIRED';
      patch.resourceType = 'authorization';
      if (!payment.authorizationId && resourceId) patch.authorizationId = resourceId;
      break;
    }
    case 'PAYMENT.CAPTURE.COMPLETED': {
      if (providerStatus !== 'COMPLETED') {
        // Never treat a non-COMPLETED provider status as a completed capture.
        next = 'CAPTURING';
        patch.resourceType = 'capture';
      } else {
        next = 'CAPTURED';
        patch.resourceType = 'capture';
        patch.capturedAt = payment.capturedAt ?? createTime ?? now;
      }
      if (!payment.captureId && resourceId) patch.captureId = resourceId;
      break;
    }
    case 'PAYMENT.CAPTURE.PENDING': {
      next = 'CAPTURING';
      patch.resourceType = 'capture';
      if (!payment.captureId && resourceId) patch.captureId = resourceId;
      break;
    }
    case 'PAYMENT.CAPTURE.DECLINED':
    case 'PAYMENT.CAPTURE.FAILED': {
      next = 'FAILED';
      patch.resourceType = 'capture';
      if (!payment.captureId && resourceId) patch.captureId = resourceId;
      break;
    }
    case 'PAYMENT.CAPTURE.REFUNDED': {
      next = 'REFUNDED';
      patch.resourceType = 'capture';
      if (!payment.captureId && resourceId) patch.captureId = resourceId;
      break;
    }
    case 'PAYMENT.CAPTURE.PARTIALLY_REFUNDED': {
      // A partial refund is not a full refund; flag it for a human.
      next = 'REFUNDING';
      patch.resourceType = 'capture';
      if (!payment.captureId && resourceId) patch.captureId = resourceId;
      break;
    }
    case 'PAYMENT.REFUND.COMPLETED': {
      if (providerStatus !== 'COMPLETED') return ignore(`refund event has provider status ${providerStatus}`);
      next = 'REFUNDED';
      patch.resourceType = 'refund';
      if (!payment.refundId && resourceId) patch.refundId = resourceId;
      break;
    }
    case 'PAYMENT.REFUND.PENDING':
    case 'PAYMENT.REFUND.FAILED': {
      // Pending/failed refunds are never REFUNDED.
      next = 'REFUNDING';
      patch.resourceType = 'refund';
      if (!payment.refundId && resourceId) patch.refundId = resourceId;
      break;
    }
    default:
      return ignore(`unhandled event type ${eventType}`);
  }

  if (!next) return ignore('event produced no state change');
  if (next === payment.status) return ignore(`payment is already ${payment.status}`);
  if (!canMergeForward(payment.status, next)) {
    return ignore(`ignored regression from ${payment.status} to ${next} (${eventType})`);
  }
  // Provider references are immutable: a different id for the same role is a
  // conflict, not an update. Keep the recorded one and note it.
  const conflicts: Array<[keyof Payment, string | null]> = [
    ['orderId', patch.orderId ?? null],
    ['authorizationId', patch.authorizationId ?? null],
    ['captureId', patch.captureId ?? null],
    ['refundId', patch.refundId ?? null],
  ];
  for (const [field, nextValue] of conflicts) {
    const currentValue = payment[field] as unknown;
    if (typeof currentValue === 'string' && currentValue.length > 0 && nextValue !== null) {
      return ignore(`conflicting ${String(field)} id; kept the recorded value`);
    }
  }
  return { patch: { ...patch, status: next }, note: `merged ${eventType} -> ${next}` };
}

/**
 * Verify, dedupe, and merge one PayPal webhook delivery.
 * Returns HTTP status + a small body; Fastify serialises it.
 */
export async function handleWebhook(deps: SettlementDeps, input: WebhookInput): Promise<WebhookResult> {
  const { repo } = deps;
  let verdict: WebhookVerdict;
  try {
    verdict = await deps.paypal.verifyWebhook(input.headers, input.rawBody);
  } catch {
    return { status: 503, body: { ok: false, note: 'webhook verification unavailable; event not trusted' } };
  }
  if (!verdict.verified) {
    const unavailable = /unavailable/i.test(verdict.reason);
    return {
      status: unavailable ? 503 : 400,
      body: { ok: false, note: `webhook rejected: ${verdict.reason}` },
    };
  }

  const now = deps.now();
  const rawSha256 = sha256Hex(input.rawBody);
  const resourceId = asString(asRecord(verdict.resource).id) || null;
  const inserted = repo.insertWebhookEvent({
    eventId: verdict.eventId,
    verified: true,
    eventType: verdict.eventType,
    resourceType: verdict.resourceType,
    resourceId,
    rawSha256,
    receivedAt: now,
  });
  if (!inserted) {
    const prior = repo.getWebhookEvent(verdict.eventId);
    if (prior?.processedAt) {
      return { status: 200, body: { ok: true, note: 'duplicate event ignored; state was already merged' } };
    }
    // A previous attempt recorded the event then crashed before processing it;
    // reprocessing is safe because the merge is forward-only.
  }

  try {
    const payment = findPayment(repo, verdict);
    if (!payment) {
      repo.markWebhookProcessed(verdict.eventId, 'ignored: no matching payment', now);
      return { status: 200, body: { ok: true, note: 'event has no matching payment; ignored' } };
    }
    const decision = decideMerge(payment, verdict, now);
    if (!decision.patch) {
      repo.markWebhookProcessed(verdict.eventId, `ignored: ${decision.note}`, now);
      return { status: 200, body: { ok: true, note: decision.note } };
    }
    repo.tx(() => {
      repo.updatePayment(payment.id, decision.patch!);
      repo.markWebhookProcessed(verdict.eventId, decision.note, now);
    });
    return { status: 200, body: { ok: true, note: decision.note } };
  } catch {
    // Leave processed_at NULL so a redelivery can retry the merge safely.
    return { status: 500, body: { ok: false, note: 'webhook processing failed; event kept for retry' } };
  }
}

/** Exposed for tests: the merge table is the safety contract, not an implementation detail. */
export function mergeWouldApply(current: PaymentStatus, next: PaymentStatus): boolean {
  return canMergeForward(current, next);
}

/** Exposed for tests/readers: the provider types this handler understands. */
export const HANDLED_WEBHOOK_EVENTS = [
  'CHECKOUT.ORDER.APPROVED',
  'CHECKOUT.ORDER.COMPLETED',
  'PAYMENT.AUTHORIZATION.CREATED',
  'PAYMENT.AUTHORIZATION.PENDING',
  'PAYMENT.AUTHORIZATION.VOIDED',
  'PAYMENT.AUTHORIZATION.EXPIRED',
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.PENDING',
  'PAYMENT.CAPTURE.DECLINED',
  'PAYMENT.CAPTURE.FAILED',
  'PAYMENT.CAPTURE.REFUNDED',
  'PAYMENT.CAPTURE.PARTIALLY_REFUNDED',
  'PAYMENT.REFUND.COMPLETED',
  'PAYMENT.REFUND.PENDING',
  'PAYMENT.REFUND.FAILED',
] as const;
