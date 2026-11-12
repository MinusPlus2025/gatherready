import { afterEach, describe, expect, it } from 'vitest';
import { handleWebhook } from '../../src/server/payments/webhook.js';
import { authorizationResource, captureResource, clearSimFail, createHarness, refundResource, seedWorkshop, webhookEnvelope, } from './helpers.js';
import type { Harness } from './helpers.js';
import type { Payment, PaymentStatus } from '../../src/shared/types.js';
/* ==========================================================================
   T17 — forged / duplicate / out-of-order webhooks (and T10 duplicate hits).

   Simulated-mode only: the local HMAC stands in for PayPal's
   verify-webhook-signature. The merge table is the safety contract.
   ========================================================================== */
afterEach(() => {
    clearSimFail();
});
async function onePayment(status: PaymentStatus = 'AUTHORIZED', overrides: Partial<Payment> = {}): Promise<Harness & {
    workshopId: string;
}> {
    const harness = (await createHarness());
    const seeded = (await seedWorkshop(harness, {
        participantCount: 1,
        minParticipants: 1,
        paymentStatuses: [status],
        paymentOverrides: [overrides],
    }));
    return Object.assign(harness, { workshopId: seeded.workshop.id });
}
describe('webhook verification', () => {
    it('accepts a correctly signed event and rejects forged / unsigned / tampered ones', async () => {
        const harness = (await onePayment());
        const envelope = webhookEnvelope({
            eventId: 'WH-1',
            eventType: 'PAYMENT.CAPTURE.COMPLETED',
            resourceType: 'capture',
            resource: captureResource({ captureId: 'SIM-CAPTURE-1', authorizationId: 'auth_1' }),
        });
        const ok = await handleWebhook(harness.deps, envelope);
        expect(ok.status).toBe(200);
        expect(ok.body.ok).toBe(true);
        expect((await harness.repo.getPayment('pay_1'))?.status).toBe('CAPTURED');
        const forged = await handleWebhook(harness.deps, {
            ...envelope,
            headers: { ...envelope.headers, 'x-gatherready-sim-signature': 'f'.repeat(64) },
        });
        expect(forged.status).toBe(400);
        expect(forged.body.ok).toBe(false);
        const unsigned = await handleWebhook(harness.deps, { rawBody: envelope.rawBody, headers: {} });
        expect(unsigned.status).toBe(400);
        const otherPlatform = (await onePayment());
        const tamperedBody = envelope.rawBody.replace('SIM-CAPTURE-1', 'SIM-CAPTURE-EVIL');
        const tampered = await handleWebhook(otherPlatform.deps, { rawBody: tamperedBody, headers: envelope.headers });
        expect(tampered.status).toBe(400);
        // Unverified bodies are never stored or merged.
        expect((await otherPlatform.repo.getWebhookEvent('WH-1'))).toBeNull();
        expect((await otherPlatform.repo.getPayment('pay_1'))?.status).toBe('AUTHORIZED');
    });
});
describe('duplicate deliveries', () => {
    it('acknowledges a redelivered event without applying it twice', async () => {
        const harness = (await onePayment());
        const envelope = webhookEnvelope({
            eventId: 'WH-DUPE',
            eventType: 'PAYMENT.CAPTURE.COMPLETED',
            resourceType: 'capture',
            resource: captureResource({ captureId: 'SIM-CAPTURE-D', authorizationId: 'auth_1' }),
        });
        const first = await handleWebhook(harness.deps, envelope);
        expect(first.status).toBe(200);
        const afterFirst = (await harness.repo.getPayment('pay_1'));
        expect(afterFirst?.status).toBe('CAPTURED');
        const second = await handleWebhook(harness.deps, envelope);
        expect(second.status).toBe(200);
        expect(second.body.note).toMatch(/duplicate/i);
        const afterSecond = (await harness.repo.getPayment('pay_1'));
        expect(afterSecond?.capturedAt).toBe(afterFirst?.capturedAt);
        expect(afterSecond?.captureId).toBe(afterFirst?.captureId);
        // Same event id but a state-regressing body must still not apply.
        const regression = webhookEnvelope({
            eventId: 'WH-DUPE',
            eventType: 'PAYMENT.AUTHORIZATION.CREATED',
            resourceType: 'authorization',
            resource: authorizationResource({ authorizationId: 'auth_1' }),
        });
        const third = await handleWebhook(harness.deps, regression);
        expect(third.status).toBe(200);
        expect((await harness.repo.getPayment('pay_1'))?.status).toBe('CAPTURED');
    });
});
describe('out-of-order events never regress a terminal state', () => {
    it('ignores a late AUTHORIZATION.CREATED after the payment was voided', async () => {
        const harness = (await onePayment());
        const voided = webhookEnvelope({
            eventId: 'WH-VOID',
            eventType: 'PAYMENT.AUTHORIZATION.VOIDED',
            resourceType: 'authorization',
            resource: authorizationResource({ authorizationId: 'auth_1', status: 'VOIDED' }),
        });
        expect((await handleWebhook(harness.deps, voided)).status).toBe(200);
        expect((await harness.repo.getPayment('pay_1'))?.status).toBe('VOIDED');
        const late = webhookEnvelope({
            eventId: 'WH-LATE-CREATED',
            eventType: 'PAYMENT.AUTHORIZATION.CREATED',
            resourceType: 'authorization',
            resource: authorizationResource({ authorizationId: 'auth_1', status: 'CREATED' }),
        });
        const result = await handleWebhook(harness.deps, late);
        expect(result.status).toBe(200);
        expect(result.body.note).toMatch(/regression|ignored/i);
        expect((await harness.repo.getPayment('pay_1'))?.status).toBe('VOIDED');
        const lateCapture = webhookEnvelope({
            eventId: 'WH-LATE-CAPTURE',
            eventType: 'PAYMENT.CAPTURE.COMPLETED',
            resourceType: 'capture',
            resource: captureResource({ captureId: 'SIM-CAPTURE-LATE', authorizationId: 'auth_1' }),
        });
        const captureResult = await handleWebhook(harness.deps, lateCapture);
        expect(captureResult.status).toBe(200);
        expect((await harness.repo.getPayment('pay_1'))?.status).toBe('VOIDED');
    });
    it('ignores a CAPTURE.PENDING after the payment was captured', async () => {
        const harness = (await onePayment('CAPTURED', { captureId: 'SIM-CAPTURE-DONE', capturedAt: '2026-11-12T05:00:00Z' }));
        const pending = webhookEnvelope({
            eventId: 'WH-PENDING-LATE',
            eventType: 'PAYMENT.CAPTURE.PENDING',
            resourceType: 'capture',
            resource: captureResource({ captureId: 'SIM-CAPTURE-DONE', authorizationId: 'auth_1', status: 'PENDING' }),
        });
        const result = await handleWebhook(harness.deps, pending);
        expect(result.status).toBe(200);
        expect((await harness.repo.getPayment('pay_1'))?.status).toBe('CAPTURED');
    });
});
describe('pending provider states are never success', () => {
    it('maps CAPTURE.PENDING to CAPTURING and only a COMPLETED query event to CAPTURED', async () => {
        const harness = (await onePayment());
        const pending = webhookEnvelope({
            eventId: 'WH-CAP-PENDING',
            eventType: 'PAYMENT.CAPTURE.PENDING',
            resourceType: 'capture',
            resource: captureResource({ captureId: 'SIM-CAPTURE-P', authorizationId: 'auth_1', status: 'PENDING' }),
        });
        expect((await handleWebhook(harness.deps, pending)).status).toBe(200);
        expect((await harness.repo.getPayment('pay_1'))?.status).toBe('CAPTURING');
        expect((await harness.repo.getPayment('pay_1'))?.status).not.toBe('CAPTURED');
        const completed = webhookEnvelope({
            eventId: 'WH-CAP-COMPLETED',
            eventType: 'PAYMENT.CAPTURE.COMPLETED',
            resourceType: 'capture',
            resource: captureResource({ captureId: 'SIM-CAPTURE-P', authorizationId: 'auth_1', status: 'COMPLETED' }),
        });
        expect((await handleWebhook(harness.deps, completed)).status).toBe(200);
        expect((await harness.repo.getPayment('pay_1'))?.status).toBe('CAPTURED');
    });
    it('never marks REFUNDED on a pending or failed refund', async () => {
        const harness = (await onePayment('CAPTURED', { captureId: 'SIM-CAPTURE-R', capturedAt: '2026-11-12T05:00:00Z' }));
        const pending = webhookEnvelope({
            eventId: 'WH-REFUND-PENDING',
            eventType: 'PAYMENT.REFUND.PENDING',
            resourceType: 'refund',
            resource: refundResource({ refundId: 'SIM-REFUND-1', captureId: 'SIM-CAPTURE-R', status: 'PENDING' }),
        });
        expect((await handleWebhook(harness.deps, pending)).status).toBe(200);
        expect((await harness.repo.getPayment('pay_1'))?.status).toBe('REFUNDING');
        const failed = webhookEnvelope({
            eventId: 'WH-REFUND-FAILED',
            eventType: 'PAYMENT.REFUND.FAILED',
            resourceType: 'refund',
            resource: refundResource({ refundId: 'SIM-REFUND-1', captureId: 'SIM-CAPTURE-R', status: 'FAILED' }),
        });
        expect((await handleWebhook(harness.deps, failed)).status).toBe(200);
        expect((await harness.repo.getPayment('pay_1'))?.status).toBe('REFUNDING');
        expect((await harness.repo.getPayment('pay_1'))?.status).not.toBe('REFUNDED');
        const completed = webhookEnvelope({
            eventId: 'WH-REFUND-COMPLETED',
            eventType: 'PAYMENT.REFUND.COMPLETED',
            resourceType: 'refund',
            resource: refundResource({ refundId: 'SIM-REFUND-1', captureId: 'SIM-CAPTURE-R', status: 'COMPLETED' }),
        });
        expect((await handleWebhook(harness.deps, completed)).status).toBe(200);
        expect((await harness.repo.getPayment('pay_1'))?.status).toBe('REFUNDED');
        expect((await harness.repo.getPayment('pay_1'))?.refundId).toBe('SIM-REFUND-1');
    });
});
describe('irrelevant deliveries', () => {
    it('acknowledges an event with no matching payment and records why', async () => {
        const harness = (await onePayment());
        const envelope = webhookEnvelope({
            eventId: 'WH-ORPHAN',
            eventType: 'PAYMENT.CAPTURE.COMPLETED',
            resourceType: 'capture',
            resource: captureResource({ captureId: 'SIM-CAPTURE-UNKNOWN', authorizationId: 'auth_unknown' }),
        });
        const result = await handleWebhook(harness.deps, envelope);
        expect(result.status).toBe(200);
        expect(result.body.note).toMatch(/no matching payment/i);
        expect((await harness.repo.getWebhookEvent('WH-ORPHAN'))?.processedAt).not.toBeNull();
        expect((await harness.repo.getPayment('pay_1'))?.status).toBe('AUTHORIZED');
    });
    it('acknowledges an unhandled event type without touching state', async () => {
        const harness = (await onePayment());
        const envelope = webhookEnvelope({
            eventId: 'WH-UNKNOWN-TYPE',
            eventType: 'BILLING.SUBSCRIPTION.CREATED',
            resourceType: 'subscription',
            resource: { id: 'I-SUB', status: 'APPROVAL_PENDING' },
        });
        const result = await handleWebhook(harness.deps, envelope);
        expect(result.status).toBe(200);
        expect(result.body.note).toMatch(/unhandled|no matching payment/i);
        expect((await harness.repo.getPayment('pay_1'))?.status).toBe('AUTHORIZED');
    });
});
