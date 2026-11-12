# GatherReady

<p align="left"><img src="public/logo-mark.svg" width="56" height="56" alt="GatherReady logo" /></p>

**Turn conditional workshop interest into one plan people actually agree to fund.**

A small web product for the [PayPal AI Hackathon 2026](https://paypalaihackathon.devpost.com/):
an AI reads messy availability messages into reviewable constraints, a deterministic solver finds the
one time a group can actually agree on, and a participant answers at most one clarifying question.
The payment implementation is designed to collect PayPal authorizations only against the exact plan
each person accepted, then capture when the minimum group is met, or compensate failed batches.
These implemented behaviours must not be confused with completed Sandbox verification.

**Sandbox-targeted prototype · no real funds · MIT**

### Verification status — 12 November 2026

- **Verified against PayPal Sandbox:** OAuth authentication, Orders v2 `AUTHORIZE` order creation and
  retrieval, and the provider-returned USD 45.00 amount.
- **Not yet verified:** buyer approval, authorization resources, capture, void, refund, public HTTPS
  callbacks or webhook delivery. Creating an order is not a completed payment.
- **Recorded UI payment demonstrations are simulated** unless the specific recording explicitly
  documents a successful Sandbox transaction. A Sandbox mode badge alone is not proof of payment.
- **AI:** local Ollama inference has been exercised; each extraction still needs its own success
  check and participant confirmation. Missing/unavailable models and failed extractions are not live AI.

See [`docs/audit/paypal-sandbox-evidence.json`](docs/audit/paypal-sandbox-evidence.json) for the
non-sensitive verification snapshot. The public repository may lag local work until changes are pushed.

---

## The problem, and what is actually new

Independent workshop organizers (pottery, cooking, crafts) do not lose classes because nobody is
interested. They lose them because interest is *conditional* and expressed in chat: "Saturday morning
is the only time I can do", "Sunday would be better, but if materials are included Saturday works too".
The organizer cannot count any of those people, so they either over-book, cancel late, or chase
everyone with another round of messages.

Public policies show the coordination burden is real — these are published merchant policies, not our
inferences:

| Source | What it documents |
|---|---|
| [POT Studio FAQ](https://www.potstudiola.com/a/faq) | Minimum enrolment; the studio contacts students to change class, reschedule, or refund when a class does not fill |
| [Rain City Clay registration policies](https://raincityclay.com/registration-policies) | Pay in full up front; cancellation and refund handled by email if the minimum is not met |
| [Sarah Pike Pottery policies](https://www.sarahpikepottery.com/workshop-cancelation-policies) | Minimum six participants, decided at least 30 days before the workshop |

What is **not** new, and what this project does not claim: charging only when the minimum is reached
([TrekkSoft](https://support.trekksoft.com/confirm-booking-before-charging-minimum-number-of-participants)
already does pre-authorization with minimums and PayPal), and collecting interest before payment
([CountToGo](https://counttogo.com/classes-workshops)). Those are table stakes.

The narrow experiment here is the step **before** checkout: understanding conditional intent, asking
less instead of more, and binding the final payment to the *exact* plan the participant accepted. The
AI's contribution is measurable and bounded; every number and every PayPal call is deterministic code.

## The five-minute loop

1. **Organizer publishes a workshop** — two hours, USD 45.00 all-inclusive, three candidate times
   (two Saturdays, one Sunday), minimum 4 / capacity 6, authorization deadline, cancellation policy.
2. **A participant writes one messy sentence** (or ticks boxes, if they prefer no AI). The model returns
   a schema-validated card — `Must have`, `Preferred`, `Needs clarification` — with the participant's own
   words quoted. **Nothing counts until the participant confirms it.**
3. **The plan is computed deterministically.** Three numbers stay separate everywhere:
   `Interested`, `Fits this plan`, `Payment authorized`.
4. **At most one question per person.** It is generated only when a confirmed merchant fact would
   close a real gap ("Materials are included. Would Saturday 10:00–12:00 work for you?"). The
   participant answers yes or no; a refusal is final, never re-asked.
5. **One immutable offer.** The merchant confirms the exact terms → a canonical JSON hash is frozen.
   Each included participant sees the full summary and ticks an unchecked consent box before PayPal.
6. **PayPal authorization, then a separate organizer action to collect.** The server re-validates
   offer hash, amount, currency, authorization age (<48h), withdrawal state and the deadline, locks a
   batch, and captures serially. The workshop is `CONFIRMED` only when every capture is `COMPLETED`;
   any failure voids uncaptured authorizations and refunds captured ones.

## Design and identity

The mark is the product in one glyph: three candidate times (three stems) converge into one frozen offer
(the ring), and the check inside it is the participant's own consent. The interface pairs self-hosted
**Inter Variable** (UI) with **Fraunces Variable** (display), uses one deep-green accent plus semantic
status colours that always carry a word, and keeps one page-load entrance, button press states and
reduced-motion support. Six full-colour Pexels-licensed photographs (credited in the footer and in `public/images/README.md`) give the
workshop a real scene — a mounted hero, an interactive plan preview (ask the one question, watch 3 → 4) and a click-to-enlarge bento gallery — without pretending they are the
client's premises or participants. [docs/design.md](docs/design.md) documents the tokens, the open-source fonts and
icons (OFL-1.1 / ISC), the accessibility audit, and the agent skills used for the redesign.

## Screenshots

Captured from the **live server + built UI** by `npm run capture-live` (a real synthetic session driven
through the product's own HTTP API — no mock state, no dev banner). The manifest records the route, width
and state behind every file, and each screen shows the same mode banner the app shows for that run.

| Screen | Desktop |
|---|---|
| Landing | [`landing-1440.png`](docs/screenshots/landing-1440.png) |
| Organizer setup (synthetic sample) | [`organizer-setup-1440.png`](docs/screenshots/organizer-setup-1440.png) |
| Workshop home — true status, three rails, candidate matrix | [`organizer-plan-1440.png`](docs/screenshots/organizer-plan-1440.png) |
| Workshop home — the one question for one person | [`organizer-plan-suggestion-1440.png`](docs/screenshots/organizer-plan-suggestion-1440.png) |
| Participant preferences — own sentence | [`participant-preferences-1440.png`](docs/screenshots/participant-preferences-1440.png) |
| Participant preferences — reviewable card | [`participant-preferences-parsed-1440.png`](docs/screenshots/participant-preferences-parsed-1440.png) |
| Participant saved state, phone | [`participant-redesign-saved-390.png`](docs/screenshots/participant-redesign-saved-390.png) |
| Editing a saved preference — live model preview, saved version still in force | [`participant-final-preview-1440.png`](docs/screenshots/participant-final-preview-1440.png) |
| Participant-flow status and live AI evidence | [`docs/participant-flow-pass.md`](docs/participant-flow-pass.md) · [`docs/ai-live-evidence.md`](docs/ai-live-evidence.md) |
| Role/number consistency pass | [`docs/p0-consistency-pass.md`](docs/p0-consistency-pass.md) |
| Organizer plan: closest time, what is missing, next step | [`plan-decisions-1440.png`](docs/screenshots/plan-decisions-1440.png) |
| Matrix after shuffled participant order | [`matrix-shuffled-1440.png`](docs/screenshots/matrix-shuffled-1440.png) |
| Participant clarification | [`participant-clarify-1440.png`](docs/screenshots/participant-clarify-1440.png) |
| Frozen offer | [`organizer-offer-1440.png`](docs/screenshots/organizer-offer-1440.png) |
| Review and authorize (consent) | [`participant-authorize-1440.png`](docs/screenshots/participant-authorize-1440.png) |
| Funding — authorized, not charged | [`organizer-funding-1440.png`](docs/screenshots/organizer-funding-1440.png) |
| Result — workshop confirmed | [`organizer-result-1440.png`](docs/screenshots/organizer-result-1440.png) |
| Mobile consent screen (420 px) | [`participant-authorize-420.png`](docs/screenshots/participant-authorize-420.png) |
| Mobile plan (420 px) | [`organizer-plan-suggestion-420.png`](docs/screenshots/organizer-plan-suggestion-420.png) |
| Landing, 简体中文 (switch in header) | [`landing-zh-1440.png`](docs/screenshots/landing-zh-1440.png) |
| Workshop home, 简体中文 | [`organizer-plan-zh-1440.png`](docs/screenshots/organizer-plan-zh-1440.png) |
| Organizer setup, 简体中文 | [`organizer-setup-zh-1440.png`](docs/screenshots/organizer-setup-zh-1440.png) |
| Landing, 日本語 (compact language menu) | [`landing-ja-1440.png`](docs/screenshots/landing-ja-1440.png) |
| Language menu (8 locales, desktop) | [`language-menu-1440.png`](docs/screenshots/language-menu-1440.png) |
| Language menu (8 locales, phone) | [`language-menu-390.png`](docs/screenshots/language-menu-390.png) |

The existing screenshots and repository walkthrough were captured with the **simulated payment
adapter**. They are historical artifacts, not proof of current Sandbox checkout or of the latest UI.
The current walkthrough file is [`docs/demo/gatherready-walkthrough.mp4`](docs/demo/gatherready-walkthrough.mp4).
Its final submission version and duration must be checked after the final build; no older duration is
claimed here. `npm run record-demo` is a recording aid, not a Sandbox acceptance test. The final video
must use truthful mode labels and the matching final code version. See [`docs/demo-script.md`](docs/demo-script.md).

Motion examples: [`docs/motion-demo.mp4`](docs/motion-demo.mp4) and
[`docs/motion-demo.gif`](docs/motion-demo.gif). `npm run test:motion` checks the motion contract,
including reduced-motion behaviour.

## Independent UI/UX audit

An evidence-based audit is checked in at [`docs/uiux-audit.md`](docs/uiux-audit.md) (2026-11-12). It was produced with
open-source tooling, not opinion:

- **axe-core** — 0 violations across 10 routes × desktop/phone (`npm run audit:axe`, `docs/audit/axe.json`)
- **Lighthouse 12.2.1** — mobile landing 32 → 61 performance, LCP 12.4 s → 3.2 s, SEO 58 → 100; reports in
  `docs/audit/lighthouse/` (before/after JSON + HTML)
- **ESLint + eslint-plugin-jsx-a11y** — static accessibility lint (`npm run audit:lint`), 0 problems after fixes
- **Vercel Web Interface Guidelines** — rule-by-rule code review, findings + status in the audit
- **improve-animations skill** — motion audit with three implemented plans and one backlog plan in `plans/`
- **design-taste-frontend skill** — design critique, alternative art directions and verdict in the audit

The audit records what was fixed in the pass (dead error links, fake ARIA menu, missing focus trap, dead hero tilt,
press-feedback cascade, dead count-up loops, SEO/robots, compression, responsive WebP, route code-splitting) and
what is still open (collect confirmation, unsaved-changes guards, mobile TBT, lightbox exit animation). It does not
claim user testing or a screen-reader pass.

## Interface language

The interface supports **8 languages**: English (default), 简体中文, 繁體中文, Español, Français, Deutsch,
日本語 and 한국어. A compact control in the identity bar (globe + current short code, e.g. `EN`, `简`, `日`)
opens a menu with each language's own name and its English name. The visible pill stays compact (34px); the
hit target is 44px, it is keyboard operable (Esc closes, focus returns to the trigger), and on phones the menu
anchors below the header instead of a giant pill row.

The choice persists in `localStorage`, updates `<html lang>`, and survives reload. English and 简体中文 are in the
initial bundle; the other six dictionaries are their own lazy chunks (~16–17 KiB gzip each) fetched on first use,
so a first visit never downloads a language the visitor does not read. A returning visitor who chose one of those
languages loads it before the first paint (no English flash).

What is translated: every piece of interface chrome — navigation, status sentences and rails, matrix labels,
buttons, form labels and client-side validation, consent steps, payment state words, empty states, errors,
footer and language note.

What stays in its creation language, on purpose: workshop facts, server-formatted slot labels, AI questions and
verbatim quotes, participant names, the official offer terms and server error text. Switching interface language does not translate legal terms or a person's own words.

Honesty note on the translations: English and Chinese are the submission languages. 繁體中文 is derived from the
简体 dictionary with OpenCC plus a small terminology pass; Español, Français, Deutsch, 日本語 and 한국어 were
authored for this demo and are **not professionally reviewed**. They are internally consistent (glossary per
language) and dictionary-parity tested, but a native review is still a to-do before public launch.

Implementation: `src/web/lib/i18n.tsx` (provider, lazy dictionary loading, `t()` with `{placeholders}`),
`src/web/lib/locales.ts` (registry + `<html lang>` tags), five dictionary namespaces under
`src/web/lib/messages-*.ts` plus one file per language, `LanguageSwitch` in the shell. The i18n tests run by `npm test` check every locale has the same keys, identical placeholders, and no empty strings;
`npm run ui-review` reviews English, Chinese and Japanese layouts at four widths; `npm run typecheck:web`
typechecks the web app (the root tsconfig excludes `src/web`).


## Interface appearance

A small palette button next to the language control opens **Appearance**. It changes only two safe things:

- **Accent** — five presets (Forest, Ocean, Clay, Plum, Graphite) or any custom colour. The darker hover shade,
  tint background and readable text-on-accent colour are derived in code, so a light custom accent switches the
  button label to dark text instead of leaving white-on-yellow.
- **Background** — four light surface moods (Paper, Cool, Warm, White). Custom backgrounds are intentionally not
  offered, because arbitrary dark backgrounds would need a full dark palette; the preset set keeps every existing
  contrast guarantee.

Semantic status colours, the PayPal button, photography and typography do **not** change. The choice is stored in
`localStorage` (`gr_theme`) and applied in `main.tsx` before the first render, so reloads do not flash the default
theme. Implementation: `src/web/lib/theme.ts`, `src/web/components/ThemeSwitch.tsx`; screenshots:
[`appearance-menu-1440.png`](docs/screenshots/appearance-menu-1440.png), [`appearance-custom-1440.png`](docs/screenshots/appearance-custom-1440.png).

## Run it from a fresh clone

### 1. Install and start the baseline

Requirements: [Git](https://git-scm.com/downloads), [Node.js](https://nodejs.org/en/download) **22.5 or
newer** (the app uses built-in `node:sqlite`), npm, and a modern browser. A local run does not require
a hosting subscription. Dependency/model downloads require internet access and sufficient disk space.

```bash
git clone https://github.com/MinusPlus2025/gatherready.git
cd gatherready
node --version
npm ci
npm run typecheck
npm run typecheck:web
npm test
npm run build
npm run preflight
npm start
```

Open **http://localhost:5180**. With no credentials/model configuration, this is a labelled
**simulated-payment, structured/recorded-demo baseline**, not a live AI + PayPal demonstration.
Click **Load sample (synthetic demo data)** to create an isolated synthetic session. Do not reset an
existing session containing work you want to retain. Stop the server with Ctrl+C before restarting
it with changed configuration. `npm start` serves the built UI; rebuild after UI changes.

### 2. Enable local live AI without a cloud API key

Install Ollama from its [official download page](https://ollama.com/download) for your OS and launch
it. On installations where the background server is not already running, run `ollama serve` in a
separate terminal. Then, from the project directory:

```bash
ollama pull qwen2.5:7b-instruct
LLM_OLLAMA=1 LLM_MODEL=qwen2.5:7b-instruct LLM_TIMEOUT_MS=60000 npm start
```

The model is a multi-gigabyte download; inference speed depends on your machine. Keep Ollama running.
A prior `secrets/access.json` model configuration takes precedence over some environment variables:
if you have configured another provider, use the interactive setup to select `ollama` and the intended
model rather than assuming the command overrides that file. Never paste keys into chat or a public issue.

`GET /healthz` reports **configuration**, not proof that a particular model call succeeded. Submit a
new sentence, inspect the per-extraction status, review the extracted facts, and explicitly confirm.
A failed call must show failure and allow retry/manual selection; checked-in recorded samples are not
live inference. A cloud provider is optional and may incur charges; it is not required for this local path.

### 3. Configure your own PayPal Sandbox app securely

Use the **Sandbox** section of the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/).
Use a Sandbox business app for server credentials and a separate **Personal Sandbox test buyer** for
checkout. Never use real card data or a production PayPal secret. In a local interactive terminal:

```bash
node scripts/setup-access.mjs --paypal-only
node scripts/setup-access.mjs --check
```

The setup writes `secrets/access.json` with mode `0600`, verifies it is Git-ignored, and hides Secret
input. `--paypal-only` preserves model configuration. Webhook ID and the reference merchant email can
initially be skipped. Keep the PayPal API host at
`https://api-m.sandbox.paypal.com`; this app rejects non-Sandbox hosts.

**Keep simulated and Sandbox data separate.** Stop your own GatherReady server before switching
payment mode. Do not restart a Sandbox adapter against a database containing simulated payment
records: the recovery scheduler starts automatically. Preserve that database and use a separate new
file for Sandbox UI tests (do not delete existing data):

```bash
GATHERREADY_DB=./data/gatherready-sandbox.db npm start
```

For the previous simulated workspace, explicitly use `PAYPAL_FORCE_SIMULATED=1 npm start` even
when Sandbox credentials are now saved. The standalone preflight/spine scripts verify the API
separately and do not turn the existing UI recording into a real-payment recording.

Do not commit `.env`, `secrets/`, database files, tokens or buyer passwords. For an independent clone,
reviewers configure their own Sandbox app/test buyer; this repository contains no shared credentials.

### 4. Verify the right thing

```bash
# Local synthetic HTTP tests: always force simulated payments, even when keys exist.
npm run verify

# Real Sandbox API readiness: OAuth + order creation/query.
npm run paypal-preflight

# Optional interactive payment acceptance test; review the scope below before running.
npm run sandbox-spine
```

`verify` is **not real PayPal transaction evidence**. `paypal-preflight` creates a USD 45.00 test order,
without buyer approval or capture. When `PUBLIC_BASE_URL` is HTTPS it may register the app webhook;
otherwise registration is skipped. Registration alone does not prove webhook delivery.

`sandbox-spine` creates two USD 45.00 virtual test orders: authorization → capture → refund, then
separate authorization → void. It needs an interactive terminal and the operator's approval with an
existing Personal Sandbox buyer on PayPal's hosted page. No real funds are used. This extended test is
for this product's payment implementation, **not a universal competition requirement**. Do not rerun
blindly after a timeout: inspect the prior order/resource status first. Do not claim an authorization,
capture or refund until the provider confirms its status and amount.

Public HTTPS is needed to test externally delivered webhooks and public callbacks; it is not a
prerequisite for standalone OAuth or order API checks. Webhook testing remains separate from the
browser return and from the local synthetic tests.

### Development and hosting limits

For two-process development, use `npm run dev` (API, port 5180) and `npm run dev:web` (Vite, port 5181)
in separate terminals. For reproducible evaluation, prefer the single built server above. If port 5180
is occupied, stop your own prior GatherReady process rather than killing unrelated projects.

SQLite persists under `data/` by default. This is a single-process application with a 30-second
in-process recovery scheduler and, in the local AI setup, a local Ollama endpoint. It is **not ready
for a direct serverless/Vercel deployment without adapting storage, scheduling and the model endpoint**.
There is no verified public deployment in this snapshot. Complete local setup is provided instead.

## Modes — implementation versus evidence

| Part | Without configuration | Configured implementation / limits |
|---|---|---|
| PayPal | Simulated adapter, labelled **Demo payment — no PayPal transaction** | Sandbox REST adapter; current verified scope is OAuth + order create/query only |
| AI | Structured input and explicitly labelled recorded synthetic samples | Ollama or supported cloud provider; every result needs validation; failed inference is not a recorded success |
| Database | Local SQLite file | Not a hosted database; do not assume local disk persists on serverless hosts |
| Payments | No PayPal transaction | Sandbox virtual funds only; credentials or a mode badge do not prove transaction success |

The local AI evaluation in [`docs/ai-evaluation.md`](docs/ai-evaluation.md) is a historical measured run,
not a promise that every new input succeeds. Payment architecture, automated tests and recorded UI
flows are not substitutes for provider-confirmed payment evidence. Keep these categories separate
when reviewing the screenshots, video and test reports.

## Demo walkthrough (synthetic data)

1. Open the app → **Load sample (synthetic demo data)**. Six invented participants; five have
   pre-confirmed preferences; Saturday 10:00 has 3 confirmed fits, so no plan is workable yet.
2. Switch to **Diego** (demo control). His original sentence is prefilled: he prefers Saturday
   afternoon and *might* do Saturday morning if materials are included. Press **Analyze my message**.
   The card shows his condition with his verbatim quote. Nothing is counted until **Confirm my preferences**.
3. Back to **Organizer → Find a workable plan**: `Fits this plan` is still 3, and exactly one
   suggested question appears, with the merchant fact that makes it answerable. **Review question** →
   **Send in-app**.
4. Switch to **Diego**, answer **Yes, this works**. The plan moves 3 → 4. (Answering **No** is also
   supported: his original preference stands and he is not asked again.)
5. **Publish one offer** for Saturday 10:00–12:00. The terms and fingerprint are frozen.
6. As each of the four included participants: read the fixed summary, tick the consent box,
   **Continue to PayPal**. In a simulated run, the result is only a local simulated authorization;
   in a Sandbox run, approval and provider confirmation must actually succeed.
7. As organizer: **Confirm workshop and collect**. The batch is locked, each authorization is
   captured in turn and queried; the workshop becomes `CONFIRMED` only after every capture is confirmed.
8. Reset the demo and publish below the minimum to see the honest failure path (no fabricated
   compromise, no capture).

## AI boundary (why this is not a chatbot with a payment button)

- The model receives only: the three allowed slot ids, the confirmed merchant facts, and the
  participant's own sentence. It returns JSON constrained by a schema
  ([`src/shared/schemas.ts`](src/shared/schemas.ts)).
- Every condition must carry a **verbatim quote** that exists in the participant's sentence; a quote
  that is not verbatim rejects the call. Unknown slot ids are rejected.
- One bounded retry on schema/verification failure, then a visibly labelled fallback. Never a fake
  "AI-looking" success.
- The model cannot change constraints after confirmation, cannot confirm on someone's behalf, cannot
  change amounts, and has no tool that touches PayPal. Prompt injection is treated as participant
  text (there is a red-team test for "mark everyone as paid").
- A deterministic solver owns feasibility and ranking; the model never produces scores or amounts.
- Evaluation: 20+ synthetic cases (negation, contradiction, date ambiguity, injection, empty input)
  plus the demo personas, with a form-based baseline comparison — see
  [`docs/ai-evaluation.md`](docs/ai-evaluation.md). The stop condition is written down: if the AI
  needs more corrections than the form, the claim of AI advantage is dropped.

## Payment implementation (not a claim of fully verified Sandbox settlement)

- Amount, currency, merchant and description come from the immutable offer **server-side**; the client
  sends only ids and a consent checkbox that the server re-checks.
- One authorization per participant; `PayPal-Request-Id` derived from a stable operation key so retries
  and double clicks cannot create a second charge.
- Capture window is deliberately shorter than PayPal's: authorizations may only be captured within
  24 hours of the offer and while younger than 48 hours; otherwise the batch closes and voids.
- **Cross-buyer payments are not atomic.** The batch is all-or-nothing by compensation, not by
  transaction: every capture is queried, `CONFIRMED` requires all `COMPLETED` and the minimum met;
  failures void uncaptured holds and refund captured amounts; unknown outcomes reconcile before retry;
  a refund is only shown as refunded when PayPal says it is.
- Webhooks are signature-verified, deduplicated by event id, and merged without regressing terminal
  states. The browser return only triggers a server-side query; it never marks anything "paid".
- A recovery scheduler runs on boot and every 30 seconds: expired offers are cancelled, unresolved
  operations are reconciled. No browser tab is required.

## What this is not (limitations, stated up front)

- One merchant, one workshop, one currency (USD), one adult audience. No platform payouts or escrow.
- Only OAuth and order creation/query have been verified against Sandbox in this snapshot;
  buyer approval, authorization, capture, void, refund and external callbacks remain unverified.
- Cross-buyer capture is not atomic, and refunds/holds are not instant; no fee claims are made.
- Demand, willingness to pay, and improvement over a form-based workflow are **not validated** here.
  No interviews or conversion experiments are claimed. Public policy sources are cited; commercial
  outcomes are hypotheses.
- No external messaging import, no calendar sync, no accounts beyond the isolated demo session.
- The project name, domain, licence choice and any deployment/submission action are for the project
  owner to confirm; this build does not deploy, publish or submit anything.

## Project layout

```text
src/
  app UI is served from src/web (React 19 + Vite); Fastify serves the built bundle
  shared/     types, zod schemas, HTTP contract, time-zone helpers, synthetic sample
  server/
    domain/   pure functions: validation, deterministic solver, offer hashing, state machines
    ai/       provider, extraction, clarification proposal, recorded fallbacks
    payments/ PayPal REST adapter, simulated adapter, checkout, settlement, webhook, recovery
    jobs/     deadline and recovery scheduler
    repo.ts   the only SQLite writer
    service.ts orchestration (the only place state changes are sequenced)
scripts/      setup-access, preflight, seed, verify (end-to-end HTTP), ai-eval, capture-shots
tests/        unit, domain, AI, payment-safety, integration
docs/         CONTRACT, architecture, testing, ai-evaluation, submission, demo script
```

## Documentation

- [`docs/CONTRACT.md`](docs/CONTRACT.md) — frozen interfaces and safety invariants
- [`docs/architecture.md`](docs/architecture.md) — boundaries, state machines, compensation
- [`docs/testing.md`](docs/testing.md) — what was run, what passed, what is simulated vs sandbox (T01–T20 matrix)
- [`docs/ai-evaluation.md`](docs/ai-evaluation.md) — cases, results and the baseline comparison
- [`docs/submission.md`](docs/submission.md) — Devpost copy and the honest feature list
- [`docs/demo-script.md`](docs/demo-script.md) — the under-three-minute demo plan, with the recorded walkthrough
- [`docs/design.md`](docs/design.md) — identity, palette, type, motion, accessibility, the open-source design toolkit and the UI review harness
- [`docs/ui-review.md`](docs/ui-review.md) — measured UI/UX + motion review of the built app (regenerated by `npm run ui-review`)
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — judge-accessible hosting, sandbox test account, post-deploy checklist
- [`docs/deploy-status.md`](docs/deploy-status.md) — current deployment blockers, account audit, PayPal diagnosis, costs and local evidence
- [`docs/ia-redesign.md`](docs/ia-redesign.md) — information architecture and interaction: role homes, status sentences, candidate matrix, four money states, motion rules (layouts first, then implementation)
- [`docs/P0-ACCEPTANCE.md`](docs/P0-ACCEPTANCE.md) — the brief's P0 list, audited item by item with evidence and owner blocks

## License

MIT — see [LICENSE](LICENSE). Third-party images, fonts and dependencies retain their own licences
and attribution requirements; see the asset and design documentation.
