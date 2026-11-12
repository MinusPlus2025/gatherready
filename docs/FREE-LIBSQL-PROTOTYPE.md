# Free deployment adaptation: experimental handoff

Base: `fe212d7`. Implemented only in an independent worktree. Do not overwrite the active DS worktree.

## Implemented

- SQLite persistence replaced with `@libsql/client` behind async Repo operations.
- All affected service, payment, webhook, route/session and scheduler call chains await reads, writes and transactions.
- Transactions use a per-async-context executor (AsyncLocalStorage), commit after the callback finishes, roll back on failure, reject nested transactions, and preserve affected-row semantics.
- Local paths and `:memory:` still work for development and tests. Remote `LIBSQL_URL` + server-side `LIBSQL_AUTH_TOKEN` can be supplied. Remote schema initialization is explicit via `scripts/migrate-libsql.ts`; ordinary startup never auto-migrates the remote database.
- Existing persistent-server entry preserves the non-blocking 30-second scheduler.
- `api/index.ts` and `vercel.json` provide an EXPERIMENTAL Vercel request adapter. It rejects local DB URLs and local Ollama configurations and requires `GATHERREADY_SERVERLESS_EXPERIMENT=true`. This gate is not proof of readiness.
- The serverless adapter exposes `/api/deployment-status` honestly: no unattended deadline/recovery scheduler is provided. It must NOT be described as a complete production-equivalent deployment.

## Validation

- TypeScript check passed.
- Vite production build passed.
- Original 257 tests passed on async local libSQL. Two original synchronous `toThrow` assertions were converted to awaited `rejects.toThrow`; assertions were not removed.
- Six new tests cover persistence across DB reopen; HTTP two-visitor isolation and app restart; overlapping settlement locks; two independent local DB clients; overlapping simulated capture; injected database/provider delay during overlapping execution.
- All payment tests use the explicitly simulated PayPal adapter. No actual Sandbox authorization, capture, refund or webhook was executed.
- No remote Turso service, remote HTTP driver, Vercel build/deployment or externally triggered recovery has been tested. Local delay injection is not a substitute for those tests.

## Not ready / hard gates

1. Hosted database account/resource and free quota must be established without paid upgrades. Do not copy another application's DB. Initialize a NEW isolated database only after the authorized destination is confirmed.
2. A reliable recovery/expiry runner and cross-instance coordination remain missing for Vercel. Existing server process keeps setInterval, but Vercel does not guarantee background execution. Request-triggered jobs/daily cron do not preserve the 30-second behavior. Render Free sleeping is also not an uninterrupted scheduler.
3. Verify remote transaction timeout, duplicate webhook and multi-instance capture/compensation/recovery against real remote libSQL. The existing local concurrency checks establish local invariants only.
4. Current IP rate limiting is a per-process Map, not a distributed limit. Enforce shared model/payment quotas before public exposure.
5. Existing Sandbox application credentials, approved sandbox buyer flow, registered/verifiable webhook and a real hosted model are still required. Sandbox is free and does not move real funds; that does not provide app hosting/database for free automatically.
6. Re-run all tests after merging with any newer DS commits; verify existing UI with the new async server and real model. No UI redesign was attempted here.
7. Submission claims must match evidence. Do not call this branch deployed, fully working online, or a real Sandbox demonstration.

## Commands (isolated worktree)

```
npm ci
npm run typecheck
npm run build
npm test
```

For an explicitly approved isolated remote database only:

```
# Set LIBSQL_URL and LIBSQL_AUTH_TOKEN via secret storage, never chat/Git.
GATHERREADY_ALLOW_ISOLATED_MIGRATION=true npx tsx scripts/migrate-libsql.ts
```

Do not execute that migration against any shared/production DB. Do not deploy the paid `render.yaml` from the base project. No resources were created, no accounts were opened, no credentials were inspected, no fees were incurred during this experiment.
