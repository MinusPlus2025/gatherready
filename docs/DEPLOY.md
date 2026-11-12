# Deploying the judge-accessible demo

> **Current status (2026-11-13): not deployed.** No cloud host account/token, hosted
> model key or PayPal sandbox keys are available in this environment; no paid service
> was started. See [`deploy-status.md`](deploy-status.md) for the account audit, costs,
> local persistence/isolation evidence and the exact owner inputs needed.

Rules require the project to be runnable by judges and **free and available through the end of judging
(2026-12-15 08:00 PT)**. Two acceptable paths: a hosted demo URL, or complete setup/run instructions.
The repo already has the second path; this file is the first path.

> The deploy is an owner action. Do not publish the demo with simulated PayPal and call it a PayPal
> integration: judges must see the **sandbox** badge (`Sandbox · No real money`) and a real sandbox buyer
> approval. If you cannot deploy with sandbox keys, keep the local instructions as the access path and
> state it in the submission description.

## What the app needs

| Requirement | Why |
|---|---|
| Node.js ≥ 22.5 | `node:sqlite` |
| A writable directory for `GATHERREADY_DB` | SQLite; mount a small persistent disk if the host offers one |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | real sandbox integration (never in the repo) |
| `PAYPAL_WEBHOOK_ID` | webhook signature verification; created by `paypal-preflight` once the URL is public |
| One model key (OpenAI-compatible or Gemini) | live AI. Ollama is local-only and not available on a hosted free tier |
| `PUBLIC_BASE_URL=https://<your-host>` | PayPal return/cancel URLs and webhook URL must be absolute and https |

`PAYPAL_FORCE_SIMULATED=1` is only for local demos/tests. Leave it unset on the public deployment.

## Render (paid web service + disk — not free)

Render **Free** web services have an ephemeral filesystem and **cannot attach a
persistent disk**. Free instances also spin down after 15 minutes idle; SQLite data
would be lost. A compliant deployment therefore needs the cheapest paid web plan
(0.5 CPU / 512 MB, **$7/month**) plus a 1 GB disk (**$0.25/GB/month**), about
**$7.25/month** before bandwidth overage. Do not start it without owner approval.

1. Push the repository (public) to GitHub. The needed license/README are already in place.
2. Render → **New → Web Service** → connect the repo. Alternatively sync the
   checked-in [`render.yaml`](../render.yaml) after adding secret values.
   - Build command: `npm ci && npm run build`
   - Start command: `npm start`
   - Environment: Node 24; plan `0.5c-512mb` (paid).
3. Add a **disk** (1 GB is enough), mount at `/var/data`, and set `GATHERREADY_DB=/var/data/gatherready.db`.
   Without a disk the app still works, but every restart forgets browser sessions and
   violates the persistence acceptance check.
4. Environment variables:
   - `PUBLIC_BASE_URL=https://<service>.onrender.com`
   - `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
   - `LLM_PROVIDER=openai` (or `gemini`), `LLM_MODEL=...`, `LLM_API_KEY=...`
   - `DEMO_RETENTION_DAYS=7` (default; demo text is purged after a week)
5. Deploy, open the URL, click **Load sample (synthetic demo data)**, and walk the flow once.
6. Register the webhook against the public URL:
   ```bash
   PUBLIC_BASE_URL=https://<service>.onrender.com \
   PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... \
   npx tsx scripts/paypal-preflight.ts
   ```
   It prints the webhook id and writes it into `secrets/access.json` locally; add the same value as
   `PAYPAL_WEBHOOK_ID` in the host's environment and redeploy.
7. Run the sandbox spine locally against the same app (`npx tsx scripts/sandbox-spine.ts`) to confirm the
   app's PayPal configuration before recording the video.

**Free-tier sleep:** Render free services spin down after inactivity; the first judge request is slow but
works. If the spin-down is unacceptable, either add a free uptime pinger or use a paid instance — do not
let the demo 404 between Nov 13 and Dec 15.

## Fly.io / Railway

Same variables. Fly: mount a volume at `/data`, set `GATHERREADY_DB=/data/gatherready.db`, `fly deploy`.
Railway: add a volume and the same env vars. Both need a one-time `npm run build` in the start config
(`npm ci && npm run build && npm start`).

## Judge test account (owner decision, rules allow it)

Judges cannot complete a real sandbox authorization without a PayPal sandbox **personal** (buyer) login.
The rules allow test-account credentials in the README. If you put them there:

- use a **dedicated sandbox buyer** account created for this purpose (never your real PayPal login);
- put the credentials in the submission description / README text, not in the repo as a committed secret
  file (repo is public; a sandbox buyer password is test-only but still rotate it after judging);
- state clearly: *sandbox only, no real money, do not reuse this password anywhere*.

Alternatively keep the demo local and let judges use the README run instructions; the video then carries
the sandbox evidence.

## Post-deploy checklist

- [ ] `https://<host>/healthz` returns `{"ok":true,"paypal":"sandbox","ai":"live"}`
- [ ] `Load sample` shows the **Sandbox** badge, not `Simulated PayPal`
- [ ] One full sandbox authorization returns `Authorized — not charged`
- [ ] Organizer collect → `Workshop confirmed`, per-person capture ids distinct
- [ ] Webhook endpoint reachable over https; a test event is verified (PayPal dashboard → Webhooks → simulate)
- [ ] No secrets or sandbox buyer password in the repository, screenshots, or video
- [ ] Demo stays up (free) until 2026-12-15
