# Independent deployment UI merge

Merged committed UI changes only: 6aeb940 → 95c261c, 28ea773 → 802ffe3, 81dbae9 → 85f9266. Source UX worktree and any later/uncommitted work were not touched. Contest master remains 8c11d27.

Shell import conflict resolved by retaining both JourneyNav and ServerlessReconcile. Journey navigation stays above routed content; guarded organizer reconciliation stays before the route outlet. Localized skip link retained.

Validation on merged code:
- Server and web TypeScript checks pass.
- 276/276 tests (25 files) pass, including local libSQL persistence/concurrency, tenant isolation, payment recovery/idempotency, and scoped reconciliation. Payments in these tests are simulated, not Sandbox evidence.
- Production frontend build passes.
- Browser fixtures at 1440 and 390 widths show both current-step journey navigation and reconciliation panel. Initial reconciliation POST count is zero; acknowledgment-gated success and error flows pass; no horizontal overflow.
- Browser fixtures intercept state/reconciliation responses. They do not validate real remote storage or payment APIs.
- Temporary test service uses port 5295, a new local DB outside the worktree, no secrets file, forced simulated payments, structured baseline AI. No 5284 preview/user DB access.

Not deployed. Remote Turso, AI Gateway access/credits, distributed quotas and public callback acceptance remain unverified. Existing SlotMatrix React key warning remains a non-blocking test warning.

## Follow-up through UI commit 50a6fc7

Merged fbb179e, 6f48a67, 92a13f9, b894511, 50a6fc7 as 7ddc814, ea82cf5, 3d8d172, 635df60, 3f7aa7f. Live draft studio, distinct landing sections, form layout and price refresh, invitation lifecycle guards, and translated simulated/Sandbox collection copy are preserved.

The service conflict was resolved by preserving the existing async implementation and awaiting getLatestOffer before enforcing frozen membership. Lifecycle tests were ported to async local libSQL: pre-offer additions work; published/closed workshop additions reject without changing membership or status; existing invite tokens remain valid; participants cannot add invitees.

Fresh validation: 296/296 tests, 27 files, server/web TypeScript and frontend build pass. Funding copy tests cover all locales and both modes; these assert text, not real Sandbox success. 1440/390 browser fixture reconciliation checks again pass with JourneyNav present, no unsolicited reconciliation POST, explicit success/error, and no horizontal overflow. Temporary service uses a new local DB and simulated payments only; no accounts/resources/deployment changed. Contest master remains 8c11d27.
