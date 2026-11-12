# Participant flow pass — status and evidence

Date: 2026-11-12 23:35 (Asia/Shanghai)
Scope: `/participant/preferences` and the demo entry into it. Product direction is
unchanged; money remains server-owned and deterministic.

Status vocabulary: **done** = implemented and observed in this build; **unverified**
= code exists but the required evidence was not produced; **blocked** = missing
external credential, publication channel or access.

## P0 — truthfulness and state

| # | Item | Status | Evidence / remaining |
|---|---|---|---|
| 1 | Payment hint matches the server mode | **done** | `/healthz` says `paypal: simulated`; header chip, payment button, authorize notice and footer now say **"Demo payment — no PayPal transaction"**. Real-sandbox labels exist but were not exercised. Since simulated is the deployed mode, no page claims a PayPal transaction. |
| 2 | A real model run, not `ai: structured` | **done** | `ai: live`, Ollama `qwen2.5:7b-instruct`, 1.5–2.0 s preview; see [`ai-live-evidence.md`](ai-live-evidence.md) and [`audit/ai-live-evidence.json`](audit/ai-live-evidence.json). Fallback labels exist; killing the model to prove fallback was **not** exercised. |
| 3 | Saved vs unsaved edits | **done** | Confirmed edits call a non-persisting `preview`; the saved version stays `CONFIRMED`. Revise only happens on the explicit confirm (`/api/preferences/revise`, 200). Cancel and reload leave the saved version untouched (verified v1 during preview, v2 after cancel/reload). |
| 4 | Direct participant entry without an identity-switch wall | **done (demo)** | Landing "See it as a participant" switches only a synthetic demo tenant and lands on `/participant/preferences`; demo controls are collapsed by default. Real access still goes through invite/session tokens; demo role switching was not turned into authorization. |

Also fixed while proving #3: re-parsing an existing preference did not persist the
new `source_text`, so a condition quote failed the verbatim check. The update path
now writes `source_text`; covered by the live run and the pre-existing integration
suite.

## P1 — participant experience

| # | Item | Status | Evidence / remaining |
|---|---|---|---|
| 5 | First screen: activity, price, times, current action | **done** | Activity card (workshop, studio, $45 per person, minimum 4) + three compact date cards + one timezone line + compact progress. [`participant-final-saved-1440.png`](screenshots/participant-final-saved-1440.png), [`participant-final-saved-390.png`](screenshots/participant-final-saved-390.png) |
| 6 | Confirmed state: saved title, primary "Change preference" | **done** | Title says "Your preference is saved"; primary action is "Change preference"; demo roles/Screens/Reset live in a collapsed **Demo controls** row. |
| 7 | Two input modes; review shows only extraction results | **done** | "Describe my situation" / "Pick times directly"; switching keeps both drafts. Review uses short slot labels and one verbatim quote; repeated long dates/quotes removed. |
| 8 | Preference → plan → authorization → charge, compact on mobile | **done** | Compact four-step progress with only the current explanation expanded. Authorization-is-a-hold / not-a-charge copy remains. Full browser smoke reaches capture. |
| 9 | Button states, empty-input guard, failure keeps input, diagnostics | **done** | Confirm is disabled with no accepted time; busy labels during extraction/confirm; API errors keep the textarea and the mode switch offers the manual path; version/extraction/confirmed-at are inside "Technical details", not the main page. |
| 10 | Authorized images, no invented reviews/counts/discounts, privacy claim | **done, with caveat** | Pexels stand-in photography (credited in the footer); no testimonials, fake signups or discounts. The "7 days" claim was checked against `purgeSyntheticTenantsOlderThan` (deletes the synthetic tenant, preferences and LLM call rows once no payment is in flight), not against production data. |

## Acceptance checks

| Check | Status | Notes |
|---|---|---|
| Desktop 1440 and 390 complete participant path | **done** | Screenshots in `docs/screenshots/participant-final-*`; browser smoke walks preferences → confirm → plan → offer → authorize → capture → result. |
| English original with no translation extension | **done (headless)** | Headless Chrome 143 without extensions; `<html lang="en">`, English copy. A judge's browser extension cannot be controlled from here. |
| Independent synthetic input → review → confirm → refresh → cancel | **done** | New sentence "I can do Saturday morning only, starting at 10."; v1 stayed valid during preview; v2 confirmed; plan Saturday fits 3→4 (minimum reached); cancel/reload kept v2. Raw JSON in [`audit/ai-live-evidence.json`](audit/ai-live-evidence.json). |
| Dates, timezone, amount consistent | **done** | Server labels `America/Los_Angeles`; `$45.00` from frozen workshop data; mobile and desktop render the same slot labels. |
| Keyboard operable, no mobile horizontal overflow | **verified by tooling, not a real-device pass** | axe 0/20 runs, `ui-review` 0 findings at 1440/390/320 (tap targets ≥44 px, no overflow). No screen-reader or real-device session was run. |
| Real AI request | **done** | Local Ollama, model and latency recorded; see above. |
| Real PayPal sandbox authorization / capture / cancel | **blocked** | `secrets/access.json` has empty PayPal values; `npm run paypal-preflight` prints **BLOCKED**; `/healthz` says `paypal: simulated`. No sandbox order id, capture id or cancellation exists. The simulated adapter passing is **not** evidence of a real sandbox call. |
| Open source / license / English docs / YouTube / judging access | **partly done, partly blocked** | MIT `LICENSE` exists and the README is in English. The checkout has **no git remote**, so the source is not published; the local walkthrough `docs/demo/gatherready-walkthrough.mp4` exists but was **not uploaded to YouTube**; Devpost/review access was not verified. |

## Verification commands and results

```text
npm test                    257 passed (18 files), incl. 821-key i18n parity, source-text update and shuffled-matrix tests
npm run test:ui             browser smoke passed end to end
npm run audit:axe           axe-core 0 violations / 20 route×viewport runs
npm run ui-review           0 findings at 1440/834/390/320
npm run verify              62/62 checks passed (separate port 5192)
npx tsc -p tsconfig.json    clean
npx tsc -p tsconfig.web.json clean
eslint (web, jsx-a11y)      0 problems
```

## What this pass does not establish

- That the product is compliant, deployable, or likely to win. A better participant
  page is not a PayPal sandbox authorization, a public repository or a submitted video.
- Real sandbox money movement, webhook signature handling against live sandbox
  traffic, or capture/cancel history.
- User testing, native-speaker translation review, screen-reader testing or real
  device testing.
- Model robustness beyond one local run.
