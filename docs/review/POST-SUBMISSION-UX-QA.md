# Post-submission UX QA — 2026-11-12 20:15 UTC

Isolated branch only; competition master was not changed. Preview uses a new synthetic SQLite database, no copied secrets, simulated payments, and structured (non-AI) preference entry.

## Browser journey actually exercised
390 × 844 viewport, Chrome on the user's Mac:
1. Create a workshop from the editable sample with minimum 1.
2. Empty-workshop Next step focuses participant-name entry.
3. Create Journey Guest invitation; success message and private link appear.
4. Open that invitation; correct participant identity appears.
5. Select one time using the structured path; review then explicitly confirm.
6. Switch organizer in synthetic demo controls; plan shows 1/1 and Publish offer.
7. Review and confirm immutable offer terms, then publish.
8. Participant explicitly consents and runs **simulated** authorization of USD45.
9. Organizer simulated collection returns Workshop confirmed, 1 capture / USD45, explicitly no PayPal transaction.
10. Fixed offer's participant preview button now changes synthetic role before navigation; verified correct Journey Guest view, no dead-end message.

No real payment, real model call, external message, or production data access occurred in this audit. A one-person synthetic run does not establish multi-user concurrency or real PayPal success.

## Changes from findings
- Demo-only participant preview previously navigated without identity switch and hit a dead end. Now checks canSwitchRoles, uses existing demo.view action, labels target person, handles errors/busy state. No private invite token is generated or displayed by that action. Non-demo users return to plan instead.
- Mobile header shortened using a two-row metadata layout; payment-mode warning remains visible; 390px screenshot inspected. Viewport reset after testing.
- Settled authorization page no longer repeats pre-authorization intro claiming a future hold. Simulated authorization and settlement bodies explicitly retain no-PayPal-transaction wording.
- Previous patch adds invitation aria-live feedback, theme-aware inputs, focus outline, reduced-motion-compatible arrival animation and minimum44px touch targets.

## Verification
TypeScript web noEmit passed; Vite build passed; 261/261 Vitest tests passed. Actual mobile screenshot and browser states inspected. No real device test; no claim that every language or every error branch was visually verified.

## Preview
http://localhost:5284/ — this Mac only; not a public deployment. Health at audit: ok=true, paypal=simulated, ai=structured. Process lifetime depends on the connected computer/session.
