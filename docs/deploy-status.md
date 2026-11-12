# Judge-accessible deployment status

Date: 2026-11-13 (Asia/Shanghai)
Decision: **no public URL was created.** The project is complete locally, but the
available account/credential set does not satisfy the deployment rules without
creating a paid service or a new account. No paid service was started.

## Account / credential audit

| Target | What exists | Result |
|---|---|---|
| GitHub | `gh` authenticated as `MinusPlus2025` (repo scope) | Source can be pushed, but GitHub cannot host a persistent Fastify/SQLite process |
| Render | no CLI, API token or signed-in session in this environment | cannot create a service |
| Railway / Fly.io / Vercel / Netlify / Cloudflare | no CLI or token found | cannot create a service |
| Cloud model key | none (`LLM_API_KEY` unset; local Ollama only) | a remote host cannot call the Mac's `localhost:11434` |
| PayPal Sandbox | `secrets/access.json` PayPal fields empty | real authorization/capture/void is blocked |
| Paid permissions | user has not authorized a purchase | no paid plan or disk was created |

A scan of cloud credential directories was partly blocked by the environment's
secret safety rule; no credential was read or printed. The absence above is based
on available CLIs/tokens and the project's own `secrets/access.json`.

## Hosting cost check (public docs)

- Render **Free** web services have an ephemeral filesystem; local files (including
  SQLite) are lost on restart/redeploy/spin-down, and free services spin down after
  15 minutes. Free services **cannot attach a persistent disk**.
  Sources: [Render free instances](https://render.com/docs/free), [persistent disks](https://render.com/docs/disks).
- The cheapest Render web plan is **$7/month** (0.5 CPU / 512 MB) and a 1 GB
  persistent disk is **$0.25/GB/month**, so a compliant single-instance Render
  deployment is about **$7.25/month** plus bandwidth overage; Hobby includes 5 GB
  bandwidth/month. Source: [Render pricing](https://render.com/pricing).
- Railway/Fly.io have their own plans/volumes and require an account/payment
  method; they were not enabled. No service was created.

This matches the user's rule: evaluate first, do not start a paid service without
explicit permission.

## What is already verified locally

- **Persistence:** two visitors each received a distinct tenant/workshop; after a
  full server stop/start with the same SQLite file, both sessions and workshops
  survived and remained distinct.
  Evidence: [`audit/local-persistence-isolation.json`](audit/local-persistence-isolation.json).
- **Production cookie mode:** with `PUBLIC_BASE_URL=https://…`, the session cookie
  is `HttpOnly; Secure; SameSite=Lax` and Fastify trusts the HTTPS proxy for the
  client IP. Verified with a temporary local server (`set-cookie` header), not a
  live cloud proxy.
- **Limits:** per-IP HTTP limit (240 requests/minute) and a per-day LLM call cap
  (`LLM_MAX_CALLS_PER_DAY`, default 400) are in the server; demo tenants are
  isolated per visitor and synthetic data is purged after 7 days.
- **Real AI:** local Ollama evidence exists; this is the same code path a hosted
  OpenAI-compatible/Gemini key would use.
- **Real PayPal Sandbox:** blocked, no keys.


## Local fallback (rules-allowed access path)

If no public host is approved before the deadline, judges can run the complete
product locally. This is the complete app, not a static mock:

```bash
# Node.js >= 22.5 (uses node:sqlite)
npm ci
npm run build

# terminal A: real local AI (optional; without it the UI labels structured/recorded mode)
ollama serve
ollama pull qwen2.5:7b-instruct

# terminal B
GATHERREADY_DB="$PWD/data/gatherready.db" \
LLM_OLLAMA=1 LLM_MODEL=qwen2.5:7b-instruct \
LLM_TIMEOUT_MS=240000 npm start
# open http://localhost:5180
```

Payment is labelled **Demo payment — no PayPal transaction** unless sandbox keys
are supplied through `secrets/access.json` or environment variables. Data persists in
`data/gatherready.db`; each visitor gets an isolated synthetic tenant. A server
restart keeps both visitors' data (verified locally, see
[`audit/local-persistence-isolation.json`](audit/local-persistence-isolation.json)).

For a judge-facing machine, keep the process supervised (e.g. a terminal/tmux or
launchd) and do not expose it publicly without TLS and authentication/rate-limit review.

## Why a tunnel was not published

A Cloudflare Quick Tunnel or SSH reverse tunnel could expose the Mac's running app
with an HTTPS URL and no paid account, but:

- the URL is ephemeral and stops working when the Mac sleeps or the tunnel exits;
- it exposes the local machine to public traffic and requires explicit owner consent;
- judges need access through 2026-12-15; a tunnel with no uptime guarantee is not a
  dependable submission link;
- PayPal sandbox keys are still missing, so it would still be a simulated-payment
  demo.

If the owner wants a temporary tunnel for an immediate judge call, say so
explicitly and keep the Mac awake; it is not framed as a production deployment.

## Fast path once owner inputs arrive

Required inputs (never commit them):

1. A host account/token with a **single always-on service + persistent disk**
   (Render paid, Railway volume, or Fly volume). Render blueprint:
   [`render.yaml`](../render.yaml).
2. A hosted model key: `LLM_PROVIDER=openai|gemini`, `LLM_MODEL`, `LLM_API_KEY`.
3. PayPal sandbox: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, buyer test account
   if judges must authorize; `PAYPAL_WEBHOOK_ID` after the public URL is known.

Then:

```bash
npm run deploy:check   # prints READY/BLOCKED, never secrets
# after deploy:
curl -s https://<host>/healthz
# expect {"ok":true,"paypal":"sandbox","ai":"live"}
npx tsx scripts/paypal-preflight.ts  # registers/prints webhook id
npx tsx scripts/sandbox-spine.ts     # real authorize / capture / void path
```

The post-deploy checklist remains in [`DEPLOY.md`](DEPLOY.md): real sandbox
authorization, capture, webhook signature, two visitor browsers, restart
persistence, and no secrets in screenshots/video.

## Acceptance status

| Requirement | Status |
|---|---|
| Public link a stranger can open and operate | **not delivered** — no usable host account/credential; static page was not substituted |
| Refresh + server restart keep data | **done locally** — evidence JSON |
| Real AI | **done locally** (Ollama); hosted model **blocked** by missing key |
| Real PayPal Sandbox authorization/capture/void | **blocked** — missing sandbox keys |
| Two visitors isolated | **done locally** — distinct tenants/workshops, survive restart |
| Production HTTPS cookies / limits | **cookie+proxy verified locally**; cloud TLS not exercised |
| Costs | Render ≈$7.25/mo for a disk-backed instance; no charge made |
| Source/video/submission alignment | public repo, YouTube and Devpost not published; local build/video are current commit |
