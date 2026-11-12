import { afterEach, describe, expect, it } from 'vitest';
import { simulationStats } from '../../src/server/payments/paypal.js';
import {
  captureOperationKey,
  compensateBatch,
  executeBatch,
  lockBatch,
  recoverPending,
} from '../../src/server/payments/settlement.js';
import { runSchedulerTick } from '../../src/server/jobs/scheduler.js';
import {
  DEADLINE,
  NOW,
  PRICE_CENTS,
  clearSimFail,
  createHarness,
  seedWorkshop,
  setSimFail,
  wirePaymentsToSimulator,
  type Harness,
} from './helpers.js';

/* ==========================================================================
   Settlement safety tests (brief T06–T13, T15, T18).

   Everything is deterministic: injected clock, :memory: SQLite, simulated
   PayPal. These are simulated-mode results and must never be reported as
   sandbox evidence.
   ========================================================================== */

afterEach(() => {
  clearSimFail();
});

function operationsOf(harness: Harness, batchId: string) {
  return harness.repo.listOperationsByBatch(batchId).map((operation) => `${operation.action}:${operation.status}`);
}

function withdrawPreference(harness: Harness, participantId: string): void {
  const preference = harness.repo.getPreferenceByParticipant(participantId);
  expect(preference).not.toBeNull();
  harness.repo.updatePreference({
    ...preference!,
    status: 'WITHDRAWN',
    version: preference!.version + 1,
    updatedAt: harness.now,
  });
}

describe('T06 — below the minimum, and the deadline voids holds', () => {
  it('cannot capture 3 authorized when the minimum is 4', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, { participantCount: 3, minParticipants: 4 });
    const locked = await lockBatch(harness.deps, seeded.workshop.id);
    expect(locked.ok).toBe(false);
    if (!locked.ok) {
      expect(locked.code).toBe('COUNT_BELOW_MINIMUM');
      expect(locked.message).toContain('3');
    }
    expect(harness.repo.getBatchByOffer(seeded.offer.id)).toBeNull();
    expect(simulationStats(harness.paypal)?.capturesCreated).toBe(0);
  });

  it('voids every authorized hold once the authorization deadline passes', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, { participantCount: 3, minParticipants: 4 });
    await wirePaymentsToSimulator(harness, seeded.payments);
    harness.setNow('2026-11-12T19:00:00Z'); // past DEADLINE
    const tick = await runSchedulerTick(harness.deps);
    expect(tick.cancelledOffers).toBe(1);
    expect(tick.voidedPayments).toBe(3);
    const payments = harness.repo.listPaymentsByOffer(seeded.offer.id);
    expect(payments.every((payment) => payment.status === 'VOIDED')).toBe(true);
    expect(harness.repo.getWorkshop(seeded.workshop.id)?.status).toBe('CANCELLED');
    expect(harness.repo.getOffer(seeded.offer.id)?.status).toBe('CANCELLED');
    expect(harness.repo.listAudit(seeded.workshop.id).map((event) => event.type)).toContain('offer.expired_cancelled');
    expect(simulationStats(harness.paypal)?.capturesCreated).toBe(0);
  });
});

