import { afterEach, describe, expect, it } from 'vitest';
import { simulationStats } from '../../src/server/payments/paypal.js';
import { executeBatch, lockBatch } from '../../src/server/payments/settlement.js';
import { runSchedulerTick, startScheduler } from '../../src/server/jobs/scheduler.js';
import { clearSimFail, createHarness, seedWorkshop, setSimFail, wirePaymentsToSimulator } from './helpers.js';
/* ==========================================================================
   Scheduler tests: the deadline canceller and the recovery pass. Simulated
   PayPal only; no browser timers are involved in the module under test.
   ========================================================================== */
afterEach(() => {
    clearSimFail();
});
async function waitFor(condition: () => boolean | Promise<boolean>, timeoutMs = 2000): Promise<void> {
    const started = Date.now();
    while (!(await condition())) {
        if (Date.now() - started > timeoutMs)
            throw new Error('waitFor timed out');
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
}
describe('deadline cancellation', () => {
    it('voids authorized holds and cancels an OFFER_OPEN workshop past its deadline', async () => {
        const harness = (await createHarness());
        const seeded = (await seedWorkshop(harness, { participantCount: 4, minParticipants: 4 }));
        await wirePaymentsToSimulator(harness, seeded.payments);
        harness.setNow('2026-11-12T18:00:01Z'); // deadline was 18:00:00
        const tick = await runSchedulerTick(harness.deps);
        expect(tick.cancelledOffers).toBe(1);
        expect(tick.voidedPayments).toBe(4);
        expect((await harness.repo.listPaymentsByOffer(seeded.offer.id)).every((payment) => payment.status === 'VOIDED')).toBe(true);
        expect((await harness.repo.getWorkshop(seeded.workshop.id))?.status).toBe('CANCELLED');
        expect((await harness.repo.getOffer(seeded.offer.id))?.status).toBe('CANCELLED');
        const auditTypes = (await harness.repo.listAudit(seeded.workshop.id)).map((event) => event.type);
        expect(auditTypes).toContain('offer.expired_cancelled');
        expect(simulationStats(harness.paypal)?.capturesCreated).toBe(0);
    });
    it('compensates a batch that was locked but never executed before the deadline', async () => {
        const harness = (await createHarness());
        const seeded = (await seedWorkshop(harness, { participantCount: 4, minParticipants: 4 }));
        await wirePaymentsToSimulator(harness, seeded.payments);
        const locked = await lockBatch(harness.deps, seeded.workshop.id);
        expect(locked.ok).toBe(true);
        if (!locked.ok)
            return;
        harness.setNow('2026-11-12T18:00:01Z');
        const tick = await runSchedulerTick(harness.deps);
        expect(tick.cancelledOffers).toBe(1);
        expect((await harness.repo.getBatch(locked.batch.id))?.status).toBe('CANCELLED');
        expect((await harness.repo.listPaymentsByIds(locked.batch.paymentIds)).every((payment) => payment.status === 'VOIDED')).toBe(true);
        expect(simulationStats(harness.paypal)?.capturesCreated).toBe(0);
    });
    it('does nothing while the authorization window is still open', async () => {
        const harness = (await createHarness());
        const seeded = (await seedWorkshop(harness, { participantCount: 4, minParticipants: 4 }));
        const tick = await runSchedulerTick(harness.deps);
        expect(tick.cancelledOffers).toBe(0);
        expect((await harness.repo.getWorkshop(seeded.workshop.id))?.status).toBe('OFFER_OPEN');
    });
});
describe('recovery pass', () => {
    it('finishes a CAPTURING batch left behind by a crash and confirms it', async () => {
        const harness = (await createHarness());
        const seeded = (await seedWorkshop(harness, { participantCount: 4, minParticipants: 4 }));
        await wirePaymentsToSimulator(harness, seeded.payments);
        const locked = await lockBatch(harness.deps, seeded.workshop.id);
        expect(locked.ok).toBe(true);
        if (!locked.ok)
            return;
        // Simulate a crash between setting CAPTURING and the first capture.
        (await harness.repo.updateBatch(locked.batch.id, { status: 'CAPTURING' }));
        (await harness.repo.updateWorkshopStatus(seeded.workshop.id, 'SETTLING', harness.now));
        const tick = await runSchedulerTick(harness.deps);
        expect(tick.recovery.captured).toBe(4);
        expect((await harness.repo.getBatch(locked.batch.id))?.status).toBe('CONFIRMED');
        expect((await harness.repo.getWorkshop(seeded.workshop.id))?.status).toBe('CONFIRMED');
        expect(simulationStats(harness.paypal)?.capturesCreated).toBe(4);
    });
    it('resumes an interrupted compensation instead of charging anyone', async () => {
        const harness = (await createHarness());
        const seeded = (await seedWorkshop(harness, { participantCount: 4, minParticipants: 4 }));
        await wirePaymentsToSimulator(harness, seeded.payments);
        const locked = await lockBatch(harness.deps, seeded.workshop.id);
        expect(locked.ok).toBe(true);
        if (!locked.ok)
            return;
        (await harness.repo.updateBatch(locked.batch.id, { status: 'COMPENSATING', reason: 'crash during compensation' }));
        const tick = await runSchedulerTick(harness.deps);
        expect(tick.recovery.voided).toBe(4);
        expect((await harness.repo.getBatch(locked.batch.id))?.status).toBe('CANCELLED');
        expect((await harness.repo.listPaymentsByIds(locked.batch.paymentIds)).every((payment) => payment.status === 'VOIDED')).toBe(true);
        expect(simulationStats(harness.paypal)?.capturesCreated).toBe(0);
    });
});
describe('startScheduler', () => {
    it('runs a tick on boot and stops cleanly (idempotent stop)', async () => {
        const harness = (await createHarness());
        const seeded = (await seedWorkshop(harness, { participantCount: 3, minParticipants: 4 }));
        await wirePaymentsToSimulator(harness, seeded.payments);
        harness.setNow('2026-11-12T19:00:00Z');
        const scheduler = (await startScheduler(harness.deps, { intervalMs: 60000 }));
        try {
            await waitFor(async () => (await harness.repo.getWorkshop(seeded.workshop.id))?.status === 'CANCELLED');
            expect((await harness.repo.listPaymentsByOffer(seeded.offer.id)).every((payment) => payment.status === 'VOIDED')).toBe(true);
        }
        finally {
            scheduler.stop();
            scheduler.stop();
        }
    });
    it('does not overlap ticks when an interval fires during a run', async () => {
        const harness = (await createHarness());
        const seeded = (await seedWorkshop(harness, { participantCount: 4, minParticipants: 4 }));
        const scheduler = (await startScheduler(harness.deps, { intervalMs: 1000 }));
        try {
            await new Promise((resolve) => setTimeout(resolve, 1250));
            // A healthy scheduler leaves the workshop untouched while the window is open.
            expect((await harness.repo.getWorkshop(seeded.workshop.id))?.status).toBe('OFFER_OPEN');
            const batches = (await harness.repo.all<{
                c: number;
            }>('SELECT COUNT(*) AS c FROM settlement_batches'));
            expect(batches[0]?.c).toBe(0);
        }
        finally {
            scheduler.stop();
        }
    });
});
describe('executeBatch after lock is safe to call twice from a ticked scheduler', () => {
    it('does not create a second batch or second captures when both run', async () => {
        const harness = (await createHarness());
        const seeded = (await seedWorkshop(harness, { participantCount: 4, minParticipants: 4 }));
        await wirePaymentsToSimulator(harness, seeded.payments);
        const locked = await lockBatch(harness.deps, seeded.workshop.id);
        expect(locked.ok).toBe(true);
        if (!locked.ok)
            return;
        const first = await executeBatch(harness.deps, locked.batch.id);
        const again = await executeBatch(harness.deps, locked.batch.id);
        expect(first.ok).toBe(true);
        expect(again.ok).toBe(true);
        expect(simulationStats(harness.paypal)?.capturesCreated).toBe(4);
        const batches = (await harness.repo.all<{
            c: number;
        }>('SELECT COUNT(*) AS c FROM settlement_batches WHERE offer_id = ?', seeded.offer.id));
        expect(batches[0]?.c).toBe(1);
    });
});
