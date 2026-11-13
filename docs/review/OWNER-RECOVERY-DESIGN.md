# Trustworthy organizer identity and recovery
Status: design plus tested local capability prototype, NOT production authentication.

## Product scope
Pilot one verified studio, not a multi-merchant payment platform. Keep PayPal Sandbox until merchant onboarding, live-money compliance and processor approval are separately resolved. Provider authorization lifetime and recommended capture window are separate deadlines; do not promise an arbitrary future event can retain a valid hold. Verify current official limits (including the discussed 29-day/3-day constraints) before live design.

## Threat model
- Invitation recipients must never inherit the host's privileges.
- A pre-fix null participant view does not establish ownership; prior escalation may already have occurred.
- Cross-device convenience must not rely on supplying a tenant id, event URL, email string or browser localStorage.
- Recovery secrets must not appear in URLs, analytics, screenshots, logs or referrers.
- Replay, simultaneous redemption, expired tokens and partial persistence failure must not grant extra sessions.
- A compromised active owner session can issue transfer secrets. This prototype does not solve account takeover; verified step-up authentication is needed for paid launch.

## Implemented prototype
`OwnerTransferPrototype` is deliberately not imported by any HTTP route or startup code. Its explicit schema installer is used only by tests.
1. A repaired, non-invitation-bound owner session can request a 256-bit random transfer capability for its own tenant. A participant view is refused.
2. The database stores only a domain-separated SHA-256 digest. New issue invalidates previous issue for the same tenant. Lifetime is 15 minutes.
3. Redemption validates and consumes the capability and creates a fresh, independently random owner cookie credential inside one SQLite IMMEDIATE transaction. Exact-boundary expiration is rejected.
4. Consumption rollback accompanies session-creation failure. Successful redemption is single-use.
5. No external identity service, email, payment or production credential is created.

## NOT an old-account recovery shortcut
Old-session migration restricts all legacy sessions and preserves underlying data. There is no safe automatic recovery from the old schema. A legacy organizer must prove identity through evidence independent of the old session. An event name, participant invite, known email or successful access to the old cookie is NOT proof.
For a single-studio pilot, first enroll the actual studio owner through a separately verified account/identity process and then explicitly approve a one-time ownership mapping. Keep a mapping/audit record and rollback plan. Until that exists, old projects remain restricted; do not erase them or assign them to the first visitor.

## Required before connecting this prototype to a real product
- Choose and validate passkey/WebAuthn or an existing trusted identity provider. No new service/permission/fee is implied by this design.
- Establish immutable owner user id and owner-to-workspace membership, not an email-as-primary-key or demo flag.
- Require recent owner reauthentication for issuing transfer or recovery capabilities, payment settings and sensitive operations.
- Same-origin POST only; origin/CSRF checks; secure HttpOnly cookie; Cache-Control:no-store; no secret-bearing URLs.
- Persist rate limits and abuse budgets shared across instances; uniform errors; no plaintext token logging.
- Server-side session expiry, owner session list and revocation, lost-device recovery, recovery-secret rotation and audited revocation after suspected compromise.
- UI must explain code grants organizer access, show expiry, make copying deliberate, and never label a share/invitation link as a recovery link.
- Test actual browser flow, restart persistence and simultaneous remote database redemption. SQLite serialization evidence is not libSQL remote concurrency evidence.
- Add account/privacy policy, data export/deletion/retention and studio support processes before real customer onboarding.

## Validation evidence
Tests cover same-tenant fresh owner creation, raw secret absent from stored rows, replay rejection, invited and legacy-restricted sessions denied, missing session denied, participant-preview denied, guessing/malformed/expired codes rejected, replacement invalidates old code, and transactional rollback on session creation error. Full suite: 300 passing tests; server typecheck passes. No existing databases were opened or migrated. No public deployment or production authentication claims.

## Async libSQL deployment adaptation (2026-11-13)
This deployment branch ports the capability prototype, not an end-user recovery product. Issue and redemption each use AsyncSql.tx with a libSQL write transaction and async-context-bound queries. There is no process-local lock relied on for single use. Atomic UPDATE ... RETURNING consumption and fresh-session insertion commit together; failures roll back both.

The hash-only record also binds the issuing session. Issue checks authority inside the transaction; redemption rechecks that issuer is still owner-capable, not participant-bound or in participant preview, and belongs to the same tenant. A later invitation downgrade invalidates issuance. No plaintext capability/session token is persisted in prototype records or logged. No token URL, HTTP endpoint, automatic schema installation, production resource or existing database migration was added.

Validation: 318/318 isolated tests across 32 files; server/web typechecks and production UI build pass. Two independently opened local libSQL clients simultaneously redeem one token: exactly one succeeds, only one new owner session exists, subsequent replay and reopen replay fail. Includes rollback, expiry/reissue, malformed/guessed tokens, restricted/preview sessions and issuer downgrade/tenant-change rejection. All database files were newly created disposable fixtures, not existing user databases. Network/provider concurrency is still NOT verified: local libSQL serialization is not evidence that deployed remote transaction contention/retries are fully handled.

Release blockers remain trusted owner identity/reauthentication, legacy owner recovery policy, durable cross-instance rate limiting/session revocation, actual remote concurrency tests, same-origin CSRF/no-store HTTP integration and tested secret-safe UX. Turso OAuth consent is pending and was not accepted. No production-readiness claim.
