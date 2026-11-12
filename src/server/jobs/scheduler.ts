/* ==========================================================================
   Settlement scheduler — the safety net that runs without a browser.

   On boot and every 30 seconds:
   1. Any workshop still OFFER_OPEN past its authorization deadline is
      cancelled: authorized holds are voided (idempotent operations), orders
      that never authorized are marked FAILED (no money can move), and the
      workshop/offer are marked CANCELLED with an audit event.
   2. recoverPending() reconciles anything a crash or timeout left in flight.

   It deliberately does not use `setTimeout` chains, does not overlap ticks, and
   does not loop unboundedly: each payment action is capped by the operations
   attempt limit, and a locked batch that expired is compensated exactly like
   any failed batch. Unknown provider outcomes end in MANUAL_REVIEW, never in a
   fake success.
   ========================================================================== */

import type { AuditEvent, IsoUtc, Payment } from '../../shared/types.js';
import { newId } from '../repo.js';
import { compensateBatch, recoverPending, voidAuthorizedPayment, type RecoverySummary, type SettlementDeps } from '../payments/settlement.js';

export interface SchedulerOptions {
  /** Default 30_000. Values below 1s are clamped so a demo cannot spin. */
  intervalMs?: number;
  /** Synthetic demo tenants older than this are deleted (brief §9). Default 7 days. */
  retentionDays?: number;
}

export interface SchedulerTickResult {
  cancelledOffers: number;
  voidedPayments: number;
  manualReview: number;
  purgedTenants: number;
  recovery: RecoverySummary;
}

function auditScheduler(
  deps: SettlementDeps,
  input: { tenantId: string; workshopId: string; type: string; subjectId: string | null; payload: Record<string, unknown> },
): void {
  const event: AuditEvent = {
    id: newId('aud'),
    tenantId: input.tenantId,
    actorKind: 'SYSTEM',
    actorRef: 'scheduler',
    workshopId: input.workshopId,
    type: input.type,
    subjectId: input.subjectId,
    payload: input.payload,
    createdAt: deps.now(),
  };
  deps.repo.insertAudit(event);
}

/** Void/fail every payment of an expired, never-locked offer. Bounded by design. */
async function cancelExpiredOffer(
  deps: SettlementDeps,
  input: { workshopId: string; tenantId: string; now: IsoUtc },
): Promise<{ handled: boolean; voided: number; failed: number; manualReview: number }> {
  const { repo } = deps;
  const offer = repo.getOpenOffer(input.workshopId) ?? repo.getLatestOffer(input.workshopId);
  if (!offer) return { handled: false, voided: 0, failed: 0, manualReview: 0 };

  const batch = repo.getBatchByOffer(offer.id);
  if (batch) {
    // A batch means the money path owns the transition; settlement handles it.
    if (batch.status === 'LOCKED' && input.now >= batch.deadlineUtc) {
      const compensated = await compensateBatch(deps, batch.id, 'authorization deadline passed before capture');
      return {
        handled: true,
        voided: 0,
        failed: 0,
        manualReview: compensated.batch.status === 'MANUAL_REVIEW' ? 1 : 0,
      };
    }
    return { handled: false, voided: 0, failed: 0, manualReview: 0 };
  }

  const scopeId = `${offer.id}:EXPIRED`;
  let voided = 0;
  let failed = 0;
  let manualReview = 0;
  for (const payment of repo.listPaymentsByOffer(offer.id)) {
    if (payment.status === 'VOIDED' || payment.status === 'FAILED' || payment.status === 'REFUNDED') continue;
    if (payment.status === 'AUTHORIZED' && payment.authorizationId) {
      const outcome = await voidAuthorizedPayment(deps, {
        scopeId,
        workshopId: input.workshopId,
        tenantId: input.tenantId,
        payment,
      });
      if (outcome === 'voided') voided += 1;
      else if (outcome === 'manual') manualReview += 1;
      continue;
    }
    if (payment.status === 'ORDER_CREATED' || payment.status === 'APPROVED' || payment.status === 'AUTHORIZING') {
      // No authorization means no money can move.
      repo.updatePayment(payment.id, { status: 'FAILED', providerStatus: 'EXPIRED', updatedAt: input.now });
      failed += 1;
      continue;
    }
    // VOIDING / CAPTURING / UNKNOWN / MANUAL_REVIEW: do not guess.
    manualReview += 1;
  }

  const final = repo.listPaymentsByOffer(offer.id);
  const unresolved = final.some((payment: Payment) =>
    ['AUTHORIZED', 'VOIDING', 'CAPTURING', 'UNKNOWN', 'MANUAL_REVIEW'].includes(payment.status),
  );
  const now = deps.now();
  deps.repo.tx(() => {
    repo.updateWorkshopStatus(input.workshopId, unresolved ? 'MANUAL_REVIEW' : 'CANCELLED', now);
    repo.updateOfferStatus(offer.id, 'CANCELLED', now);
  });
  auditScheduler(deps, {
    tenantId: input.tenantId,
    workshopId: input.workshopId,
    type: unresolved ? 'offer.expired_manual_review' : 'offer.expired_cancelled',
    subjectId: offer.id,
    payload: {
      voided,
      failed,
      manualReview,
      paymentStatuses: final.map((payment) => `${payment.id}:${payment.status}`),
    },
  });
  return { handled: true, voided, failed, manualReview };
}