describe('T07 — 4 authorized + the identical offer', () => {
  it('captures all four and confirms only after querying every capture', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, { participantCount: 4, minParticipants: 4 });
    await wirePaymentsToSimulator(harness, seeded.payments);
    const locked = await lockBatch(harness.deps, seeded.workshop.id);
    expect(locked.ok).toBe(true);
    if (!locked.ok) return;
    expect(locked.batch.status).toBe('LOCKED');
    expect(locked.batch.paymentIds).toHaveLength(4);
    expect(locked.batch.expectedCents).toBe(4 * PRICE_CENTS);

    const result = await executeBatch(harness.deps, locked.batch.id);
    expect(result.ok).toBe(true);
    expect(result.batch.status).toBe('CONFIRMED');
    expect(result.batch.capturedCents).toBe(4 * PRICE_CENTS);
    expect(result.batch.refundedCents).toBe(0);

    const payments = harness.repo.listPaymentsByIds(locked.batch.paymentIds);
    expect(payments.every((payment) => payment.status === 'CAPTURED')).toBe(true);
    expect(new Set(payments.map((payment) => payment.captureId)).size).toBe(4);
    expect(harness.repo.getWorkshop(seeded.workshop.id)?.status).toBe('CONFIRMED');
    expect(operationsOf(harness, locked.batch.id)).toEqual([
      'CAPTURE:SUCCEEDED',
      'CAPTURE:SUCCEEDED',
      'CAPTURE:SUCCEEDED',
      'CAPTURE:SUCCEEDED',
    ]);
  });

  it('never confirms when a capture reports a non-COMPLETED provider status', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, { participantCount: 4, minParticipants: 4 });
    await wirePaymentsToSimulator(harness, seeded.payments);
    const locked = await lockBatch(harness.deps, seeded.workshop.id);
    expect(locked.ok).toBe(true);
    if (!locked.ok) return;
    // The capture call succeeds but the queried capture is only PENDING: the
    // queries are the confirmation gate, so this must never become CONFIRMED.
    setSimFail('CAPTURE_PENDING:*');
    const result = await executeBatch(harness.deps, locked.batch.id);
    expect(result.ok).toBe(false);
    expect(result.batch.status).not.toBe('CONFIRMED');
    expect(harness.repo.getPayment('pay_1')?.status).toBe('MANUAL_REVIEW');
    expect(harness.repo.getWorkshop(seeded.workshop.id)?.status).toBe('MANUAL_REVIEW');
  });

  it('rejects a payment authorized against different offer terms', async () => {
    const harness = createHarness();
    seedWorkshop(harness, {
      participantCount: 4,
      minParticipants: 4,
      paymentOverrides: [{ offerHash: 'different_offer_hash' }],
    });
    const locked = await lockBatch(harness.deps, 'ws_1');
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.code).toBe('OFFER_HASH_MISMATCH');
  });
});

describe('T08 — an approved order without an authorization does not count', () => {
  it('cannot settle when a 4th consenting participant never authorized', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, {
      participantCount: 4,
      minParticipants: 4,
      paymentStatuses: ['AUTHORIZED', 'AUTHORIZED', 'AUTHORIZED', 'APPROVED'],
    });
    const locked = await lockBatch(harness.deps, seeded.workshop.id);
    expect(locked.ok).toBe(false);
    if (!locked.ok) {
      expect(locked.code).toBe('COUNT_BELOW_MINIMUM');
      expect(locked.message).toContain('3');
    }
    expect(simulationStats(harness.paypal)?.capturesCreated).toBe(0);
  });

  it('excludes the un-authorized order from a batch that has enough authorized participants', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, {
      participantCount: 5,
      minParticipants: 4,
      capacity: 6,
      paymentStatuses: ['AUTHORIZED', 'AUTHORIZED', 'AUTHORIZED', 'AUTHORIZED', 'APPROVED'],
    });
    await wirePaymentsToSimulator(harness, seeded.payments);
    const locked = await lockBatch(harness.deps, seeded.workshop.id);
    expect(locked.ok).toBe(true);
    if (!locked.ok) return;
    expect(locked.batch.paymentIds).toHaveLength(4);
    expect(locked.batch.paymentIds).not.toContain('pay_5');
    const result = await executeBatch(harness.deps, locked.batch.id);
    expect(result.ok).toBe(true);
    expect(harness.repo.getPayment('pay_5')?.status).toBe('APPROVED'); // untouched, never charged
    expect(harness.repo.getBatch(locked.batch.id)?.status).toBe('CONFIRMED');
  });
});

