# Demo script — under three minutes (target 2:40)

Rules we hold ourselves to: show the running product, not slides; state what is pre-staged; never imply
a simulated payment is a real sandbox payment; include one failure/compensation path.

## Recorded walkthrough (already produced)

[`demo/gatherready-walkthrough.mp4`](demo/gatherready-walkthrough.mp4) — 60 seconds, silent, recorded by
`npm run record-demo` from the live server + built UI. Every state change is a real HTTP call; the PayPal
adapter is the labelled **simulated** one because no sandbox credentials exist on this machine, and the
badge stays visible in every frame. Use it as a shot-list reference, or play it with your own narration.

It is **not** the submission video: a submission recording needs your voice, and ideally sandbox
credentials so the real PayPal approval window and the sandbox badge appear. The timeline below is for
that recording.

## Before recording (pre-staged, and said out loud on camera)

- `npm run preflight` shown once (or in the video description) so the viewer knows which mode was used.
- Both server and UI running; browser window at 1440×900; a second browser (or mobile width) ready for
  the participant view.
- Sandbox credentials, if available, are in `secrets/access.json` (git-ignored) and the banner reads
  **Sandbox · No real money**. If they are not available, the banner reads **Simulated PayPal — no real
  money** and the narration says so at 0:00 and again at 1:15.
- Demo tenant loaded with the synthetic sample; Diego left unconfirmed on purpose.
- If the PayPal window or approvals are pre-completed, say exactly which ones and why.

## Timeline

**0:00–0:20 — the real problem, sourced.**
Split screen: one published policy line ("minimum enrolment; if a class does not fill we contact
students to reschedule or refund" — POT Studio FAQ) and a chat-style example of conditional interest.
Narration: *"The interest is real. It is just conditional, so the organiser cannot count it. This is a
candidate solution, not a validated business — no customer results are claimed."*

**0:20–0:50 — messy sentence → reviewable constraints.**
Switch to Diego. His sentence is prefilled. Press **Analyze my message**. Point at the card: must have
Saturday afternoon; **condition** "if all the materials are included I could maybe do Saturday morning",
with his exact quote underneath. Say: *"This is not a yes. It is a condition, and it does not count yet."*
Point at the mode label (Live AI or Recorded sample) and say which it is.

**0:50–1:15 — one question, asked less.**
Organizer → plan: `Interested 6`, `Fits this plan 3`, `Payment authorized 0`. One suggested question
with the merchant fact: *"All materials are included. Would Saturday 10:00–12:00 work for you?"*
Send → switch to Diego → **Yes, this works** → back to organizer: `Fits this plan 4`. Then say: *"If he
had said no, his original preference would stand and he would not be asked again."*

**1:15–1:55 — one frozen plan, real PayPal authorization.**
Publish the offer. Point at the fingerprint (`Offer v1 · hash abc123…`), the full term rows and the
unchecked consent box. Read the consent sentence. Continue to PayPal — if this is the simulated adapter,
say **"simulated, no real money"** and show the simulated banner; if sandbox, show the sandbox badge.
Return, show `Checking with PayPal` → `Authorized — not charged`. Show the other three participants as
**pre-staged** authorizations in the timeline and say so explicitly.

**1:55–2:20 — collect, and prove it is not atomic.**
Organizer: **Confirm workshop and collect**. Watch the batch lock, then four captures with four distinct
capture ids. Point at `Captured`, `Workshop confirmed`, and the separate per-person receipt states.
Say: *"These are four independent PayPal transactions. There is no atomic group charge; the batch is
all-or-nothing by compensation."*

**2:20–2:40 — the failure path, shown not claimed.**
Reset demo → publish below the minimum → blocked, with the reason. Or show the recorded partial-failure
test: one capture fails, no success screen, holds released and completed charges refunded, state
`COMPENSATING` visible with a pending action. Close on the honest line: *"Sandbox prototype for one
merchant and one workshop. Payments are not atomic, and demand still needs validation."*

## Production checks

- 1080p screen capture, no notification popups, no secrets or tokens visible (blur the terminal if it
  prints the DB path with a username).
- No music unless its licence is clear; captions for any speech.
- Video under 3:00 and publicly visible (owner uploads).
- Every button shown must be reachable by a judge in the deployed/preview environment.
