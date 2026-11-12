import { describe, expect, it } from 'vitest';
import { openDb } from '../../src/server/db.js';
import { Repo, newId, newParticipantToken, sha256Hex, tokenHash } from '../../src/server/repo.js';
import type { Offer, Payment, Preference, Slot, Workshop } from '../../src/shared/types.js';
const NOW = '2026-11-12T12:00:00Z';
async function makeRepo(): Promise<Repo> {
    return new Repo((await openDb(':memory:')));
}
async function seedWorkshop(repo: Repo, tenantId: string): Promise<{
    workshop: Workshop;
    slot: Slot;
}> {
    const workshop: Workshop = {
        id: newId('wsh'),
        tenantId,
        merchantName: 'Test Studio',
        title: 'Two-hour pottery wheel workshop',
        description: 'Test',
        venue: 'Test venue',
        timezone: 'America/Los_Angeles',
        durationMinutes: 120,
        priceCents: 4500,
        currency: 'USD',
        inclusions: ['All materials'],
        minParticipants: 4,
        capacity: 6,
        authDeadlineUtc: '2026-11-13T08:00:00Z',
        cancellationPolicyVersion: 'v1',
        cancellationSummary: 'Refunded if not confirmed.',
        failureHandlingSummary: 'Non-atomic; compensate.',
        status: 'COLLECTING_INTEREST',
        version: 1,
        createdAt: NOW,
        updatedAt: NOW,
    };
    (await repo.insertWorkshop(workshop));
    const slot: Slot = {
        id: 'slot_a',
        workshopId: workshop.id,
        ordinal: 1,
        startUtc: '2026-11-21T18:00:00Z',
        endUtc: '2026-11-21T20:00:00Z',
        displayTimezone: 'America/Los_Angeles',
        dayLabel: 'Saturday, November 21, 2026',
        timeLabel: '10:00–12:00',
    };
    (await repo.insertSlot(slot));
    return { workshop, slot };
}
async function seedParticipantWithPreference(repo: Repo, workshop: Workshop, name: string) {
    const token = newParticipantToken();
    const participant = {
        id: newId('par'),
        tenantId: workshop.tenantId,
        workshopId: workshop.id,
        displayName: name,
        tokenHash: tokenHash(token),
        persona: name.toLowerCase(),
        createdAt: NOW,
    };
    (await repo.insertParticipant(participant));
    const preference: Preference = {
        id: newId('pref'),
        participantId: participant.id,
        version: 1,
        status: 'CONFIRMED',
        sourceText: 'Saturday morning only.',
        acceptedSlotIds: ['slot_a'],
        preferredSlotIds: [],
        conditionalSlots: [],
        uncertainties: [],
        extractionMode: 'seed',
        extractionModel: null,
        confirmedAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
    };
    (await repo.insertPreference(preference, workshop.tenantId, workshop.id));
    return { participant, token, preference };
}
describe('repo — persistence and safety constraints', () => {
    it('creates a tenant and session, and keeps only the session hash', async () => {
        const repo = (await makeRepo());
        const tenantId = (await repo.createTenant(true, NOW));
        const token = newParticipantToken();
        (await repo.createSession(sha256Hex(token), tenantId, NOW));
        const session = (await repo.getSession(sha256Hex(token)));
        expect(session?.tenantId).toBe(tenantId);
        expect((await repo.getSession(token))).toBeNull(); // raw token is never a key
    });
    it('resolves a participant only by its hashed access token', async () => {
        const repo = (await makeRepo());
        const tenantId = (await repo.createTenant(true, NOW));
        const { workshop } = (await seedWorkshop(repo, tenantId));
        const { participant, token } = (await seedParticipantWithPreference(repo, workshop, 'Alice'));
        expect((await repo.getParticipantByTokenHash(tokenHash(token)))?.id).toBe(participant.id);
        expect((await repo.getParticipantByTokenHash(tokenHash('not-the-token')))).toBeNull();
    });
    it('rolls a failed transaction back completely', async () => {
        const repo = (await makeRepo());
        const tenantId = (await repo.createTenant(true, NOW));
        await expect(repo.tx(async () => {
            (await repo.createTenant(false, NOW));
            throw new Error('boom');
        })).rejects.toThrow('boom');
        const count = (await repo.one<{
            c: number;
        }>('SELECT COUNT(*) AS c FROM tenants'));
        expect(count?.c).toBe(1);
    });
    it('enforces one active payment per participant+offer (T10)', async () => {
        const repo = (await makeRepo());
        const tenantId = (await repo.createTenant(true, NOW));
        const { workshop } = (await seedWorkshop(repo, tenantId));
        const { participant } = (await seedParticipantWithPreference(repo, workshop, 'Alice'));
        const offer: Offer = {
            id: newId('off'),
            tenantId,
            workshopId: workshop.id,
            version: 1,
            slotId: 'slot_a',
            terms: {} as Offer['terms'],
            offerHash: 'a'.repeat(64),
            status: 'OPEN',
            confirmedByMerchantAt: NOW,
            createdAt: NOW,
            closedAt: null,
        };
        (await repo.insertOffer(offer));
        const payment: Payment = {
            id: newId('pay'),
            tenantId,
            workshopId: workshop.id,
            participantId: participant.id,
            offerId: offer.id,
            offerHash: offer.offerHash,
            status: 'ORDER_CREATED',
            providerStatus: 'CREATED',
            resourceType: 'order',
            orderId: 'ORDER_1',
            authorizationId: null,
            captureId: null,
            refundId: null,
            approveUrl: 'https://example.test/approve',
            amountCents: 4500,
            currency: 'USD',
            simulated: true,
            observedAt: NOW,
            authorizedAt: null,
            capturedAt: null,
            createdAt: NOW,
            updatedAt: NOW,
        };
        (await repo.insertPayment(payment));
        await expect(repo.insertPayment({ ...payment, id: newId('pay'), orderId: 'ORDER_2' })).rejects.toThrow();
    });
    it('enforces a unique provider order id and idempotency key', async () => {
        const repo = (await makeRepo());
        const tenantId = (await repo.createTenant(true, NOW));
        const { workshop } = (await seedWorkshop(repo, tenantId));
        const { participant } = (await seedParticipantWithPreference(repo, workshop, 'Alice'));
        expect((await repo.countParticipants(workshop.id))).toBe(1);
        const pref = (await repo.getPreferenceByParticipant(participant.id));
        expect(pref?.acceptedSlotIds).toEqual(['slot_a']);
        expect((await repo.listSlots(workshop.id))).toHaveLength(1);
        expect((await repo.getLatestWorkshop(tenantId))?.id).toBe(workshop.id);
    });
    it('records webhook events once and reports duplicates', async () => {
        const repo = (await makeRepo());
        const event = {
            eventId: 'WH-1',
            verified: true,
            eventType: 'PAYMENT.AUTHORIZATION.CREATED',
            resourceType: 'authorization',
            resourceId: 'AUTH-1',
            rawSha256: 'b'.repeat(64),
            receivedAt: NOW,
        };
        expect((await repo.insertWebhookEvent(event))).toBe(true);
        expect((await repo.insertWebhookEvent(event))).toBe(false);
        expect((await repo.getWebhookEvent('WH-1'))?.verified).toBe(true);
        (await repo.markWebhookProcessed('WH-1', 'merged', NOW));
        expect((await repo.getWebhookEvent('WH-1'))?.processedAt).toBe(NOW);
    });
});
describe('demo data retention (brief §9)', () => {
    it('purges only old synthetic tenants, and never one with money in flight', async () => {
        const repo = (await makeRepo());
        const old = (await repo.createTenant(true, '2026-10-01T00:00:00Z'));
        const recent = (await repo.createTenant(true, '2026-11-11T00:00:00Z'));
        const busy = (await repo.createTenant(true, '2026-10-01T00:00:00Z'));
        const { workshop } = (await seedWorkshop(repo, old));
        (await seedParticipantWithPreference(repo, workshop, 'Alice'));
        const busyWorkshop = (await seedWorkshop(repo, busy)).workshop;
        (await repo.insertOffer({
            id: newId('off'),
            tenantId: busy,
            workshopId: busyWorkshop.id,
            version: 1,
            slotId: 'slot_a',
            terms: {} as never,
            offerHash: 'c'.repeat(64),
            status: 'OPEN',
            confirmedByMerchantAt: NOW,
            createdAt: NOW,
            closedAt: null,
        }));
        (await repo.insertBatch({
            id: newId('bat'),
            tenantId: busy,
            workshopId: busyWorkshop.id,
            offerId: (await repo.getLatestOffer(busyWorkshop.id))!.id,
            offerHash: 'c'.repeat(64),
            status: 'CAPTURING',
            paymentIds: [],
            expectedParticipantCount: 4,
            expectedCents: 18000,
            capturedCents: 0,
            refundedCents: 0,
            reason: null,
            startedAt: NOW,
            deadlineUtc: '2026-11-13T08:00:00Z',
            finishedAt: null,
        }));
        const purged = (await repo.purgeSyntheticTenantsOlderThan('2026-11-05T00:00:00Z'));
        expect(purged).toBe(1);
        expect((await repo.getTenant(old))).toBeNull();
        expect((await repo.getTenant(recent))).not.toBeNull();
        expect((await repo.getTenant(busy))).not.toBeNull(); // in-flight money is never garbage collected
        expect((await repo.listParticipants(workshop.id))).toHaveLength(0);
    });
    it('persists a new source text when a preference is revised', async () => {
        const repo = (await makeRepo());
        const tenantId = (await repo.createTenant(true, NOW));
        const { workshop } = (await seedWorkshop(repo, tenantId));
        const { participant, preference } = (await seedParticipantWithPreference(repo, workshop, 'Finn'));
        (await repo.updatePreference({
            ...preference,
            version: 2,
            status: 'CONFIRMED',
            sourceText: 'I can do Saturday morning only, starting at 10.',
            acceptedSlotIds: ['slot_a'],
            updatedAt: NOW,
        }));
        const stored = (await repo.getPreferenceByParticipant(participant.id));
        expect(stored?.version).toBe(2);
        expect(stored?.sourceText).toBe('I can do Saturday morning only, starting at 10.');
    });
});
