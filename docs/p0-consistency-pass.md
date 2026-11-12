# P0/P1 role, number and permission consistency pass

Date: 2026-11-13 (Asia/Shanghai)
Scope: role-aware entry, one server snapshot per screen, matrix identity alignment,
and the requested first-screen copy. The participant redesign and product direction
from the previous pass stay intact.

Status: **done** = observed in this build; **unverified** = code exists but required
evidence was not produced; **blocked** = missing credential/publication channel.

## P0.1 — participant session used to open the organizer plan

### Reproduction (before)

A synthetic participant session (Finn) on `/` clicked the preview's
**Open the real plan** link. It was hardcoded to `/organizer/plan` and produced:

- header: `You are Finn — participant`
- page: `ORGANIZER` / `Workshop home`, organizer actions, organizer matrix
- plan fit names were trimmed to `Another participant`, but the API also returned
  `plan.counts.fitsThisPlan: 0` while the best slot had **3 fits** and the match
  rail showed **3 / 4**
- the participant could see the organizer route at all

Screenshot: [`docs/screenshots/repro-participant-organizer-conflict-1440.png`](screenshots/repro-participant-organizer-conflict-1440.png)

### Fix and result (after)

- `PlanPreview` picks its destination from `state.session.role`:
  participant → `/participant/preferences`, organizer → `/organizer/plan`; the
  participant-facing label is **Open a participant view**.
- `/organizer/plan` redirects participants to `/participant/preferences` (defence
  in depth for old links and direct URLs).
- Footer navigation is role-specific: participants get Preferences + Review and
  authorize; organizers get Setup + Plan + Funding.
- `plan.counts.fitsThisPlan` now uses the same definition as the best-match rail
  (maximum confirmed fits across candidate times), not only a workable slot.
- API reads use `cache: 'no-store'`; the whole screen is built from one
  `/api/state` result. There is no client-side patching of counts from another
  endpoint.
- `demo.view` / `demo.reset` clear the snapshot and invalidate in-flight reads
  before the request. With the demo endpoint delayed 1.2s, the page shows
  **Loading the workshop…** and never the previous identity.

Observed after: participant link → `/participant/preferences`; direct
`/organizer/plan` → `/participant/preferences`; footer contains only participant
links; organizer plan counts are `3` in the API, decision strip, rail and matrix.

## P0.2 — matrix attached by array position

Root cause: desktop column headers were built from `participants` sorted by
display name, while `<td>` cells were rendered from `row.cells` in server array
order. A shuffled API order moved a cell under another person's header.

Fix: `alignedMatrixCells(row, participants)` (in `src/web/lib/status.ts`) maps
cells by `participantId` and fills a missing cell with that participant's
`unknown` state. The desktop table and phone avatar cards both use it. Each
avatar already carries `title` and visually-hidden text with the same person's
name, so tooltip and screen-reader label stay attached to the correct column.

Evidence:

- Unit test `tests/web/matrix.test.ts` (2 tests): shuffled column order, and a
  missing cell must not shift; both assert `participantId`, name and state.
- Browser test with `/api/state` intercepted and participants/preferences
  reverse-ordered: input order `Finn, Alice, Elise, Cara, Diego, Ben`; headers
  `Alice, Ben, Cara, Diego, Elise, Finn`; **0 mismatches** between header and
  avatar title/hidden name. Raw: [`audit/matrix-shuffle.json`](audit/matrix-shuffle.json),
  screenshot [`screenshots/matrix-shuffled-1440.png`](screenshots/matrix-shuffled-1440.png).

## P0.3 — entries and real access control

- Home has two explicit demo entries: **Experience as organizer** and
  **Experience as participant**. Both switch the synthetic session view and then
  navigate; the participant entry lands directly on the participant screen.
- Demo controls stay collapsed; role switching is still only available for
  synthetic tenants (`/api/demo/view` returns `DEMO_ONLY` otherwise).
- Real access remains server-side. In a participant session,
  `POST /api/workshop` and `POST /api/offers/publish` returned **403
  `ORGANIZER_ONLY`**. The organizer plan route now also redirects in the UI.
