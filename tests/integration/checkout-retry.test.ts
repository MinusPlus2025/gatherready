import { describe, expect, it, vi } from 'vitest';
import { Service } from '../../src/server/service.js';
import { createHarness, seedWorkshop } from '../payments/helpers.js';
import type { AppState } from '../../src/shared/api.js';

describe('checkout authorization recovery', () => {
  it('queries an existing authorization and updates the existing operation without authorizing twice', async () => {
    const h = createHarness();
    try {
      const seeded = seedWorkshop(h, { participantCount: 1, paymentStatuses: ['UNKNOWN'] });
      const p = seeded.payments[0]!;
      h.repo.updatePayment(p.id, { orderId: 'ORDER-RETRY', authorizationId: 'AUTH-RETRY', status: 'UNKNOWN' });
      h.repo.insertOperation({ id: 'op-retry', tenantId: p.tenantId, batchId: null, paymentId: p.id,
        action: 'AUTHORIZE', idempotencyKey: 'authorize:ORDER-RETRY', requestHash: 'fixture', status: 'UNKNOWN',
        attempts: 1, providerRef: 'AUTH-RETRY', lastError: 'previous response was ambiguous', nextCheckAt: null,
        createdAt: h.now, updatedAt: h.now });
      const service = new Service(h.cfg, h.repo, () => h.now);
      vi.spyOn(service, 'state').mockReturnValue({} as AppState);
      vi.spyOn(service.paypal, 'getOrder').mockResolvedValue({ orderId: 'ORDER-RETRY', status: 'COMPLETED',
        amountCents: 4500, currency: 'USD', approveUrl: null, payerId: null });
      const query = vi.spyOn(service.paypal, 'getAuthorization').mockResolvedValue({ authorizationId: 'AUTH-RETRY',
        status: 'AUTHORIZED', amountCents: 4500, currency: 'USD', createTime: h.now, expirationTime: null, orderId: 'ORDER-RETRY' });
      const authorize = vi.spyOn(service.paypal, 'authorizeOrder');
      await service.completeCheckout({ tenantId: p.tenantId, synthetic: true, sessionHash: 'test', viewParticipantId: p.participantId }, 'ORDER-RETRY');
      expect(query).toHaveBeenCalledOnce();
      expect(authorize).not.toHaveBeenCalled();
      expect(h.repo.getPayment(p.id)?.status).toBe('AUTHORIZED');
      expect(h.repo.getOperationByKey('authorize:ORDER-RETRY')?.id).toBe('op-retry');
      expect(h.repo.getOperationByKey('authorize:ORDER-RETRY')?.status).toBe('SUCCEEDED');
    } finally { h.close(); }
  });
});
