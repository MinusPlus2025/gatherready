# P0 acceptance audit (redo pass)

Audited against the brief's own P0 list (`paypal_brief.md` §11) plus the §0 directives, on **2026-11-12**,
commit after this pass: run `git log -1` in `gatherready/`. This file is deliberately blunt: every
"PASS" names the command or file that proves it, and anything that depends on owner credentials is
marked **BLOCKED**, not "done".

Statuses:

- **PASS** — implementation and evidence exist in this checkout, reproducible by the reader.
- **PASS (simulated money)** — the product logic is implemented and verified, but the PayPal calls in the
  evidence come from the labelled simulated adapter (no sandbox credentials here).
- **BLOCKED (owner)** — cannot be completed without something only the project owner can supply.

| # | P0 item (brief §11) | Implementation | Evidence | Status |
|---|---|---|---|---|
| 1 | Real model extraction + participant confirmation | `src/server/ai/{provider,extract,clarify}.ts`; JSON-constrained decoding on Ollama; schema + verbatim-quote verifier; confirm-before-count enforced server-side | `docs/ai-evaluation.md` (live run), `fixtures/ai/last-run.json` (`evidence:"live"`), `npm run ai-eval` | **PASS** (local model; hosted key is a drop-in) |
| 2 | Deterministic planning across three times | `src/server/domain/solver.ts` (pure, total ordering, no model scores) | `tests/domain/solver.test.ts`; `npm run verify` steps 1–4 | PASS |
| 3 | One effective clarification, refusal respected | `src/server/domain/solver.ts` suggestion + `src/server/ai/clarify.ts` guard + `service.answerClarification` | `tests/domain` + `tests/ai`; `npm run verify` (3→4 only after answer); no re-ask test | PASS |
| 4 | Immutable offer (hash, frozen terms) | `src/server/domain/offer.ts` canonical JSON + sha256; `service.publishOffer`; consent stores offer hash | `tests/domain/offer.test.ts`; `npm run verify` hash check | PASS |
| 5 | Per-participant independent PayPal authorization | `src/server/payments/paypal.ts` (Orders v2 `intent=AUTHORIZE`, Payments v2 authorize/void/capture/refund), `service.startCheckout/completeCheckout` | `tests/payments/paypal.test.ts`, `tests/payments/settlement.test.ts`; `npm run verify` (4 independent simulated authorizations) | **BLOCKED (owner)**: needs real sandbox IDs; simulated IDs are labelled and are not sandbox evidence |
| 6 | Minimum-participant gate | `lockBatch` validation + solver minimum | `tests/payments/settlement.test.ts` T06/T08; verify publish blocked below minimum | PASS (simulated money) |
| 7 | Batch capture | `payments/settlement.ts` serial captures + per-capture query | T07; verify: four distinct capture ids, CONFIRMED only after queries | PASS (simulated money) |
| 8 | Void when the minimum is not reached | `jobs/scheduler.ts` cancel-expired-offer + `voidAuthorizedPayment` | `tests/payments/scheduler.test.ts`; T06/T15 | PASS (simulated money) |
| 9 | Partial-failure compensation | `compensateBatch`: void uncaptured, refund captured, MANUAL_REVIEW when unknown | T11/T12/T13; `npm run verify` failure path | PASS (simulated money) |
| 10 | Persistence + idempotency | SQLite WAL + `BEGIN IMMEDIATE`; unique indexes; `operations` table with stable `PayPal-Request-Id` | `tests/payments/*` (T10/T18); `tests/integration/repo.test.ts`; verify double-click | PASS |
| 11 | Result reconciliation | browser return only queries; webhook verify + dedupe + forward-only merge; recovery scheduler | T17/T18; `tests/payments/webhook.test.ts` | PASS |
| 12 | Mobile + desktop main pages | 8 screens + landing at 1440/420; axe WCAG 2.1 AA | `docs/screenshots/` (live captures), `docs/testing.md` | PASS |
| 13 | Runnable code + English README | Fastify + React + SQLite; `npm ci` verified; README run steps; English docs | `README.md`, `.github/workflows/ci.yml`, `npm test` 232 tests | PASS |
| 14 | Publicly viewable demo material | screenshots + 60 s walkthrough video exist; `docs/DEPLOY.md` prepared; repo ready to publish | `docs/demo/gatherready-walkthrough.mp4`, `docs/screenshots/`, `docs/DEPLOY.md` | **BLOCKED (owner)**: public GitHub repo, YouTube upload, hosted demo, Devpost submission are owner actions |

