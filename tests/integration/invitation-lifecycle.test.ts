import { describe, expect, it, vi } from 'vitest';
import { Service } from '../../src/server/service.js';
import { createHarness, seedWorkshop } from '../payments/helpers.js';
import type { AppState } from '../../src/shared/api.js';
import type { WorkshopStatus } from '../../src/shared/types.js';

describe('invitation membership lifecycle', () => {
  it.each(['OFFER_OPEN','SETTLING','CONFIRMED','CANCELLING','CANCELLED','COMPENSATING','MANUAL_REVIEW','CLARIFYING'] as WorkshopStatus[])('cannot add to a published offer in %s', async (status) => {
    const h = await createHarness();
    try {
      const seeded = await seedWorkshop(h, { workshopStatus: status, participantCount: 1 });
      const service = new Service(h.cfg, h.repo, () => h.now);
      const ctx = { tenantId: seeded.workshop.tenantId, synthetic: true, sessionHash: 'test', viewParticipantId: null };
      const before = await h.repo.countParticipants(seeded.workshop.id);
      await expect(service.addParticipant(ctx, 'Late joiner')).rejects.toThrow('New invitations are closed');
      expect(await h.repo.countParticipants(seeded.workshop.id)).toBe(before);
      expect((await h.repo.getLatestWorkshop(ctx.tenantId))?.status).toBe(status);
      const existing = seeded.participants[0]!;
      expect((await h.repo.getParticipantByTokenHash(existing.tokenHash))?.id).toBe(existing.id);
      await expect(service.addParticipant({ ...ctx, viewParticipantId: existing.id }, 'Forbidden')).rejects.toThrow('only the organizer');
    } finally { await h.close(); }
  });
  it('keeps new pre-offer invitations available but blocks closed workshops without an offer', async () => {
    const h = await createHarness();
    try {
      const seeded = await seedWorkshop(h, { workshopStatus:'CLARIFYING', participantCount:0 });
      await h.repo.db.execute({sql:'DELETE FROM offers WHERE id = ?', args:[seeded.offer.id]});
      const service = new Service(h.cfg, h.repo, () => h.now);
      vi.spyOn(service, 'state').mockResolvedValue({} as AppState);
      const ctx = { tenantId: seeded.workshop.tenantId, synthetic:true, sessionHash:'test', viewParticipantId:null };
      expect((await service.addParticipant(ctx, 'New participant')).token).toBeTruthy();
      expect(await h.repo.countParticipants(seeded.workshop.id)).toBe(1);
      await h.repo.updateWorkshopStatus(seeded.workshop.id, 'CANCELLED', h.now);
      await expect(service.addParticipant(ctx, 'Too late')).rejects.toThrow('New invitations are closed');
      expect(await h.repo.countParticipants(seeded.workshop.id)).toBe(1);
    } finally { await h.close(); }
  });
});