describe('T09 — withdraw racing settlement', () => {
  it('blocks the batch when a withdrawal lands before locking', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, { participantCount: 4, minParticipants: 4 });
    withdrawPreference(harness, 'part_3');
    const locked = await lockBatch(harness.deps, seeded.workshop.id);
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.code).toBe('PARTICIPANT_WITHDRAWN');
    expect(harness.repo.getBatchByOffer(seeded.offer.id)).toBeNull();
    expect(simulationStats(harness.paypal)?.capturesCreated).toBe(0);
  });

  it('aborts a locked batch before any capture when a withdrawal lands mid-flight', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, { participantCount: 4, minParticipants: 4 });
    await wirePaymentsToSimulator(harness, seeded.payments);
    const locked = await lockBatch(harness.deps, seeded.workshop.id);
    expect(locked.ok).toBe(true);
    if (!locked.ok) return;
    // Withdrawal race: the preference is WITHDRAWN while the hold is still live.
    withdrawPreference(harness, 'part_1');

    const result = await executeBatch(harness.deps, locked.batch.id);
    expect(result.ok).toBe(false);
    expect(result.batch.status).toBe('CANCELLED');
    expect(simulationStats(harness.paypal)?.capturesCreated).toBe(0); // exactly zero charges
    const payments = harness.repo.listPaymentsByIds(locked.batch.paymentIds);
    expect(payments.every((payment) => payment.status === 'VOIDED')).toBe(true);
    // Exactly one legal order (batch) exists for this offer.
    const batches = harness.repo.all<{ c: number }>('SELECT COUNT(*) AS c FROM settlement_batches WHERE offer_id = ?', seeded.offer.id);
    expect(batches[0]?.c).toBe(1);
  });
});

describe('T10 — double click / duplicate calls cannot charge twice', () => {
  it('returns the same batch for a second lock and never a second set of captures', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, { participantCount: 4, minParticipants: 4 });
    await wirePaymentsToSimulator(harness, seeded.payments);
    const first = await lockBatch(harness.deps, seeded.workshop.id);
    const second = await lockBatch(harness.deps, seeded.workshop.id);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.batch.id).toBe(first.batch.id);

    const executed = await executeBatch(harness.deps, first.batch.id);
    expect(executed.ok).toBe(true);
    const clickedAgain = await executeBatch(harness.deps, first.batch.id);
    expect(clickedAgain.ok).toBe(true);
    expect(clickedAgain.batch.status).toBe('CONFIRMED');
    expect(simulationStats(harness.paypal)?.capturesCreated).toBe(4); // not 8
    const batchRows = harness.repo.all<{ c: number }>('SELECT COUNT(*) AS c FROM settlement_batches');
    expect(batchRows[0]?.c).toBe(1);
  });
});

describe('T11 — capture timeout that actually succeeded', () => {
  it('reconciles the unknown capture without capturing twice', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, { participantCount: 4, minParticipants: 4 });
    await wirePaymentsToSimulator(harness, seeded.payments);
    setSimFail('CAPTURE_AMBIGUOUS:pay_2'); // the provider recorded it, the response was lost
    const locked = await lockBatch(harness.deps, seeded.workshop.id);
    expect(locked.ok).toBe(true);
    if (!locked.ok) return;

    const result = await executeBatch(harness.deps, locked.batch.id);
    expect(result.ok).toBe(true);
    expect(result.batch.status).toBe('CONFIRMED');
    expect(simulationStats(harness.paypal)?.capturesCreated).toBe(4); // no duplicate capture
    const payTwo = harness.repo.getPayment('pay_2');
    expect(payTwo?.status).toBe('CAPTURED');
    expect(payTwo?.captureId).not.toBeNull();
    const operation = harness.repo.getOperationByKey(captureOperationKey(locked.batch.id, 'pay_2'));
    expect(operation?.status).toBe('SUCCEEDED');
    expect(operation?.providerRef).toBe(payTwo?.captureId);
  });
});

describe('T12 — partial capture failure', () => {
  it('aborts, voids the uncaptured holds, refunds the captured one, and stays traceable', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, { participantCount: 4, minParticipants: 4 });
    await wirePaymentsToSimulator(harness, seeded.payments);
    setSimFail('CAPTURE:pay_2'); // pay_1 captures first, then pay_2 fails
    const locked = await lockBatch(harness.deps, seeded.workshop.id);
    expect(locked.ok).toBe(true);
    if (!locked.ok) return;

    const result = await executeBatch(harness.deps, locked.batch.id);
    expect(result.ok).toBe(false);
    expect(result.batch.status).toBe('CANCELLED');
    expect(result.batch.capturedCents).toBe(PRICE_CENTS);
    expect(result.batch.refundedCents).toBe(PRICE_CENTS);

    expect(harness.repo.getPayment('pay_1')?.status).toBe('REFUNDED');
    expect(harness.repo.getPayment('pay_2')?.status).toBe('VOIDED');
    expect(harness.repo.getPayment('pay_3')?.status).toBe('VOIDED');
    expect(harness.repo.getPayment('pay_4')?.status).toBe('VOIDED');
    expect(harness.repo.listPaymentsByIds(locked.batch.paymentIds).some((payment) => payment.status === 'CAPTURED')).toBe(false);
    expect(harness.repo.getWorkshop(seeded.workshop.id)?.status).toBe('CANCELLED');

    const trace = operationsOf(harness, locked.batch.id);
    expect(trace).toContain('CAPTURE:SUCCEEDED');
    expect(trace).toContain('CAPTURE:FAILED');
    expect(trace).toContain('REFUND:SUCCEEDED');
    expect(trace.filter((entry) => entry === 'VOID:SUCCEEDED')).toHaveLength(3);
    expect(simulationStats(harness.paypal)?.refundsCreated).toBe(1);
    expect(simulationStats(harness.paypal)?.voidsCreated).toBe(3);
  });
});

