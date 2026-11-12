# Submission pack (prepared, not submitted)

Prepared 2026-11-13. This is the honest final package for the owner to submit; it
does not claim a public deployment or a real PayPal sandbox transaction.

## Links

| Item | URL / file | Status |
|---|---|---|
| Public GitHub repository | https://github.com/MinusPlus2025/gatherready | **published**, MIT license |
| Public demo | — | **not available** |
| Walkthrough video | [`docs/demo/gatherready-walkthrough.mp4`](demo/gatherready-walkthrough.mp4) (also in the public repo) | recorded from current build; **not on YouTube** |
| Submission page | — | **not submitted** (Devpost account/submission access not available here) |
| Vercel free evaluation | branch `deploy/vercel-free-eval`, [`vercel-free-evaluation.md`](vercel-free-evaluation.md) | **blocked**, no deployment |

## Project description (English, submit-ready)

GatherReady turns conditional workshop interest into one confirmed plan. Participants
write what they can really do; a bounded model extraction is reviewed and confirmed by
the participant; deterministic code counts only confirmed fits, asks at most one
question, freezes one offer, and collects PayPal authorizations only when the minimum
is reached. Money is server-owned; AI never chooses who attends or touches a payment.

## What is real right now

| Part | Status |
|---|---|
| Local app, desktop + phone | Verified |
| Database isolation and restart persistence | Verified locally |
| AI | Real local Ollama `qwen2.5:7b-instruct` (`ai: live`) |
| PayPal | **simulated**; no server sandbox credentials loaded, no real authorization/capture/void |
| Public hosting | Not delivered |
| YouTube | Not uploaded |
| Devpost | Not submitted |

Do **not** describe the PayPal integration as real sandbox in the submission until a
real authorization and capture/void exists.

## YouTube metadata (for the owner to upload)

Title: `GatherReady — one confirmed workshop plan, paid only when it is real`
Description: include the public GitHub URL, state that local Ollama is the live AI
model, and explicitly say the recorded demo uses the labelled **demo payment** adapter
because sandbox credentials were not available. Do not claim a real PayPal transaction.
Visibility: public/unlisted as the rules require; keep available through judging.

## Devpost fields (draft)

- Inspiration: group chats turn “maybe” into no plan; organizers need commitment, not noise.
- What it does: conditional input → confirmation → deterministic fit count → one question → fixed offer → PayPal authorization → separate capture.
- How it works: Fastify + React + node:sqlite; deterministic money service; bounded AI extraction with verbatim quotes; no model access to payments.
- Challenges: keeping AI non-authoritative, server-owned money, honest simulated-vs-sandbox labels.
- What is next: hosted single-instance deployment with persistent disk, real sandbox credentials, native translation review.
- Built with: TypeScript, Node.js, Fastify, React, Vite, SQLite, Ollama, PayPal REST (simulated path).
- Try it: local instructions in the repository README until a public URL exists.

## Receipt

There is no submission receipt because the project was not submitted. See
[`audit/submission-status.json`](audit/submission-status.json).
