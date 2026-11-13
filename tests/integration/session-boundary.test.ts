import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDb } from '../../src/server/db.js';
import { Repo } from '../../src/server/repo.js';
import { describe, expect, it } from 'vitest';
import { createHarness, seedWorkshop } from '../payments/helpers.js';
import { Service } from '../../src/server/service.js';
import { buildApp } from '../../src/server/routes.js';
import { tokenHash } from '../../src/server/repo.js';

async function fixture() {
  const h = await createHarness();
  const seeded = await seedWorkshop(h, { participantCount: 2 });
  const token = 'a'.repeat(43);
  await h.repo.db.execute({sql:'UPDATE participants SET token_hash = ? WHERE id = ?',args:[tokenHash(token), seeded.participants[0]!.id]});
  const service = new Service(h.cfg, h.repo, () => h.now);
  const app = buildApp({ cfg: h.cfg, repo: h.repo, service });
  const entered = await app.inject({ method: 'GET', url: `/api/state?ptoken=${token}` });
  expect(entered.statusCode).toBe(200);
  const cookie = entered.cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const post = (url: string, payload: Record<string, unknown>) => app.inject({method:'POST',url,payload,headers:{cookie,'x-gatherready':'1'}});
  return {h, seeded, service, app, cookie, post};
}
describe('invitation session privilege boundary', () => {
  it('does not allow an invited participant to become the organizer or another participant', async () => {
    const f = await fixture();
    try {
      expect((await f.post('/api/demo/view', {participantId:null})).statusCode).toBe(403);
      expect((await f.post('/api/demo/view', {participantId:f.seeded.participants[1]!.id})).statusCode).toBe(403);
      expect((await f.post('/api/demo/reset', {})).statusCode).toBe(403);
      const fresh = await f.app.inject({method:'GET',url:'/api/state',headers:{cookie:f.cookie}});
      expect(fresh.json().session.role).toBe('participant');
      expect(fresh.json().demo.canSwitchRoles).toBe(false);
      expect((await f.post(`/api/workshops/${f.seeded.workshop.id}/settle`, {})).statusCode).toBe(403);
    } finally { await f.app.close(); await f.h.close(); }
  });
  it('rejects concurrent role, reset, settle and reconcile requests for a bound invitation', async () => {
    const f = await fixture();
    try {
      const responses = await Promise.all([
        f.post('/api/demo/view',{participantId:null}),
        f.post('/api/demo/reset',{}),
        f.post(`/api/workshops/${f.seeded.workshop.id}/settle`,{}),
        f.post(`/api/workshops/${f.seeded.workshop.id}/reconcile`,{}),
      ]);
      expect(responses.map(r=>r.statusCode)).toEqual([403,403,403,403]);
      const current = await f.app.inject({method:'GET',url:'/api/state',headers:{cookie:f.cookie}});
      expect(current.json().session.role).toBe('participant');
      expect(current.json().participants).toHaveLength(1);
      expect(current.json().audit).toEqual([]);
      expect(current.json().workshop.id).toBe(f.seeded.workshop.id);
    } finally { await f.app.close(); await f.h.close(); }
  });
  it('retains the restriction when the app is rebuilt, without the invitation token', async () => {
    const f = await fixture();
    try {
      await f.app.close();
      const rebuilt = buildApp({cfg:f.h.cfg,repo:f.h.repo,service:f.service});
      const r = await rebuilt.inject({method:'POST',url:'/api/demo/view',payload:{participantId:null},headers:{cookie:f.cookie,'x-gatherready':'1'}});
      expect(r.statusCode).toBe(403);
      await rebuilt.close();
    } finally { await f.h.close(); }
  });
  it('fails closed if the participant no longer exists instead of granting host access', async () => {
    const f = await fixture();
    try {
      await f.h.repo.db.execute({sql:'UPDATE sessions SET view_participant_id = ?',args:['removed-participant']});
      const r = await f.app.inject({method:'GET',url:'/api/state',headers:{cookie:f.cookie}});
      expect(r.statusCode).toBe(403);
    } finally { await f.app.close(); await f.h.close(); }
  });
  it('cannot use a foreign participant id to move to another tenant', async () => {
    const f = await fixture();
    try {
      const otherTenant=await f.service.newTenant();
      const other=await f.service.createWorkshop(await f.service.ctxFor(otherTenant,null,'other-test'),{sample:true});
      expect((await f.post('/api/demo/view', {participantId:other.participants[0]!.id})).statusCode).toBe(403);
      const current = await f.app.inject({method:'GET',url:'/api/state',headers:{cookie:f.cookie}});
      expect(current.json().workshop.id).toBe(f.seeded.workshop.id);
    } finally { await f.app.close(); await f.h.close(); }
  });
  it('fails closed even if the persisted participant view is cleared', async () => {
    const f = await fixture();
    try {
      await f.h.repo.db.execute('UPDATE sessions SET view_participant_id = NULL');
      const r = await f.app.inject({method:'GET',url:'/api/state',headers:{cookie:f.cookie}});
      expect(r.statusCode).toBe(403);
    } finally { await f.app.close(); await f.h.close(); }
  });
  it('keeps role preview available to the original owner of a private demo', async () => {
    const h = await createHarness(); const service = new Service(h.cfg,h.repo,()=>h.now);
    const app = buildApp({cfg:h.cfg,repo:h.repo,service});
    try {
      const opened=await app.inject({method:'GET',url:'/api/state'});
      const cookie=opened.cookies.map(c=>`${c.name}=${c.value}`).join('; ');
      const headers={cookie,'x-gatherready':'1'};
      const created=await app.inject({method:'POST',url:'/api/workshop',headers,payload:{sample:true}});
      expect(created.statusCode).toBe(200);
      const participant=created.json().participants[0];
      expect((await app.inject({method:'POST',url:'/api/demo/view',headers,payload:{participantId:participant.id}})).statusCode).toBe(200);
      expect((await app.inject({method:'POST',url:'/api/demo/view',headers,payload:{participantId:null}})).json().session.role).toBe('organizer');
    } finally { await app.close(); await h.close(); }
  });
});


