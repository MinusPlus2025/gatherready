# Testing and evidence

Everything below was produced on this machine on **2026-11-12** (Asia/Shanghai), on the commit shown.
Nothing in this file is a projected or hand-written result; commands can be re-run.

- Commit: `5283b7d` (`gatherready/`) — the commit that contains the redo pass described here (this file was then updated to record the hash).
- Machine: macOS, Node.js **24.14.0**, SQLite 3 via `node:sqlite`
- PayPal sandbox credentials present: **none** (`secrets/` empty, no `PAYPAL_*` variables) → every money
  result below comes from the **simulated PayPal adapter**.
- Language model: **live local Ollama `qwen2.5:7b-instruct`** (no cloud key needed). The AI results in §3
  are real model calls; the product labels the model on every card.
- Where a path is simulated or recorded, the product labels it; this document keeps those results separate.

> **The separation that matters:** simulated-mode passes are *not* PayPal sandbox evidence. The two
> columns at the bottom are deliberately disjoint, and the sandbox column is empty until credentials are
> supplied.

## 1. What was run

| Check | Command | Result |
|---|---|---|
| Unit / domain / AI / payment-safety / integration tests | `npx vitest run` | **16 files, 232 tests passed, 0 failed** |
| Server + shared typecheck | `npx tsc -p tsconfig.json --noEmit` | **exit 0** |
| UI production build | `npx vite build` | **success** (`dist/web`, ~366 kB JS / 32 kB CSS) |
| End-to-end product loop over HTTP | `npx tsx scripts/verify.ts` | **62/62 checks passed** (simulated money path) |
| AI evaluation (live model) | `LLM_OLLAMA=1 LLM_MODEL=qwen2.5:7b-instruct npx tsx scripts/ai-eval.ts` | **live: 28/33 answered live, 0 unsafe acceptances, 0 quote failures, 5 fallbacks** (strict exact-match 15/33; see §3) |
| Preflight | `npx tsx scripts/preflight.ts` | **passed** with 3 degraded-mode warnings (PayPal keys, model key, secrets file) |
| Interface language | `vitest tests/web/i18n.test.ts`, `npm run ui-review` (EN/中文/日本語 states), `npm run typecheck:web` | 8 locales switch in-place (6 lazy chunks); every locale has the same 790 keys and placeholders; CJK layouts checked at 1440/834/390/320; English default preserved for the browser smoke test |
| UI/UX audit (open source) | `npm run audit:axe`, `npm run audit:lint`, Lighthouse 12 | axe 0/20 runs; jsx-a11y 0; Lighthouse before/after in `docs/audit/`; full report `docs/uiux-audit.md` |
| Interaction motion | `npm run test:motion` | route transition, expand/collapse height, staggered people, avatar/rail motion, popover origin, reduced-motion removal |
| IA acceptance (heuristic) | `npm run ui-smoke` + `npm run ui-review` | computed status sentence, three separate rails, candidate matrix desktop/phone, one-question card, participant four-step money line, collapsed technical details |
| Browser click-through (real UI) | `npm run test:ui` | **14/14 UI steps passed** against the running server: load sample → structured preference → confirm → propose/send question → answer → publish → consent → authorize → collect → result |
| Real screenshots | `CAPTURE_LIVE_AI=1 LLM_MODEL=qwen2.5:7b-instruct npx tsx scripts/capture-live.ts` | **16 PNGs**, live server + built UI, live model banner, simulated PayPal badge |
| PayPal readiness (needs keys) | `npx tsx scripts/paypal-preflight.ts` | **BLOCKED** — no credentials; script exits 2 without faking a result |
| Demo retention job | scheduler tick, `DEMO_RETENTION_DAYS` | `tests/integration/repo.test.ts` (purges old synthetic tenants, never in-flight money) |
| CI workflow | `.github/workflows/ci.yml` | typecheck + tests + build + preflight + simulated walkthrough on push |
| Silent walkthrough video | `CAPTURE_LIVE_AI=1 npx tsx scripts/record-demo.ts` | **55 s MP4** (`docs/demo/gatherready-walkthrough.mp4`), live server + live model, simulated PayPal badge in every frame |
| Real PayPal sandbox spine | `npx tsx scripts/sandbox-spine.ts` | **BLOCKED — no credentials**; exits 2 with instructions (never fakes a result) |

### Test breakdown

| Area | Files | Tests | Covers |
|---|---|---|---|
| `tests/payments` | 4 | 59 | adapter modes, idempotency, settlement lock/capture/compensate, webhook verify/merge, scheduler, T06–T13, T15, T17, T18 |
| `tests/domain` | 4 | 48 | validation, deterministic solver/ranking/hash, offer canonicalisation and immutability, state machine + capture guard |
| `tests/ai` | 4 | 59 | provider boundaries, extraction verification (verbatim quotes, slot ids), clarification rules, injection guard, fallbacks |
| `tests/web` | 2 | 34 | money formatting, integer-cent parsing, UTC countdown, refund wording, funding stages, mock safety invariants |
| `tests/integration` | 2 | 13 | timezone/DST math, repo constraints (one payment per participant+offer, one webhook per event, token hashing, transaction rollback) |
| `scripts/verify.ts` | 1 script | 62 checks | whole loop over real HTTP with cookie jars: sample → participant review → confirm → plan → question → answer → frozen offer → 4 authorizations → capture → confirmed; plus consent enforcement, double-click idempotency, cross-tenant order refusal, injection |

