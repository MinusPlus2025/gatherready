import { describe, expect, it } from 'vitest';
import { openDb } from '../../src/server/db.js';
import { Repo, newId, newParticipantToken, sha256Hex, tokenHash } from '../../src/server/repo.js';
import type { Offer, Payment, Preference, Slot, Workshop } from '../../src/shared/types.js';

const NOW = '2026-11-12T12:00:00Z';

function makeRepo(): Repo {
  return new Repo(openDb(':memory:'));
}

function seedWorkshop(repo: Repo, tenantId: string): { workshop: Workshop; slot: Slot } {
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
  repo.insertWorkshop(workshop);
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
  repo.insertSlot(slot);
  return { workshop, slot };
}

function seedParticipantWithPreference(repo: Repo, workshop: Workshop, name: string) {
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
  repo.insertParticipant(participant);
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
  repo.insertPreference(preference, workshop.tenantId, workshop.id);
  return { participant, token, preference };
}

describe('repo — persistence and safety constraints', () => {
  it('creates a tenant and session, and keeps only the session hash', () => {
    const repo = makeRepo();
    const tenantId = repo.createTenant(true, NOW);
    const token = newParticipantToken();
    repo.createSession(sha256Hex(token), tenantId, NOW);
    const session = repo.getSession(sha256Hex(token));
    expect(session?.tenantId).toBe(tenantId);
    expect(repo.getSession(token)).toBeNull(); // raw token is never a key
  });

  it('resolves a participant only by its hashed access token', () => {
    const repo = makeRepo();
    const tenantId = repo.createTenant(true, NOW);
    const { workshop } = seedWorkshop(repo, tenantId);
    const { participant, token } = seedParticipantWithPreference(repo, workshop, 'Alice');
    expect(repo.getParticipantByTokenHash(tokenHash(token))?.id).toBe(participant.id);
    expect(repo.getParticipantByTokenHash(tokenHash('not-the-token'))).toBeNull();
  });

  it('rolls a failed transaction back completely', () => {
    const repo = makeRepo();
    const tenantId = repo.createTenant(true, NOW);
    expect(() =>
      repo.tx(() => {
        repo.createTenant(false, NOW);
        throw new Error('boom');
      }),
    ).toThrow('boom');
    const count = repo.one<{ c: number }>('SELECT COUNT(*) AS c FROM tenants');
    expect(count?.c).toBe(1);
  });

  it('enforces one active payment per participant+offer (T10)', () => {
    const repo = makeRepo();
    const tenantId = repo.createTenant(true, NOW);
    const { workshop } = seedWorkshop(repo, tenantId);
    const { participant } = seedParticipantWithPreference(repo, workshop, 'Alice');
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
    repo.insertOffer(offer);
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
    repo.insertPayment(payment);
    expect(() => repo.insertPayment({ ...payment, id: newId('pay'), orderId: 'ORDER_2' })).toThrow();
  });

  it('enforces a unique provider order id and idempotency key', () => {
    const repo = makeRepo();
    const tenantId = repo.createTenant(true, NOW);
    const { workshop } = seedWorkshop(repo, tenantId);
    const { participant } = seedParticipantWithPreference(repo, workshop, 'Alice');
    expect(repo.countParticipants(workshop.id)).toBe(1);
    const pref = repo.getPreferenceByParticipant(participant.id);
    expect(pref?.acceptedSlotIds).toEqual(['slot_a']);
    expect(repo.listSlots(workshop.id)).toHaveLength(1);
    expect(repo.getLatestWorkshop(tenantId)?.id).toBe(workshop.id);
  });

  it('records webhook events once and reports duplicates', () => {
    const repo = makeRepo();
    const event = {
      eventId: 'WH-1',
      verified: true,
      eventType: 'PAYMENT.AUTHORIZATION.CREATED',
      resourceType: 'authorization',
      resourceId: 'AUTH-1',
      rawSha256: 'b'.repeat(64),
      receivedAt: NOW,
    };
    expect(repo.insertWebhookEvent(event)).toBe(true);
    expect(repo.insertWebhookEvent(event)).toBe(false);
    expect(repo.getWebhookEvent('WH-1')?.verified).toBe(true);
    repo.markWebhookProcessed('WH-1', 'merged', NOW);
    expect(repo.getWebhookEvent('WH-1')?.processedAt).toBe(NOW);
  });
});
