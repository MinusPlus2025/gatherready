import { describe, it, expect } from 'vitest';
import { createHarness, seedWorkshop, wirePaymentsToSimulator } from '../payments/helpers.js';
import { runSchedulerTick } from '../../src/server/jobs/scheduler.js';
import { Service } from '../../src/server/service.js';
import { buildApp } from '../../src/server/routes.js';
import { simulationStats } from '../../src/server/payments/paypal.js';

describe('explicit serverless reconciliation', () => {
 it('cancels only the selected tenant workshop and repeats without captures or duplicate voids', async () => {
  const h=await createHarness();
  try {
   const a=await seedWorkshop(h,{participantCount:2});
   const b=await seedWorkshop(h,{participantCount:2,workshopId:"ws_2",idPrefix:"second_"});
   await wirePaymentsToSimulator(h,[...a.payments,...b.payments]);
   h.setNow('2026-11-12T18:00:01Z');
   const opts={scope:{tenantId:a.workshop.tenantId,workshopId:a.workshop.id}};
   const first=await runSchedulerTick(h.deps,opts);
   expect(first.cancelledOffers).toBe(1);expect(first.purgedTenants).toBe(0);
   const stats={...simulationStats(h.paypal)};
   expect((await h.repo.getWorkshop(b.workshop.id))?.status).toBe('OFFER_OPEN');
   expect((await h.repo.listPaymentsByOffer(b.offer.id)).every(p=>p.status==='AUTHORIZED')).toBe(true);
   const again=await runSchedulerTick(h.deps,opts);
   expect(again.cancelledOffers).toBe(0);expect(simulationStats(h.paypal)).toEqual(stats);
   expect(simulationStats(h.paypal)?.capturesCreated).toBe(0);
  } finally {h.close();}
 });
 it('rejects participants and cross-workshop requests before reconciliation',async()=>{
  const h=await createHarness();try {
   const a=await seedWorkshop(h,{participantCount:1});const b=await seedWorkshop(h,{participantCount:1,workshopId:"ws_2",idPrefix:"second_"});
   const service=new Service(h.cfg,h.repo,()=>h.now);
   const ctx={tenantId:a.workshop.tenantId,sessionHash:'test',synthetic:true,viewParticipantId:null};
   await expect(service.reconcile(ctx,b.workshop.id)).rejects.toMatchObject({code:'WORKSHOP_NOT_FOUND'});
   await expect(service.reconcile({...ctx,viewParticipantId:a.payments[0]!.participantId},a.workshop.id)).rejects.toMatchObject({code:'ORGANIZER_ONLY'});
  } finally {h.close();}
 });
 it('requires the same-origin header and GET does not invoke reconciliation',async()=>{
  const h=await createHarness();const app=buildApp({cfg:h.cfg,repo:h.repo,service:new Service(h.cfg,h.repo)});
  try {
   expect((await app.inject({method:'POST',url:'/api/workshops/foreign/reconcile'})).statusCode).toBe(403);
   expect((await app.inject({method:'GET',url:'/api/state'})).statusCode).toBe(200);
   expect(simulationStats(h.paypal)?.capturesCreated??0).toBe(0);
  } finally {await app.close();h.close();}
 });
});
