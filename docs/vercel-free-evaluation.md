# Vercel Free / Turso evaluation (branch only)

Date: 2026-11-13. Status: **blocked before deployment; nothing was deployed or
charged.** This branch contains evaluation only, not a working Vercel adapter.

## 1. Account and plan check

| Item | Finding |
|---|---|
| Vercel account | No CLI auth/config or `VERCEL_TOKEN` in this environment; `~/.vercel` is absent; `npx vercel whoami` did not produce an authenticated identity. |
| Hobby plan | Vercel Hobby is free, but "current account is Hobby" cannot be confirmed without an authenticated account. No account was created. |
| Turso account | No `TURSO_*` env vars/tokens and no CLI login; Free plan is $0 with 5 GB storage, 500M rows read/10M rows written per month, but cannot be used without an account/token. |
| Cloudflare Workers AI | No Cloudflare account/API token or model binding; free quota exists in principle but is not available/tested here. |
| PayPal sandbox | Existing app credentials are not loaded (see `audit/paypal-diagnosis.json`); no new account created. |

## 2. Why the current app is not a Vercel drop-in

- `src/server/repo.ts` uses synchronous `node:sqlite`; Vercel Functions have an
  ephemeral filesystem, so SQLite would lose data on every invocation/cold start.
  A remote libSQL/Turso client plus transactional rewrites are required.
- The service is a long-lived Fastify instance with a 30-second settlement/retention
  scheduler and polling. Vercel Functions are request-scoped, not an always-on
  process.
- The existing static server, PayPal return/cancel routes and webhook need an HTTP
  adapter and a public HTTPS origin.
- Local Ollama at `localhost:11434` is unreachable from Vercel. A hosted model key is
  mandatory.

## 3. Free-plan timing constraints (from official docs)

- Vercel **Hobby cron jobs can run at most once per day** and are scheduled with
  ~hourly precision; expressions like every 30 seconds are rejected. Source:
  [Vercel cron pricing](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing).
  (`Pro` supports per-minute, but that is a paid upgrade and is not used.)
- Hobby functions can run up to 300s per invocation, but an invocation is not a
  resident process; there is no guarantee that an unused project executes our
  30-second tick. Source:
  [Vercel function limits](https://vercel.com/docs/functions/limitations).
- Therefore the current automatic capture/void deadline behavior **cannot be
  claimed on free Vercel**. A free-path design would have to:
  - run settlement/reconciliation only on explicit requests or a daily cron;
  - make the deadline behavior idempotent and lazy (reconcile on next visitor
    request/webhook), or move the demo to organizer-triggered collect;
  - display that automatic settlement is unavailable on the free plan.
  That redesign was not implemented on this branch.

## 4. What a free implementation would require (not done)

1. A Vercel Hobby account already authorized for this project, and a deploy token.
2. A Turso Free database (or another free remote libSQL) and account token; rewrite
   `node:sqlite` repository calls to the remote driver while preserving transactions,
   unique constraints, idempotency and per-visitor scoping.
3. A hosted free model account/token (e.g. Cloudflare Workers AI) with a tested model
   call and a server-only secret; local Ollama cannot be used.
4. Existing PayPal sandbox app credentials + HTTPS callback registration.
5. A Vercel Fastify adapter/entry and a settlement design that does not rely on a
   resident 30-second scheduler.
6. Two-incognito isolation, redeploy persistence and free-quota tests. None of these
   can be truthfully checked before 1–4 exist.

## 5. Fallback evaluation

Render Free has the same account/token gap and an ephemeral filesystem; it spins down
after idle. A remote database would solve persistence but not the always-on scheduler,
and still needs model/PayPal credentials. It was not deployed. The current local
single-instance build remains the only complete, verified runtime.

## 6. Verdict

**Free Vercel route: blocked, not attempted as a fake deployment.** The blockers are
account/token access, the SQLite-to-remote-DB rewrite, the serverless scheduler, a
hosted model credential and PayPal sandbox credentials. No paid plan was started and
no static page is presented as the product.
