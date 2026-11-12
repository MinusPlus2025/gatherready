# GatherReady

<p align="left"><img src="public/logo-mark.svg" width="56" height="56" alt="GatherReady logo" /></p>

**Turn conditional workshop interest into one plan people actually agree to fund.**

A small web product for the [PayPal AI Hackathon 2026](https://paypalaihackathon.devpost.com/):
an AI reads messy availability messages into reviewable constraints, a deterministic solver finds the
one time a group can actually agree on, a participant answers at most one clarifying question, and
PayPal authorizations are collected only against the exact plan each person accepted. Money is
captured only when the minimum group is real — otherwise holds are released and completed charges
refunded.

**Sandbox only · no real money · MIT**

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

In this snapshot the banner reads **Simulated PayPal — no real money** because sandbox keys are absent;
the same screens render the sandbox badge without code changes once keys are supplied.

There is also an **~80-second silent walkthrough** recorded from the live product by
`npm run record-demo`: [`docs/demo/gatherready-walkthrough.mp4`](docs/demo/gatherready-walkthrough.mp4)
(a real server, real state changes, simulated PayPal badge in every frame). The interaction motion is
recorded separately by `npm run record:motion` → [`docs/motion-demo.mp4`](docs/motion-demo.mp4) /
[`docs/motion-demo.gif`](docs/motion-demo.gif), and `npm run test:motion` asserts the motion contract
(including that reduced motion removes movement). It is a recording aid — the
submission video needs your own narration and, if available, sandbox credentials so the sandbox badge is
visible; see [`docs/demo-script.md`](docs/demo-script.md).

## Interface language

The whole interface switches between **English** and **简体中文** from the `English | 中文` control in the header
on every screen. English is the default (it is the submission language); the choice persists in
`localStorage`, updates `<html lang>`, and is visible to screen readers through `aria-pressed`.

What is translated: every piece of interface chrome — navigation, status sentences and rails, matrix
labels, buttons, form labels and client-side validation, consent steps, payment state words, empty states,
errors, footer and language note.

What stays in its creation language, on purpose: workshop facts, server-formatted slot labels, AI questions
and verbatim quotes, participant names, the official offer terms and server error text. The footer says this
in both languages, so switching language never pretends to translate a legal term or a person's own words.
Chinese copy is authored for this demo, not professionally localised.

Implementation: `src/web/lib/i18n.tsx` (provider + `t()` with `{placeholders}`), five dictionary pairs under
`src/web/lib/messages-*.ts` (shell/landing, flow, money, onboard), one `LanguageSwitch` in the shell.
`npm run ui-review` now reviews English **and** Chinese layouts at four widths; `npm run typecheck:web`
typechecks the web app (the root tsconfig excludes `src/web`).

## Run it

Requires Node.js ≥ 22.5 (uses the built-in `node:sqlite`).

```bash
cd gatherready
npm install                 # dependencies are already present in this checkout
npm run preflight           # what is real / what is degraded, no secrets printed
node scripts/setup-access.mjs   # optional: PayPal sandbox keys + model key (written to git-ignored secrets/)
# or, if you are in a GUI session: copy one value at a time, then run one line — nothing is echoed
node scripts/setup-access-clipboard.mjs client-id
node scripts/setup-access-clipboard.mjs client-secret

npm run dev                 # API on http://localhost:5180
npm run dev:web             # UI on http://localhost:5181 (proxies /api to 5180)

# optional: live AI without a cloud key (what this checkout's screenshots/video used)
ollama pull qwen2.5:7b-instruct
LLM_OLLAMA=1 LLM_MODEL=qwen2.5:7b-instruct npm start

# or one process:
npm run build && npm start  # http://localhost:5180
```

Then open the UI, click **Load sample (synthetic demo data)**, and follow *Demo walkthrough* below.
Every visitor gets a freshly isolated synthetic tenant and role switching is limited to that tenant.

## Modes — what is real right now

The app never hides this: the top banner and every payment row state the mode. The same server code
path is used for both adapters.

| Part | With no credentials (default here) | With credentials |
|---|---|---|
| PayPal | `simulated` adapter: deterministic `SIM-` ids, PayPal-shaped states, labelled **Simulated PayPal — no real money** | Real Sandbox REST: Orders v2 `intent=AUTHORIZE`, Payments v2 authorize/void/capture/refund, webhook signature verification |
| Language model | No live model: structured form + checked-in **Recorded sample** only for the six synthetic persona sentences; labelled per preference | OpenAI-compatible, Gemini or **local Ollama**; JSON-constrained decoding, schema + verbatim-quote verification, one bounded retry, then structured fallback |
| Database | SQLite file (`data/gatherready.db`), WAL, `BEGIN IMMEDIATE` for money paths | same |
| Money | **Nothing leaves the machine** | Sandbox money only; the process refuses to boot against a non-sandbox PayPal host |

**Honest status:** two halves are in different states, and the UI says which on every screen.

- **AI is real on this machine.** A local **`qwen2.5:7b-instruct`** model (via Ollama) performs the
  extraction and the clarification wording; every answer still passes the schema + verbatim-quote
  verifier. The AI evidence in [`docs/ai-evaluation.md`](docs/ai-evaluation.md) is a live-model run
  (28/33 answered live, **0 unsafe acceptances, 0 quote failures**, review cost −43% in the heuristic),
  and the screenshots/video show the `Live AI` banner. A hosted key (OpenAI-compatible or Gemini) is a
  drop-in replacement for a deployment where Ollama is not available. A smaller 3B model was measured and
  rejected: it made the review *more* expensive than the form, and that result is in the report too.
- **PayPal is still simulated here.** No PayPal sandbox credentials exist on this machine, so no real
  sandbox transaction has been executed. The simulated adapter is labelled in the UI, API and docs, and
  [`docs/testing.md`](docs/testing.md) keeps simulated-mode results and real-sandbox evidence in separate
  columns. With sandbox keys in place, `npm run paypal-preflight` proves OAuth/order-create/query and
  registers the webhook, and `npm run sandbox-spine` walks the real authorization → capture → query →
  refund → query and authorization → void → query paths with you approving each order in PayPal's hosted
  UI. It prints the real resource ids for the evidence table.

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
   **Continue to PayPal** (simulated here), return — the server records the authorization.
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

## Money path (what actually protects the money)

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
- **No real PayPal sandbox transactions were verified in this snapshot** (see mode table).
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
- [`docs/ia-redesign.md`](docs/ia-redesign.md) — information architecture and interaction: role homes, status sentences, candidate matrix, four money states, motion rules (layouts first, then implementation)
- [`docs/P0-ACCEPTANCE.md`](docs/P0-ACCEPTANCE.md) — the brief's P0 list, audited item by item with evidence and owner blocks

## License

MIT — see [LICENSE](LICENSE). Dependency licences are compatible; the project owner should confirm the
licence choice before publishing.