## §0 directives and other P0-adjacent requirements

| Requirement | Status | Note |
|---|---|---|
| Verify PayPal create/approve/authorize/capture/void/refund against sandbox; report real errors | **BLOCKED (owner)** | `scripts/paypal-preflight.ts` (OAuth + order create/query + webhook registration) and `scripts/sandbox-spine.ts` (interactive authorize→capture→query→refund→query, authorize→void) are ready; neither can run without credentials |
| AI understands "only / prefer / if…then", keeps source evidence, asks the person to confirm | PASS | verbatim-quote verifier; confirm endpoint; `/participant/preferences` review card |
| AI never consents for a person, never edits hard constraints, never decides charges | PASS | no money tools reachable from AI modules; consent requires participant click + server-side `consent:true`; amounts from frozen offer |
| No fake success in degraded mode; label simulated/recorded | PASS | mode banner + per-row `simulated` + `docs/testing.md` separation |
| At least 20 synthetic AI inputs with form baseline | PASS | 33 cases, see `fixtures/ai/cases.ts` |
| Non-atomic payments explained, not claimed atomic | PASS | README + architecture + result copy |
| Security: sandbox guard, tenant isolation, token hashing, ownership checks, redacted logs, 7-day demo retention | PASS | `config.assertSandbox`, `routes.resolveContext`, `service.completeCheckout` ownership-first, `repo.purgeSyntheticTenantsOlderThan` + scheduler |
| No credentials or PII in repo/screenshots/video | PASS | `git ls-files` check; screenshots show synthetic `SIM-` ids only |

## What changed in this redo pass

1. **Live AI is now real on this machine** (previously recorded/structured only): local Ollama support was
   exercised with `qwen2.5:7b-instruct`, JSON-constrained decoding + prompt few-shot examples were added,
   and the extraction path was re-measured live (28/33 live, 0 unsafe acceptances, 0 quote failures,
   heuristic review cost −43%; `docs/ai-evaluation.md`). A smaller `qwen2.5:3b` was measured and rejected
   because it made review more expensive than the form — that comparison is in the report. A hosted
   OpenAI-compatible/Gemini key remains the recommended path for the deployed demo.
2. **Prompt and verifier hardening**: one conditional quote rule + worked example; retry budget unchanged
   (one bounded retry); schema + verbatim quote still authoritative.
3. **Demo retention implemented**: synthetic tenants older than `DEMO_RETENTION_DAYS` (default 7) are
   purged by the scheduler, but never while money is in flight. Test added.
4. **PayPal readiness tooling**: `scripts/paypal-preflight.ts` proves OAuth/order-create/query and
   registers the webhook, writing the webhook id into the git-ignored secrets file.
5. **CI**: `.github/workflows/ci.yml` runs typecheck, tests, build, preflight and the simulated
   end-to-end walkthrough on every push.
6. **Browser click-through fixes** (found by `npm run test:ui`, which now runs the real UI): the web
   client was missing the server's `x-gatherready` CSRF header (every mutation was rejected), the
   static build served stale JS with the wrong MIME type after a rebuild (blank page), and the plan
   screen's "Review question" had no way to create the stored proposal (dead end before sending).
   All three are fixed and the full click-through now passes 14/14.
6. **Purpose/retention notice** added to the participant preferences screen (brief §9).
7. **Deployment runbook** for a judge-accessible demo: `docs/DEPLOY.md`.

## What the owner must do before this can be submitted

1. Create/record PayPal **sandbox** credentials via `node scripts/setup-access.mjs` (see the risk notes the
   Lead wrote in chat; never paste secrets into chat or the repo).
2. Run `npm run paypal-preflight`, then `npm run sandbox-spine`; paste the real resource ids into
   `docs/testing.md` §5 and re-record the demo with the **Sandbox** badge.
3. Provide a model key for the deployed demo (or deploy a host that can run Ollama); rerun `npm run ai-eval`
   in live mode and pin the report.
4. Publish the repo (MIT visible in About), upload the <3 min video to YouTube, deploy per `docs/DEPLOY.md`,
   verify judge access until 2026-12-15, and submit on Devpost.

Until 1–3 exist, the honest submission state is: **AI verified live locally; PayPal verified against the
labelled simulated adapter only; public demo material not yet published.**