describe('legacy session migration', () => {
  it('does not infer owner privilege from an old null view and persists restrictions across reopen', async () => {
    const dir=mkdtempSync(path.join(tmpdir(),'gatherready-migration-test-'));
    const file=path.join(dir,'synthetic.db');
    try {
      const old=new DatabaseSync(file);
      old.exec(`CREATE TABLE tenants(id TEXT PRIMARY KEY,synthetic INTEGER NOT NULL,created_at TEXT NOT NULL);
        INSERT INTO tenants VALUES('legacy',1,'2026-11-12');
        CREATE TABLE sessions(id_hash TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,view_participant_id TEXT,created_at TEXT NOT NULL,seen_at TEXT NOT NULL);
        INSERT INTO sessions VALUES('legacy-null','legacy',NULL,'2026-11-12','2026-11-12');
        INSERT INTO sessions VALUES('legacy-invite','legacy','participant','2026-11-12','2026-11-12');`);
      old.close();
      const migrated=await openDb(file); const repo=new Repo(migrated);
      expect((await repo.getSession('legacy-null'))?.participantBound).toBe(true);
      expect((await repo.getSession('legacy-invite'))?.participantBound).toBe(true);
      await repo.createSession('new-owner','legacy','2026-11-13');
      expect((await repo.getSession('new-owner'))?.participantBound).toBe(false);
      await repo.bindParticipantSession('new-owner','legacy','participant','2026-11-13');
      migrated.close();
      const reopened=await openDb(file);
      expect((await new Repo(reopened).getSession('new-owner'))?.participantBound).toBe(true);
      reopened.close();
    } finally {rmSync(dir,{recursive:true,force:true});}
  });
});