describe('T13 — an unknown refund is never reported as REFUNDED', () => {
  it('parks the batch in MANUAL_REVIEW and keeps the payment REFUNDING across recovery', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, { participantCount: 4, minParticipants: 4 });
    await wirePaymentsToSimulator(harness, seeded.payments);
    setSimFail('CAPTURE:pay_2,REFUND_UNKNOWN:*');
    const locked = await lockBatch(harness.deps, seeded.workshop.id);
    expect(locked.ok).toBe(true);
    if (!locked.ok) return;

    const result = await executeBatch(harness.deps, locked.batch.id);
    expect(result.ok).toBe(false);
    expect(result.batch.status).toBe('MANUAL_REVIEW');
    expect(harness.repo.getPayment('pay_1')?.status).toBe('REFUNDING'); // not REFUNDED
    expect(harness.repo.listPaymentsByIds(locked.batch.paymentIds).some((payment) => payment.status === 'REFUNDED')).toBe(false);
    expect(result.batch.refundedCents).toBe(0);

    // Recovery queries/retries but still must not invent a completed refund.
    await recoverPending(harness.deps);
    await recoverPending(harness.deps);
    const payOne = harness.repo.getPayment('pay_1');
    expect(payOne?.status).toBe('REFUNDING');
    expect(harness.repo.getBatch(locked.batch.id)?.status).toBe('MANUAL_REVIEW');
    expect(harness.repo.listPaymentsByIds(locked.batch.paymentIds).some((payment) => payment.status === 'REFUNDED')).toBe(false);
    // No second charge either: one capture, zero completed refunds.
    expect(simulationStats(harness.paypal)?.capturesCreated).toBe(1);
    expect(simulationStats(harness.paypal)?.refundsCreated).toBe(0);
    expect(seeded.payments).toHaveLength(4);
  });
});

describe('T15 — stale authorization / passed deadline', () => {
  it('blocks a 49-hour-old authorization', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, {
      participantCount: 4,
      minParticipants: 4,
      authorizedAt: '2026-11-10T05:00:00Z', // 49 hours before NOW
    });
    const locked = await lockBatch(harness.deps, seeded.workshop.id);
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.code).toBe('AUTHORIZATION_STALE');
  });

  it('blocks collection after the authorization deadline', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, {
      participantCount: 4,
      minParticipants: 4,
      deadlineUtc: '2026-11-12T05:59:00Z', // one minute before NOW
    });
    const locked = await lockBatch(harness.deps, seeded.workshop.id);
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.code).toBe('DEADLINE_PASSED');
  });

  it('re-checks the 48h window at capture time and aborts without charging', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, { participantCount: 4, minParticipants: 4 });
    await wirePaymentsToSimulator(harness, seeded.payments);
    const locked = await lockBatch(harness.deps, seeded.workshop.id);
    expect(locked.ok).toBe(true);
    if (!locked.ok) return;
    harness.advanceMs(49 * 3_600_000); // authorizations are now stale, deadline passed
    const result = await executeBatch(harness.deps, locked.batch.id);
    expect(result.ok).toBe(false);
    expect(result.batch.status).toBe('CANCELLED');
    expect(simulationStats(harness.paypal)?.capturesCreated).toBe(0);
    expect(harness.repo.listPaymentsByIds(locked.batch.paymentIds).every((payment) => payment.status === 'VOIDED')).toBe(true);
    expect(DEADLINE).toBe('2026-11-12T18:00:00Z');
  });

  it('leaves an unexpired OFFER_OPEN workshop alone', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, { participantCount: 4, minParticipants: 4 });
    const tick = await runSchedulerTick(harness.deps);
    expect(tick.cancelledOffers).toBe(0);
    expect(harness.repo.getWorkshop(seeded.workshop.id)?.status).toBe('OFFER_OPEN');
    expect(harness.repo.listPaymentsByOffer(seeded.offer.id).every((payment) => payment.status === 'AUTHORIZED')).toBe(true);
  });
});