/** One scheduler pass. Exported so tests can run it with an injected clock. */
export async function runSchedulerTick(
  deps: SettlementDeps,
  opts: { retentionDays?: number } = {},
): Promise<SchedulerTickResult> {
  const result: SchedulerTickResult = {
    cancelledOffers: 0,
    voidedPayments: 0,
    manualReview: 0,
    purgedTenants: 0,
    recovery: { reconciled: 0, captured: 0, voided: 0, refunded: 0, manualReview: 0 },
  };
  const now = deps.now();

  for (const workshop of deps.repo.listWorkshopsByStatus('OFFER_OPEN')) {
    const offer = deps.repo.getOpenOffer(workshop.id) ?? deps.repo.getLatestOffer(workshop.id);
    if (!offer) continue;
    if (now < offer.terms.authDeadlineUtc) continue;
    try {
      const cancelled = await cancelExpiredOffer(deps, { workshopId: workshop.id, tenantId: workshop.tenantId, now });
      if (cancelled.handled) result.cancelledOffers += 1;
      result.voidedPayments += cancelled.voided;
      result.manualReview += cancelled.manualReview;
    } catch {
      // One broken workshop must not stop the reconciliation of others.
      result.manualReview += 1;
    }
  }

  result.recovery = await recoverPending(deps);
  result.manualReview += result.recovery.manualReview;

  // Retention: synthetic demo text should not live forever. Never touches money
  // still in flight (the repo skips those tenants). A failure here is counted,
  // not fatal — the next tick retries.
  try {
    const retentionDays = Math.max(1, opts.retentionDays ?? 7);
    const cutoff = new Date(Date.parse(now) - retentionDays * 86_400_000).toISOString();
    result.purgedTenants = deps.repo.purgeSyntheticTenantsOlderThan(cutoff);
  } catch {
    result.manualReview += 1;
  }
  return result;
}

/**
 * Boot the scheduler. Runs one tick immediately, then every `intervalMs`
 * (default 30s). Ticks never overlap and `stop()` is safe to call twice.
 */
export function startScheduler(deps: SettlementDeps, opts: SchedulerOptions = {}): { stop(): void } {
  const intervalMs = Math.max(1_000, opts.intervalMs ?? 30_000);
  let running = false;
  let stopped = false;

  const tick = async (): Promise<void> => {
    if (stopped || running) return; // no overlapping ticks, no pile-up
    running = true;
    try {
      const result = await runSchedulerTick(deps, { retentionDays: opts.retentionDays });
      if (result.cancelledOffers > 0 || result.recovery.reconciled > 0 || result.purgedTenants > 0) {
        // Counts only: no emails, tokens, or provider payloads in logs.
        console.log(
          `[scheduler] cancelled=${result.cancelledOffers} voided=${result.voidedPayments} ` +
            `reconciled=${result.recovery.reconciled} purged=${result.purgedTenants} manual=${result.manualReview}`,
        );
      }
    } catch {
      console.warn('[scheduler] tick failed; will retry on the next interval');
    } finally {
      running = false;
    }
  };

  void tick(); // run on boot
  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  // Do not keep the process alive just for the scheduler (tests, CLI scripts).
  timer.unref?.();

  return {
    stop(): void {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
    },
  };
}
