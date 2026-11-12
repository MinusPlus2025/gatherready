# IA and interaction redesign — layouts first

Brief: a first-time visitor must answer three questions in five seconds — **what event is this, is it
happening, what do I do next?** Colour, illustrations and card count are not the answer. This document
fixes the information architecture and interaction before any code changes.

Two roles, two home screens. The demo can switch; the identity is always stated.

- **Organizer home** (`/organizer/plan`) — the whole group: status, who fits which time, one next action.
- **Participant home** (`/participant/preferences`) — their own status only: what they said, whether the
  terms are published, whether they authorized, whether money moved.
- **Consent screen** (`/participant/authorize`) — the exact terms and the four separate money states.

Being available at a time is **not** agreeing to pay. The matrix shows availability; authorization is a
separate, explicit act with its own state. No voting auto-signup.

## 1. Organizer home — desktop (1440)

```text
┌ identity bar ────────────────────────────────────────────────────────────────────────────┐
│ [mark] GatherReady   [Sandbox · No real money] [Simulated PayPal]  You are the organizer  │
├ workshop strip ──────────────────────────────────────────────────────────────────────────┤
│ Two-hour pottery wheel workshop · Clay & Co Studio (fictional)                           │
│ Sat 28 Nov 10:00 · Sat 28 Nov 13:00 · Sun 29 Nov 10:00 · $45.00 · min 4 · closes in 19h  │
├ status band — ONE sentence, true only from current data ─────────────────────────────────┤
│ ● 还差 1 人确认才能达到 4 人成班条件                                  [Ask the one question] │
│   Diego's condition: materials included · answer Yes closes 3 → 4                        │
├ three separate rails (never one combined number) ───────────────────────────────────────┤
│ 条件匹配 3 / 4 confirmed   │ 确认条款 尚未选定   │ 有效授权 0 / 4 · captured 0            │
├ candidate comparison: date × participant matrix ────────────────────────────────────────┤
│                 Alice   Ben   Cara   Diego   Elise   Finn        confirmed  ceiling      │
│ ▸ Sat 10:00–12:00  ✓      ✓     ✓      ◐                               3       4        │
│ ▸ Sat 13:00–15:00        ✓?    ✓       ✓                               2       3        │
│ ▸ Sun 10:00–12:00                                   ✓                 1       1        │
│   ✓ confirmed   ◐ conditional (not counted)   ✓? accepted + preferred   · not yet      │
│ tap a row → expands in place:                                                            │
│   ┌ who · state · their sentence (organizer sees constraints only) · AI card · edit ─┐  │
│   │ Diego  ◐ Conditional     “If all the materials are included…”                     │  │
│   │ AI understood: accepted Sat afternoon; Sat morning only if materials included.    │  │
│   │ [Ask the one question]  [Open participant view]                                   │  │
│   └────────────────────────────────────────────────────────────────────────────────────┘│
├ next action + disclosure ───────────────────────────────────────────────────────────────┤
│ [Publish the offer for Sat 10:00]            Technical details ▸ (hash, audit, provider)  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Rules for this screen:

1. **Status band is generated from state**, not authored copy: no preferences → “还没有人表达意向”;
   confirmed < minimum → “还差 N 人确认…”; minimum met → “已达到成班条件，可以发布方案”; offer open →
   “方案已发布，还差 N 人授权”; all authorized → “可以收款”; captured → “已成班，已收款”; failed →
   “未成班：…”, with the actual reason.
2. `确认条款` shows **尚未选定** until an offer exists; then the slot and fingerprint short hash.
3. Matrix cells are four states: confirmed (✓), conditional (◐, never counted), not yet (empty),
   cannot (✕ if they confirmed a different time explicitly). Numbers under the matrix are
   `confirmed` and `ceiling` per row.
4. Expanding a row is the only place with the participant's condition text, AI understanding and the edit
   entry. No modal, no new page for a detail this small.
5. Technical details (plan input hash, audit events, provider status) live in a `<details>` at the bottom.
6. Primary button is the single next action for the organizer's current state.

## 2. Organizer home — phone (390)

```text
┌ identity ────────────────────────────────┐
│ [mark] GatherReady                        │
│ [Sandbox · No real money] [Simulated]     │
│ You are the organizer                     │
├ workshop strip (2 lines, wraps) ─────────┤
│ Two-hour pottery wheel workshop           │
│ Sat 28 Nov 10:00 · 13:00 · Sun 10:00      │
│ $45.00 · min 4 · closes in 19h            │
├ status band ──────────────────────────────┤
│ ● 还差 1 人确认才能达到 4 人成班条件       │
│ [Ask the one question → full width]       │
├ rails (three stacked rows) ──────────────┤
│ 条件匹配  3 / 4 confirmed                  │
│ 确认条款  尚未选定                         │
│ 有效授权  0 / 4 · captured 0               │
├ candidate cards (one per time, not a table)│
│ ┌───────────────────────────────────────┐ │
│ │ Sat 28 Nov · 10:00–12:00   3 confirmed │ │
│ │ ◉ Alice  ◉ Ben  ◉ Cara  ◐ Diego        │ │
│ │ ceiling 4 · [expand ▸]                 │ │
│ ├───────────────────────────────────────┤ │
│ │ Sat 28 Nov · 13:00–15:00   2 confirmed │ │
│ │ ◉ Cara  ◉ Elise                        │ │
│ └───────────────────────────────────────┘ │
│ tap a card → expands inline (accordion)    │
├ sticky action bar ────────────────────────┤
│ [Publish the offer]   (only when valid)    │
└───────────────────────────────────────────┘
```

No horizontal table on phones; the matrix becomes one card per candidate, avatars inside, expand in place.

## 3. Participant home — desktop and phone

```text
┌ identity: You are Diego (participant) ───────────────────────────────────┐
│ Two-hour pottery wheel workshop · $45.00 · min 4 · closes in 19h         │
├ your status — one sentence, true only ───────────────────────────────────┤
│ ● 你的偏好已确认（周六下午）。组织者还没有发布方案。                     │
├ four steps, separate on purpose ─────────────────────────────────────────┤
│ ① 表达意向 ✓ 已确认  ② 确认条款 — 未发布  ③ 授权（不扣款）— 未开始        │
│ ④ 扣款 / 取消 — 未开始                                                   │
├ your preference (summary first, edit on demand) ─────────────────────────┤
│ Must have: Sat 28 Nov 13:00–15:00                                        │
│ Condition: all materials are included · “If all the materials…”          │
│ [Edit my preference]                                                     │
├ one question from the organizer (only when one exists) ─────────────────┤
│ “All materials are included. Would Sat 10:00–12:00 work for you?”        │
│ [Yes, this works]  [No, keep my preference]                              │
├ offer published (when it exists) ───────────────────────────────────────┤
│ Terms summary + [Review and authorize] (amount, min, deadline, failure)  │
├ Technical details ▸                                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