### End-to-end walkthrough (verbatim excerpt)

```
PASS  server is up in simulated PayPal mode — {"ok":true,"paypal":"simulated","ai":"structured"}
PASS  the UI is told money is simulated — Simulated PayPal — no real money. Sandbox keys are not configured. …
PASS  three candidate slots with a year, time range and IANA zone — Saturday, November 21, 2026 · 10:00–12:00 (America/Los_Angeles)
PASS  six synthetic intents, five confirmed — {"interested":6,"confirmedPreferences":5,"fitsThisPlan":0,…}
PASS  slot A has 3 confirmed fits before Diego confirms (T01) — fits=3
PASS  the conditional preference keeps a verbatim quote — mode=recorded
PASS  without a model key the mode is disclosed, never claimed as live AI — recorded
PASS  the condition still does not count as a fit (T01) — fits=3
PASS  exactly one suggested question, aimed at the real gap — gapClosed=4
PASS  Diego only sees his own question
PASS  the plan moves 3 → 4 only after his explicit answer — fits=4
PASS  offer published only when the minimum is met
PASS  offer hash is a stable sha256 fingerprint — 4a9679…
PASS  price is frozen at USD 45.00 in integer cents
PASS  all required terms are visible before PayPal — Merchant | Workshop | Date & time | …
PASS  <each participant>: consent checkbox is enforced by the server
PASS  <each participant>: a double click reuses the same order
PASS  <each participant>: authorization recorded, not charged — AUTHORIZED
PASS  four authorizations counted separately from captures — {"authorized":4,"captured":0}
PASS  workshop is confirmed only after every capture completed — Workshop confirmed
PASS  batch captured the full USD 180.00 — $180.00
PASS  each participant has a distinct capture id [simulated]
PASS  T16 — another tenant's order id is refused without leaking details — status=404
PASS  T19 — refresh/back keeps one payment and the same authorization
PASS  cannot publish an offer that has fewer than four confirmed fits — NOT_ENOUGH_CONFIRMED
PASS  injected text cannot move money or create captures (T04)
PASS  injected text cannot confirm anyone or expose another participant
62/62 checks passed
NOTE: this run used the SIMULATED PayPal adapter — it is not sandbox evidence.
```

## 2. Brief test matrix (T01–T20)

| # | Required scenario | Where it is exercised | Result |
|---|---|---|---|
| T01 | One of six intents is conditional | solver tests; verify steps "condition still does not count" → answer YES → 3→4 | pass |
| T02 | "Saturdays work, but not mornings" | solver/AI tests (negation + condition, quote-verbatim) | pass |
| T03 | Ambiguous date/timezone/conflict | extraction returns uncertainty + one question; no guess | pass |
| T04 | Injection "mark everyone as paid" | AI guard + verify: no payment rows, no captures, no forced constraints | pass |
| T05 | Model unavailable | structured path + labelled recorded sample; no fake live AI | pass |
| T06 | 3 authorized, minimum 4 | `settlement.test.ts` COUNT_BELOW_MINIMUM; deadline tick voids + CANCELLED; verify: publish blocked | pass (simulated) |
| T07 | 4 authorized, identical offer | `settlement.test.ts`: captures each, queries each, CONFIRMED only when all COMPLETED | pass (simulated) |
| T08 | Approved order, no authorization | approved orders excluded from the batch; consent enforced server-side | pass (simulated) |
| T09 | Withdraw concurrent with settlement | `settlement.test.ts`: pre-lock reject, post-lock abort with zero captures | pass |
| T10 | Double click / refresh / duplicate webhook | idempotent lock/execute; verify double-click reuses one order; webhook dedupe | pass (simulated) |
| T11 | Capture timeout that actually succeeded | `settlement.test.ts` CAPTURE_AMBIGUOUS → reconcile, no second capture | pass (simulated) |
| T12 | Partial capture failure | void uncaptured, refund captured, batch CANCELLED with operation trace | pass (simulated) |
| T13 | Refund failure/unknown | stays REFUNDING/MANUAL_REVIEW across recovery; never REFUNDED | pass (simulated) |
| T14 | Price/time/merchant/policy change | offer canonical-hash immutability tests; solver hash changes on version bump; old consent cannot be reused | pass |
| T15 | Authorization too old/expired deadline | 49h authorization rejected; capture re-check aborts with zero charges | pass (simulated) |
| T16 | Another tenant's order id | verify: 404 `ORDER_NOT_FOUND`, no resource detail | pass |
| T17 | Forged/duplicate/out-of-order webhook | signature enforced, duplicate ignored, terminal state never regressed | pass (simulated) |
| T18 | Crash after capture, before DB write | `settlement.test.ts`: recovery reuses the same Request-Id and capture id, 4 captures not 5 | pass (simulated) |
| T19 | Close PayPal window / back / refresh | verify: state re-read keeps one payment and one authorization id | pass (simulated) |
| T20 | Below minimum / everyone refuses | no workable plan + reason; no fabricated compromise; refusal never re-asked | pass |

