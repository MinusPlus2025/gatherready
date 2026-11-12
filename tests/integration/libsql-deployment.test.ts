import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDb } from '../../src/server/db.js';
import { Repo } from '../../src/server/repo.js';
import { Service } from '../../src/server/service.js';
import { buildApp } from '../../src/server/routes.js';
import { createHarness, seedWorkshop, testConfig, wirePaymentsToSimulator } from '../payments/helpers.js';
import { lockBatch, executeBatch } from '../../src/server/payments/settlement.js';
import { simulationStats } from '../../src/server/payments/paypal.js';

function temporaryDb() { return path.join(mkdtempSync(path.join(tmpdir(),'gr-libsql-test-')), 'test.db'); }
function cookie(response: any): string { return response.cookies.map((c:any)=>`${c.name}=${c.value}`).join('; '); }

describe('libSQL deployment adaptation (local, simulated PayPal only)',()=>{
 it('persists session and tenant across close/reopen with another client', async()=>{
   const file=temporaryDb(); const first=new Repo(await openDb(file));
   const tenant=await first.createTenant(true,'now');
   await first.createSession('synthetic-session-hash',tenant,'now');
   first.db.close();
   const second=new Repo(await openDb(file));
   expect((await second.getSession('synthetic-session-hash'))?.tenantId).toBe(tenant);
   second.db.close();
 });
 it('serves two isolated HTTP visitors and persists their sample workshop across app restart',async()=>{
   const file=temporaryDb();
   const cfg=testConfig();cfg.llm={...cfg.llm,provider:'none',apiKey:'',baseUrl:'',model:''};
   const repo=new Repo(await openDb(file));
   const app=buildApp({cfg,repo,service:new Service(cfg,repo)});
   const a=await app.inject({method:'GET',url:'/api/state'});
   const b=await app.inject({method:'GET',url:'/api/state'});
   expect(a.statusCode).toBe(200);expect(b.statusCode).toBe(200);
   const ca=cookie(a), cb=cookie(b);expect(ca).not.toBe(cb);
   const created=await app.inject({method:'POST',url:'/api/workshop',headers:{cookie:ca,'x-gatherready':'1'},payload:{sample:true}});
   expect(created.statusCode,created.body).toBe(200);
   const original=created.json();expect(original.workshop?.id).toBeTruthy();
   const untouched=await app.inject({method:'GET',url:'/api/state',headers:{cookie:cb}});
   expect(untouched.json().workshop).toBeNull();
   await app.close();repo.db.close();
   const reopened=new Repo(await openDb(file));
   const app2=buildApp({cfg,repo:reopened,service:new Service(cfg,reopened)});
   const restored=await app2.inject({method:'GET',url:'/api/state',headers:{cookie:ca}});
   expect(restored.json().workshop?.id).toBe(original.workshop.id);
   await app2.close();reopened.db.close();
 });
 it('handles overlapping locks without two batches, then captures once',async()=>{
   const h=await createHarness();
   const s=await seedWorkshop(h,{participantCount:4,minParticipants:4});
   await wirePaymentsToSimulator(h,s.payments);
   const attempts=await Promise.allSettled([lockBatch(h.deps,s.workshop.id),lockBatch(h.deps,s.workshop.id)]);
   const all=await h.repo.all<{id:string}>('SELECT id FROM settlement_batches WHERE offer_id=?',s.offer.id);
   expect(all).toHaveLength(1);
   const accepted=attempts.filter(r=>r.status==='fulfilled'&&r.value.ok);
   expect(accepted.length).toBeGreaterThan(0);
   const result=await executeBatch(h.deps,all[0].id);
   expect(result.ok).toBe(true);
   expect(simulationStats(h.paypal)?.capturesCreated).toBe(4);
   h.close();
 });
 it('two independent database clients cannot create two settlement batches',async()=>{
   const file=temporaryDb(); const h=await createHarness();h.repo.db.close();
   h.repo=new Repo(await openDb(file));h.deps.repo=h.repo;
   const s=await seedWorkshop(h,{participantCount:4,minParticipants:4});
   const second=new Repo(await openDb(file));
   const attempts=await Promise.allSettled([lockBatch(h.deps,s.workshop.id),lockBatch({...h.deps,repo:second},s.workshop.id)]);
   const all=await h.repo.all<{id:string}>('SELECT id FROM settlement_batches WHERE offer_id=?',s.offer.id);
   expect(all).toHaveLength(1);
   expect(attempts.some(r=>r.status==='fulfilled'&&r.value.ok)).toBe(true);
   // A losing caller may get a busy/retry result; correctness, not availability.
   second.db.close();h.close();
 });

 it('overlapping batch execution does not compensate a successful concurrent capture',async()=>{
   const h=await createHarness();const s=await seedWorkshop(h,{participantCount:4,minParticipants:4});
   await wirePaymentsToSimulator(h,s.payments);
   const locked=await lockBatch(h.deps,s.workshop.id);expect(locked.ok).toBe(true);if(!locked.ok)return;
   const attempts=await Promise.allSettled([executeBatch(h.deps,locked.batch.id),executeBatch(h.deps,locked.batch.id)]);
   expect((await h.repo.getBatch(locked.batch.id))?.status,JSON.stringify(attempts)).toBe('CONFIRMED');
   expect(simulationStats(h.paypal)?.capturesCreated).toBe(4);
   expect((await h.repo.listPaymentsByOffer(s.offer.id)).every(p=>p.status==='CAPTURED')).toBe(true);
   h.close();
 });

 it('remains correct with delayed DB and provider responses under overlapping execution',async()=>{
   const delay=()=>new Promise(r=>setTimeout(r,3));
   function delayed<T extends object>(target:T):T {
     return new Proxy(target,{get(obj,key){
       const value=Reflect.get(obj,key,obj);
       if(typeof value!=='function')return value;
       if(key==='transaction')return async(...args:unknown[])=>delayed(await value.apply(obj,args));
       if(key==='execute')return async(...args:unknown[])=>{await delay();return value.apply(obj,args);};
       return value.bind(obj);
     }});
   }
   const h=await createHarness();h.repo.db.close();h.repo=new Repo(delayed(await openDb(':memory:')));h.deps.repo=h.repo;
   const s=await seedWorkshop(h,{participantCount:4,minParticipants:4});await wirePaymentsToSimulator(h,s.payments);
   const actual=h.paypal.captureAuthorization.bind(h.paypal);
   h.paypal.captureAuthorization=async(...args)=>{await delay();return actual(...args);};
   const locked=await lockBatch(h.deps,s.workshop.id);expect(locked.ok).toBe(true);if(!locked.ok)return;
   const attempts=await Promise.allSettled([executeBatch(h.deps,locked.batch.id),executeBatch(h.deps,locked.batch.id)]);
   expect((await h.repo.getBatch(locked.batch.id))?.status,JSON.stringify(attempts)).toBe('CONFIRMED');
   expect(simulationStats(h.paypal)?.capturesCreated).toBe(4);
   expect(simulationStats(h.paypal)?.refundsCreated).toBe(0);
   expect((await h.repo.listPaymentsByOffer(s.offer.id)).every(p=>p.status==='CAPTURED')).toBe(true);
   h.close();
 });

});
