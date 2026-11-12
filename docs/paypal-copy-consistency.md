# Simulated PayPal copy consistency (result and status pages)

Date: 2026-11-13. Scope: the result page and all visible payment-status surfaces
when the server is in `paypal: simulated`. No real sandbox transaction is claimed.

## Result page, simulated mode

| Surface | Simulated copy |
|---|---|
| Page banner | **Simulated capture — no PayPal transaction** / **Simulated refund — no PayPal transaction** |
| Server result detail | “… Each simulated capture was recorded locally; no PayPal transaction occurred.” |
| Receipt row detail | **Simulated capture — no PayPal transaction** (refund/capture variants based on status) |
| Pending outcome | “Checking simulated payment state”; local-record instructions, no PayPal request |
| Not-confirmed body | Simulated holds released / simulated captures refunded by local adapter; no PayPal transaction |
| Legend | “The simulated adapter recorded … No PayPal transaction occurred.” |
| Audit summary labels | Payment order/authorization/webhook wording, provider-neutral |

Screenshot: [`organizer-result-1440.png`](screenshots/organizer-result-1440.png)

In real `paypal: sandbox` mode the original sandbox-specific labels are retained
(`Captured (confirmed by PayPal)` etc.). That path is **not exercised** here:
no sandbox credentials/buyer are configured, so it is not claimed.

## Other status surfaces made provider-neutral

- Funding collection copy no longer names PayPal while simulated.
- Participant charged status now reads “Workshop confirmed — simulated capture” and
  “The demo recorded … as captured locally. No PayPal transaction occurred.”
- Participant refund/refunding/failed/authorize-checking copy now uses “payment
  provider” neutral wording.
- Landing state copy and offer intro no longer assert PayPal-specific claims.
- Payment status words `REFUNDING` and `UNKNOWN` are provider-neutral.

## Video consistency

The walkthrough was re-recorded after the copy change:

- overlay badge: **DEMO PAYMENT — NO PAYPAL TRANSACTION**
- collect caption: records each **simulated** payment
- result caption: “Confirmed only after every simulated capture was recorded. No PayPal transaction occurred.”
- result frame at 00:53 shows the exact simulated banner and receipt rows
- file: [`demo/gatherready-walkthrough.mp4`](demo/gatherready-walkthrough.mp4)
- hash/status: [`audit/video-status.json`](audit/video-status.json)

## Verification

- `vitest run`: **257/257**
- `tsc` (server + web): clean
- axe: **0 / 20**
- `ui-review`: **0 findings**
- browser smoke: passed