describe('T18 — crash after capture but before the DB write', () => {
  it('recovers by querying and reusing the same idempotency key (no second charge)', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, { participantCount: 4, minParticipants: 4 });
    await wirePaymentsToSimulator(harness, seeded.payments);
    const locked = await lockBatch(harness.deps, seeded.workshop.id);
    expect(locked.ok).toBe(true);
    if (!locked.ok) return;

    // The provider captured pay_1 before the process died; the DB still says
    // AUTHORIZED and the operation row is stuck IN_FLIGHT with the same key.
    const key = captureOperationKey(locked.batch.id, 'pay_1');
    const authorizationId = harness.repo.getPayment('pay_1')?.authorizationId;
    expect(authorizationId).toBeTruthy();
    const preCrash = await harness.paypal.captureAuthorization(
      { authorizationId: authorizationId!, amountCents: PRICE_CENTS, currency: 'USD', finalCapture: true, invoiceId: 'pay_1' },
      key,
    );
    harness.repo.updateBatch(locked.batch.id, { status: 'CAPTURING' });
    harness.repo.updateWorkshopStatus(seeded.workshop.id, 'SETTLING', harness.now);
    harness.repo.insertOperation({
      id: 'op_crashed',
      tenantId: seeded.workshop.tenantId,
      batchId: locked.batch.id,
      paymentId: 'pay_1',
      action: 'CAPTURE',
      idempotencyKey: key,
      requestHash: 'pre-crash',
      status: 'IN_FLIGHT',
      attempts: 1,
      providerRef: null,
      lastError: null,
      nextCheckAt: null,
      createdAt: harness.now,
      updatedAt: harness.now,
    });
    expect(simulationStats(harness.paypal)?.capturesCreated).toBe(1);

    const recovery = await recoverPending(harness.deps);
    expect(recovery.captured).toBe(4);
    const batchAfter = harness.repo.getBatch(locked.batch.id);
    expect(batchAfter?.status).toBe('CONFIRMED');
    expect(harness.repo.getPayment('pay_1')?.captureId).toBe(preCrash.captureId);
    expect(harness.repo.getPayment('pay_1')?.status).toBe('CAPTURED');
    // One pre-crash capture + three fresh ones = 4. The crash did not double-charge.
    expect(simulationStats(harness.paypal)?.capturesCreated).toBe(4);
    expect(harness.repo.listPaymentsByIds(locked.batch.paymentIds).every((payment) => payment.status === 'CAPTURED')).toBe(true);
    expect(NOW).toBe('2026-11-12T06:00:00Z');
  });
});

describe('compensation is idempotent', () => {
  it('a second compensateBatch call on a cancelled batch changes nothing', async () => {
    const harness = createHarness();
    const seeded = seedWorkshop(harness, { participantCount: 4, minParticipants: 4 });
    await wirePaymentsToSimulator(harness, seeded.payments);
    const locked = await lockBatch(harness.deps, seeded.workshop.id);
    expect(locked.ok).toBe(true);
    if (!locked.ok) return;
    const first = await compensateBatch(harness.deps, locked.batch.id, 'operator cancelled');
    const second = await compensateBatch(harness.deps, locked.batch.id, 'operator cancelled');
    expect(first.batch.status).toBe('CANCELLED');
    expect(second.batch.status).toBe('CANCELLED');
    expect(simulationStats(harness.paypal)?.voidsCreated).toBe(4); // not 8
    expect(simulationStats(harness.paypal)?.capturesCreated).toBe(0);
  });
});
