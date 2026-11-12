# Serverless policy: explicit actions, no unattended timing claim

This is a post-deadline experimental branch, not an update to the competition submission.

## Implemented server contract
- Collecting still requires the existing explicit organizer settlement action. A page GET never initiates capture, cancellation, refund or a recovery tick.
- `POST /api/workshops/:id/reconcile` requires session, `x-gatherready: 1`, organizer role and exact ownership of the selected current workshop.
- Reconciliation handles expired offers and already-started settlement/compensation using existing deterministic payment logic and idempotency keys. It may finish a previously approved capture or compensation; therefore it is not a read-only refresh action.
- Batch queries scope tenant and workshop in SQL. Expiry processing selects only the matching workshop. Scoped reconciliation never performs global retention purges.
- Existing PayPal webhooks remain signature-verified; delivery and successful processing are not guaranteed by this local work.
- Without a request or verified webhook, no serverless process is running. There is NO promise of cancellation at the exact deadline or guaranteed 30-second recovery.

## UI integration (independent Vercel branch only)
Implemented organizer button: “Check and finish pending payments”. Explain that it may complete an already approved collection or release/refund existing payments. For expired offers, prompt the organizer to reconcile. No silent reconciliation on GET, no success before persisted provider evidence, no spinner falsely described as a background job. Show “Organizer-triggered reconciliation; automatic deadline processing is not enabled on this preview.” Do not alter the existing UI worktree without coordination.

## Local evidence
270 tests pass, including two tenants in one DB, scoped expiry cancellation, repeated requests without additional simulated payment actions, participant/cross-workshop rejection, missing CSRF-header rejection. Existing overlapping capture and retry tests remain. This does not prove remote Turso behavior or real Sandbox execution on Vercel.

## Remaining release gates
- Runtime timeout/retry and remote concurrent clients must be exercised on the actual deployed service. A 60-second function is not proof all payment operations finish within it.
- Cross-instance durable rate/AI quota limits are required. Existing process-local rate map is not a global quota.
- Retention currently has no automatic serverless trigger. Publish truthful retention policy and implement bounded maintenance before collecting real personal data.
- Protected sandbox credentials, remote persistence, cloud AI and public HTTPS webhook acceptance remain unverified.

## Zero-cost resource/authorization checklist
1. Existing Vercel Hobby: confirm project and quotas; no plan upgrade or paid add-on. Use independent post-submission deployment, not competition alias.
2. Turso Free officially lists $0 and no credit card. User must authorize any new account, associated terms and a dedicated database. No current Turso account/session/credentials have been verified. Never reuse TimeBank or ScopePilot data. Obtain only narrowly scoped database credentials via approved secure setup; do not print them.
3. Vercel AI Gateway officially advertises $5/month free credits for eligible models. Actual team balance, eligibility and identity authentication have NOT been checked. No paid-credit purchase, auto-reload, paid fallback or BYOK assumed. Stop calls when free balance is unavailable; add persistent per-visitor/global limits before public access.
4. Gateway provider endpoint and OIDC/API-key wiring still require implementation and a real successful test. Existing openai-compatible config is not proof of Gateway readiness.
5. Existing PayPal Sandbox secrets may only be configured through an authorized secure workflow, never committed or exposed. No live payments. Sandbox account access does not authorize paid hosting.

Sources: https://turso.tech/pricing ; https://vercel.com/docs/ai-gateway/pricing

## UI acceptance update
- Runtime-gated panel is shown only to organizers with a workshop and offer when `/healthz` reports organizer-triggered reconciliation. The panel explains no automatic deadline processing. It is not shown on ordinary scheduler-backed deployments.
- Explicit disclosure + acknowledgement checkbox precedes enabled action; an in-flight guard blocks rapid repeated clicks. Keyboard-native details, checkbox and button; minimum 44px button target; visible focus; status/alert announcements; mobile single column.
- UI uses POST with same-origin header; API state polling/GET never reconciles. Errors warn outcomes may still be pending rather than claiming no operation happened.
- Both typechecks, production build and 273 tests pass, re-run after Mac reconnection.
- `scripts/check-reconcile-ui.ts`: isolated headless Chromium fixture test at 1440px and 390px passed before disconnect; initial reconciliation POST count 0, explicit success + failure actions 2, acknowledgement resets, error alert visible, no horizontal overflow. Browser requests were intercepted fixtures, not real provider calls. Service isolation/idempotency are separately covered in integration tests.
- After reconnection, port 5295 has no listener; no process had to be killed. No current user preview, contest master, provider account or deployment changed. New panel copy is English-only pending localization.
