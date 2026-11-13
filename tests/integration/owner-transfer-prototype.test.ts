import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDb } from '../../src/server/db.js';
import { Repo } from '../../src/server/repo.js';
import { describe, it, expect, vi } from 'vitest';
import { createHarness } from '../payments/helpers.js';
import { OwnerTransferPrototype } from '../../src/server/auth/owner-transfer-prototype.js';
import { sessionHashOf } from '../../src/server/service.js';

async function setup() {
  const h=await createHarness(); let time=Date.parse(h.now);
  const tenant=await h.repo.createTenant(true,h.now);
  await h.repo.createSession('owner',tenant,h.now);
  const p=new OwnerTransferPrototype(h.repo,()=>time); await p.installPrototypeSchema();
  return {h,p,tenant,advance:(ms:number)=>{time+=ms;}};
}
describe('non-production owner transfer prototype',()=>{
  it('creates a fresh owner session for the same tenant and consumes exactly once',async()=>{
    const {h,p,tenant}=await setup();try {
      const issued=await p.issue('owner');
      const rows=await h.repo.all('SELECT * FROM owner_transfer_prototype');
      expect(JSON.stringify(rows)).not.toContain(issued.token);
      const redeemed=await p.redeem(issued.token);
      expect(await h.repo.getSession(sessionHashOf(redeemed.sessionToken))).toEqual({tenantId:tenant,viewParticipantId:null,participantBound:false});
      await expect(p.redeem(issued.token)).rejects.toThrow('unavailable');
    }finally{h.close();}
  });
  it('rejects invited, legacy-restricted, missing and participant-preview sessions',async()=>{
    const {h,p,tenant}=await setup();try {
      await h.repo.bindParticipantSession('owner',tenant,'test-participant',h.now);
      await expect(p.issue('owner')).rejects.toThrow('unavailable');
      await h.repo.setSessionView('owner',null,h.now);
      await expect(p.issue('owner')).rejects.toThrow('unavailable');
      await expect(p.issue('missing')).rejects.toThrow('unavailable');
      await h.repo.createSession('preview',tenant,h.now);await h.repo.setSessionView('preview','test-participant',h.now);
      await expect(p.issue('preview')).rejects.toThrow('unavailable');
    }finally{h.close();}
  });
  it('rejects guessed, malformed and expired capabilities; reissue revokes prior code',async()=>{
    const {h,p,advance}=await setup();try {
      const first=await p.issue('owner');const next=await p.issue('owner');
      await expect(p.redeem(first.token)).rejects.toThrow('unavailable');
      await expect(p.redeem('a'.repeat(43))).rejects.toThrow('unavailable');
      await expect(p.redeem('bad')).rejects.toThrow('unavailable');
      advance(15*60_000);
      await expect(p.redeem(next.token)).rejects.toThrow('unavailable');
    }finally{h.close();}
  });
  it('rolls consumption back if session creation fails',async()=>{
    const {h,p}=await setup();try {
      const issued=await p.issue('owner');
      const fail=vi.spyOn(h.repo,'createSession').mockImplementationOnce(async()=>{throw new Error('disk failure');});
      await expect(p.redeem(issued.token)).rejects.toThrow('disk failure');fail.mockRestore();
      expect((await p.redeem(issued.token)).sessionToken).toBeTruthy();
    }finally{h.close();}
  });
});

describe('independent libSQL clients, disposable file only',()=>{
  it('allows only one successful redemption and preserves single use after reopen',async()=>{
    const dir=mkdtempSync(path.join(tmpdir(),'gr-owner-transfer-'));
    const file=path.join(dir,'isolated.db');
    const first=new Repo(await openDb(file));
    const second=new Repo(await openDb(file,{migrate:false}));
    const now='2026-11-13T06:00:00Z';
    try {
      const tenant=await first.createTenant(true,now);
      await first.createSession('test-owner',tenant,now);
      const p1=new OwnerTransferPrototype(first,()=>Date.parse(now));
      const p2=new OwnerTransferPrototype(second,()=>Date.parse(now));
      await p1.installPrototypeSchema();
      const issued=await p1.issue('test-owner');
      const outcomes=await Promise.allSettled([p1.redeem(issued.token),p2.redeem(issued.token)]);
      expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1);
      expect(await first.all('SELECT id_hash FROM sessions WHERE tenant_id=?',tenant)).toHaveLength(2);
      await expect(p2.redeem(issued.token)).rejects.toThrow('unavailable');
      const third=new Repo(await openDb(file,{migrate:false}));
      try {await expect(new OwnerTransferPrototype(third,()=>Date.parse(now)).redeem(issued.token)).rejects.toThrow('unavailable');}
      finally {third.db.close();}
    } finally {first.db.close();second.db.close();rmSync(dir,{recursive:true,force:true});}
  });
  it('invalidates transfer if issuer is subsequently invitation-bound or changes tenant',async()=>{
    const {h,p,tenant}=await setup();
    try {
      const issued=await p.issue('owner');
      const other=await h.repo.createTenant(true,h.now);
      await h.repo.bindParticipantSession('owner',other,'synthetic-invite',h.now);
      await expect(p.redeem(issued.token)).rejects.toThrow('unavailable');
      expect(await h.repo.all('SELECT id_hash FROM sessions WHERE tenant_id=?',tenant)).toHaveLength(0);
      const row=await h.repo.one<{consumed_at:number|null}>('SELECT consumed_at FROM owner_transfer_prototype WHERE tenant_id=?',tenant);
      expect(row?.consumed_at).toBeNull();
    } finally {h.close();}
  });
});