Phone: same order, steps become a 2×2 grid, action buttons full width, sticky nothing except the current
single action. The participant never sees another participant's sentence, state or money.

## 4. Consent screen — the four money states, always separate

```text
┌ fixed terms (merchant, time, timezone, venue, includes, total, min, deadline, cancellation, failure) ┐
├ where you are in the money flow ────────────────────────────────────────────────────────────────────┤
│ 意向 ✓ 已确认   ·   条款 ☐ 待确认   ·   授权 ☐ 未授权（不扣款）   ·   扣款 ☐ 未开始                  │
├ consent copy, unchecked box, PayPal/simulated control ──────────────────────────────────────────────┤
│ Under the button: $45.00 · min 4 · closes in 19h · if not formed: hold released, charges refunded   │
├ Technical details ▸ (fingerprint, provider status)                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

In-progress and failure are their own rendered states: `Checking with PayPal`, `Authorizing`,
`Authorized — not charged`, `Charged`, `Hold released`, `Refunding`, `Refunded`, `Needs attention`.
A refund request is never rendered as a refund; a returned browser tab is never rendered as money.

## 5. Motion serves comprehension (no decoration)

| Moment | Motion |
|---|---|
| A participant confirms | their avatar cell transitions empty → ✓, the row's confirmed count ticks to its new value (one 200–300ms height/colour transition) |
| Organizer selects a candidate time | affected participants' cells get a single highlight ring; the rest dim slightly for 400ms |
| Payment in progress | the specific person's row cycles `Authorizing → Authorized`; the button shows the actual server state, no fake percentage |
| Payment failure | the row turns to the failure state with a noun + reason; no shake, no confetti |
| Reduced motion | all of the above become instant state changes; nothing hidden, nothing loops |

## 6. What gets collapsed, moved, or removed

- Plan hash, audit trail, provider status → `<details>` “Technical details” on the screens that own them.
- The old “Why this plan” prose block → one line inside the status band's detail, plus the disclosure.
- Duplicated candidate cards under a matrix → the matrix **is** the candidate list; expanded row is the
  detail.
- Sandbox/simulated status → one chip in the identity bar and one banner line, never repeated per card.
- No new pages; the organizer dashboard and participant home become the front doors.

## 7. Acceptance for this pass (not a user test)

A person who has not seen the product before should be able to answer, without help:

1. What is the activity, when and where does it happen, what does it cost? (workshop strip)
2. Can it happen right now, and if not, what is missing? (status band + three rails)
3. What is the next action, and who does it? (single primary button per role)
4. Is my payment a hold or a charge, and what happens if the group fails? (four-step money line + notes)

We will also re-run: preference states, terms confirmation, authorization, capture, and the failure/
compensation state, with `npm run ui-smoke`, `npm run verify`, `npm run ui-review`, plus rewritten manual
checks in `docs/testing.md`. This document describes intended behaviour; it is **not** evidence of user
testing.


## 8. Implemented (this pass) and how it was checked

Implemented in `src/web`:

| Piece | Where |
|---|---|
| Computed status sentence + single action per role | `src/web/lib/status.ts` (`organizerStatus`, `participantStatus`) |
| Three separate rails (`Fits this plan` / `Terms confirmed` / `Valid authorizations`) | `src/web/components/workshop.tsx` |
| Candidate matrix: desktop date × participant table, phone cards, expand-in-place | `SlotMatrix` in `src/web/components/workshop.tsx` |
| Avatar states: confirmed / preferred / conditional / not yet / confirmed-but-unavailable | `Avatar`, CSS `.avatar--*` |
| One question card (only when a question exists), reviewed before sending | `src/web/pages/OrganizerPlan.tsx` |
| Participant four-step money line + status sentence | `ParticipantPreferences`, `ParticipantAuthorize` |
| Four money states + amount/min/deadline/failure notes beside the button | `ParticipantAuthorize` |
| Technical detail collapsed (plan hash, audit, provider state, offer fingerprint) | `Disclosure` + `<details>` |
| Motion that explains: avatar state transitions, row highlight on open, accordion expansion | CSS transitions, reduced-motion respected |
| Identity stated on every screen | Shell chip: “You are the organizer” / “You are Diego — participant” |

Measured after the change:

- `npm run ui-smoke` — **14/14** browser steps (sample → preference → confirm → question → publish → consent →
  authorize → collect → result).
- `npm run ui-review` — **0 findings** across 5 states × 4 widths: no axe violations, no overflow at 320px,
  no tap target under 44px, visible focus, CLS 0, entrance/hover/reduced-motion measured.
- `npx vitest run` — 232 tests; `npm run verify` — 62/62 API checks (simulated PayPal, labelled).
- Screenshots regenerated by `capture-live` (desktop + phone); video re-recorded.

**Not done / stated honestly:** no first-time user was observed, so the five-second comprehension goal is a
design intention plus heuristic checks, **not** a user test. Preference, terms, authorization, capture and
failure states are exercised by the automated browser flow and the API walkthrough; the failure/compensation
state is covered by payment tests and the recorded demo, not by a live sandbox failure.