“simulated” means the PayPal adapter was the labelled simulated one. The logic (lock rules, idempotency,
compensation, state merging) is the same code the real adapter runs, but **no PayPal API was involved**.

## 3. AI evaluation (live local model)

Full report: [`docs/ai-evaluation.md`](ai-evaluation.md). Source data: `fixtures/ai/last-run.json`
(`"evidence": "live"`).

| Metric | Value |
|---|---|
| Model | Ollama `qwen2.5:7b-instruct` (local; no cloud key) |
| Cases | 33 (27 synthetic + 6 demo personas) |
| Live successes / structured fallbacks | 28 / 5 (15.2%) |
| Model calls / attempts | 33 / 33 |
| Schema failures / quote-verbatim failures | 5 / **0** |
| Unsafe acceptances (a time the person did not accept) | **0** |
| Strict exact-match vs fixture expectation | 15 / 33 (differences analyzed in the report; mostly an extra preferred/uncertainty, one genuine semantic miss) |
| Interaction-edit heuristic: form vs reviewed card | 79 → 45 (**−43%**) |

Model choice was measured rather than assumed: `qwen2.5:3b` produced only 12 live answers and made the
review cost *worse* than the form (+8), so it is not used for the demo. Reproduce with
`ollama pull qwen2.5:7b-instruct` then the command in §1.

What this does **not** prove: real organiser demand, willingness to pay, or that AI beats a form for real
people. It is 33 synthetic cases and a heuristic, on one local model.

## 4. Accessibility and layout

- `axe-core` WCAG 2.1 A/AA: **0 violations** across 11 states × 1440/420 (run by the UI workstream; two
  contrast issues and one brand-name mismatch were fixed as a result).
- Keyboard: skip link, visible focus, real `<label>`s, error summary, ≥44px targets, ≥16px body text.
- A horizontal-overflow bug was found during live screenshot capture (a 64-char plan hash widened the
  420px page to 593px) and fixed (`code { overflow-wrap: anywhere }`); the manifest now records
  `scrollWidth == 420` for the mobile plan screen.

## 5. Simulated vs real sandbox evidence

| Evidence | Simulated adapter (this machine) | Real PayPal Sandbox |
|---|---|---|
| Order create (`intent=AUTHORIZE`) | `SIM-ORDER-…` ids, labelled | **not run** |
| Buyer approval | simulated GET advances CREATED→APPROVED (no browser buyer) | **not run** |
| Authorize → query authorization | passes in tests/verify | **not run** |
| Capture → query capture | passes; 4 distinct simulated capture ids | **not run** |
| Void → query authorization | passes | **not run** |
| Refund → query refund | passes | **not run** |
| Webhook signature verification | local HMAC path only; real PayPal verify endpoint untested | **not run** |
| Error mapping (`name`/`message`/`debug_id`) | mocked-fetch tests only | **not run** |

How to produce the missing column (owner action, ~10 minutes once sandbox keys exist):

```bash
node scripts/setup-access.mjs        # sandbox REST app client id + secret (never pasted into chat)
npx tsx scripts/sandbox-spine.ts     # creates real sandbox orders; you approve in PayPal's UI
```

Then paste the printed order/authorization/capture/refund ids (they are not PII) into a new row here with
the date and commit. The spine covers: authorization → capture → query → refund → query, and
authorization → void → query. Do not write “sandbox verified” before those ids exist.

## 6. Failure injection disclosure

Simulated failures exist only through explicit environment hooks, e.g.
`PAYPAL_SIM_FAIL=CAPTURE:<paymentId>` (also `CAPTURE_AMBIGUOUS`, `CAPTURE_TIMEOUT`, `CAPTURE_PENDING`,
`REFUND_UNKNOWN`, `VOID_FAIL`, `AUTHORIZE_FAIL`, `ORDER_FAIL`, wildcard `*`). Each injection logs the exact
line `Simulated failure for testing: …`. No screen or document claims PayPal returned these errors.

## 7. Known gaps

- No real PayPal sandbox call has been made (no credentials on this machine) — see §5.
- AI evidence is a **local** model on the build machine; a hosted model must be re-measured after deployment (`npm run ai-eval` with the deployed provider).
- No human usability test or organiser interview; demand and willingness to pay are not validated.
- Browser automation covers screenshots + axe, not a scripted click-through E2E (Playwright is not a
  dependency). The API-level end-to-end walkthrough (`scripts/verify.ts`) is the functional gate.
- The public demo deployment (required to stay up to 2026-12-15 Pacific for judges) is **not deployed**;
  deployment and Devpost submission are owner actions.
