/** Experimental only. No routes and no startup migration. Not legacy recovery. */
import { createHash, randomBytes } from 'node:crypto';
import type { Repo } from '../repo.js';
import { randomSessionToken, sessionHashOf } from '../service.js';
const hash = (token: string) => createHash('sha256').update(`gatherready.owner-transfer.v1:${token}`).digest('hex');
const rejected = () => new Error('Owner transfer unavailable or expired');
export class OwnerTransferPrototype {
  constructor(private readonly repo: Repo, private readonly now: () => number = Date.now) {}
  /** Explicit disposable-fixture installer, never called by startup. */
  async installPrototypeSchema(): Promise<void> {
    await this.repo.run(`CREATE TABLE IF NOT EXISTS owner_transfer_prototype (
      tenant_id TEXT PRIMARY KEY REFERENCES tenants(id), token_hash TEXT NOT NULL UNIQUE,
      issuer_session_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER)`);
  }
  async issue(ownerSessionHash: string): Promise<{token: string; expiresAt: number}> {
    return this.repo.tx(async () => {
      const owner = await this.repo.getSession(ownerSessionHash);
      if (!owner || owner.participantBound || owner.viewParticipantId) throw rejected();
      const token = randomBytes(32).toString('base64url');
      const expiresAt = this.now() + 15 * 60_000;
      await this.repo.run(`INSERT INTO owner_transfer_prototype
        (tenant_id,token_hash,issuer_session_hash,expires_at,consumed_at) VALUES(?,?,?,?,NULL)
        ON CONFLICT(tenant_id) DO UPDATE SET token_hash=excluded.token_hash,
        issuer_session_hash=excluded.issuer_session_hash,expires_at=excluded.expires_at,consumed_at=NULL`,
        owner.tenantId,hash(token),ownerSessionHash,expiresAt);
      return {token,expiresAt};
    });
  }
  async redeem(token: string): Promise<{sessionToken: string}> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw rejected();
    return this.repo.tx(async () => {
      const now = this.now();
      const row = await this.repo.one<{tenant_id:string;issuer_session_hash:string}>(
        `UPDATE owner_transfer_prototype SET consumed_at=? WHERE token_hash=?
         AND consumed_at IS NULL AND expires_at>? RETURNING tenant_id,issuer_session_hash`,now,hash(token),now);
      if (!row) throw rejected();
      const issuer = await this.repo.getSession(row.issuer_session_hash);
      if (!issuer || issuer.participantBound || issuer.viewParticipantId || issuer.tenantId !== row.tenant_id) throw rejected();
      const sessionToken = randomSessionToken();
      await this.repo.createSession(sessionHashOf(sessionToken),row.tenant_id,new Date(now).toISOString());
      return {sessionToken};
    });
  }
}
