# Genuine Sandbox UI payment verification, 2026-11-12

Environment: isolated synthetic local SQLite database, separate port 5271, scheduler disabled. Original app/database and TimeBank untouched. This is PayPal Sandbox, no real-money charge.

## Observed flow
- Created a new one-person workshop via organizer UI, USD 45.
- Missing participant invitation UI discovered. One synthetic participant was added through the existing service and an offer was published through the service to unblock this payment experiment. This is **not evidence of a complete from-zero UI creation/invitation/publishing flow**.
- Participant opened invitation, selected a time through structured controls, and confirmed preferences in the UI.
- Participant checked unchecked consent and clicked Continue to PayPal for USD 45.
- Genuine sandbox checkout opened using existing logged-in sandbox buyer session. Browser approved the sandbox order and returned to the app.
- Found and fixed authorization resource status mapping: PayPal authorization `CREATED` is valid uncaptured authorization, normalized to internal `AUTHORIZED`. Order CREATED is not normalized.
- Found and fixed callback recovery: existing authorization is fetched instead of requesting another authorization, and existing operation is updated rather than duplicate insertion.
- Retried the same return for the same order. Participant UI showed Authorized — not charged yet, USD 45.
- In a new browser tab, switched to organizer. Funding showed 1/1 authorized, USD 45 held, USD 0 captured.
- Clicked Confirm workshop and collect once. Result showed Workshop confirmed and USD 45 captured (confirmed by PayPal).

## Non-secret Sandbox evidence
- Order: ending 312T
- Authorization: ending 7049
- Capture: ending 345K
- Amount: 4500 cents / USD
- Local verified status: CAPTURED
- Provider status: COMPLETED
- simulated: 0

## Limits
No public deployment/webhook verification is claimed by this test. No from-zero invitation UI success is claimed. No AI parsing was invoked in this structured-input payment experiment. The separate video must identify this as Sandbox and not real commerce. Do not recapture this completed payment for filming.