- Switch test with delayed endpoint showed a loading state, not the old identity;
  refresh reads the same session identity.

Raw: [`audit/permission-check.json`](audit/permission-check.json),
[`audit/role-entry.json`](audit/role-entry.json),
[`audit/stale-switch.json`](audit/stale-switch.json).

## P0.4 — health vs payment claims

`GET /healthz` on this build: `{"ok":true,"paypal":"simulated","ai":"live"}`.

- UI chip, payment control and authorize copy say **Demo payment — no PayPal
  transaction**; no “PayPal sandbox” claim appears while the adapter is simulated.
- Real AI: local Ollama `qwen2.5:7b-instruct`, `extractionMode: live`, latest
  preview 4.5s, saved v1 stayed `CONFIRMED`, revise 200, plan Saturday fits
  3→4. See [`ai-live-evidence.md`](ai-live-evidence.md).
- Real PayPal Sandbox: **blocked**. `secrets/access.json` PayPal fields are empty;
  `npm run paypal-preflight` and `npm run sandbox-spine` print `BLOCKED`. No real
  authorization, capture or void exists. Simulated adapter passes are not
  presented as sandbox evidence.

## P1 — expression and first screens

- Hero first sentence is the organizer benefit: find the one time everyone can
  commit to, pay only when the workshop is on. AI/PayPal details moved down; the
  model name now appears only in the footer, not in top technical bars.
- Two first-screen entries are explicit (organizer / participant).
- Organizer plan first screen has three decisions: **Closest time**, **What is
  missing**, **Next step**, with numbers taken from the same `state.plan` and
  matrix. If no action can close the gap, the next step says to wait instead of
  offering a meaningless recompute button.
- The interactive landing preview is labelled **Illustrative example** and
  **Example numbers, not live data**; it is separated from the real snapshot.
- A real “Live server snapshot” section shows scattered conditions → confirmed
  preferences → executable plan using the current workshop state.
- Hash/version/audit details remain collapsed under Technical details.

Screenshots: [`screenshots/plan-decisions-1440.png`](screenshots/plan-decisions-1440.png),
[`screenshots/plan-decisions-390.png`](screenshots/plan-decisions-390.png),
[`screenshots/landing-new-hero-1440.png`](screenshots/landing-new-hero-1440.png),
[`screenshots/landing-transform-1440.png`](screenshots/landing-transform-1440.png).

## Acceptance checks

| Check | Result |
|---|---|
| Existing participant session clicks home plan link | **done** — now lands on participant view; direct organizer plan redirects |
| Role/counts/recommendation/publish condition consistency | **done** — one snapshot; `fitsThisPlan` = best fits; decision strip/rail/matrix agree |
| Shuffled participant input order | **done** — unit test + browser interception, 0 mismatches |
| Switch/refresh no old identity | **done** — delayed switch test shows loading only |
| Desktop and 390 layout | **done via headless Chrome** — screenshots above; no real-device test |
| Real AI | **done** — live model evidence above |
| Real PayPal Sandbox | **blocked** — no credentials, no real order/capture/void |
| Source/video/final submission consistency | **partly done/blocked** — see below |

### Source, video and submission

- `LICENSE` is MIT and the README is English.
- The checkout has **no git remote**; source is not published from here.
- The local walkthrough was re-recorded from the current build after this pass; it
  is **local only**, not uploaded to YouTube.
- The Devpost submission/reviewer link and final public URL were not verified.
- These are owner actions; this report does not treat a local pass as a submitted
  entry.

## Verification commands

```text
npx tsc -p tsconfig.json --noEmit          clean
npx tsc -p tsconfig.web.json --noEmit      clean
vitest run                                 257 passed / 18 files
npm run ui-smoke                           passed end to end
npm run audit:axe                          0 violations / 20 route×viewport runs
npm run ui-review                          0 findings (1440/834/390/320)
eslint (web + jsx-a11y)                    0 problems
```
