# Invitation authorization boundary — 2026-11-13

## Verified vulnerability
An invited participant could POST `/api/demo/view` with `participantId:null`, receive HTTP 200 and become organizer. All new tenants were synthetic; synthetic status was incorrectly treated as permission to change roles. A missing participant also silently cleared the view to organizer. Rebuilding the app did not protect the session. Three HTTP regression tests failed before the patch.

## Isolated fix
Branch `fix/post-submission-session-boundary`, based on post-submission UX 03bd914. Original contest master, application database, payment credentials and deployment are untouched.
- New owner sessions explicitly start with `participant_bound=0`.
- Consuming any valid participant invitation atomically sets tenant, participant and `participant_bound=1` in one UPDATE.
- Invitation-bound sessions cannot switch roles or reset a demo, including when the invitation token is no longer supplied.
- Missing or cleared participant identities fail closed, never become organizer.
- Invite responses disable the role selector, omit other participant roster entries and internal audit history.
- Private demo owners retain participant-preview/back-to-owner functionality without using bearer invitation links.

## Legacy migration — do NOT run against existing data without a recovery plan
Old sessions cannot prove ownership. A null participant view may be a genuinely original organizer OR an already escalated invited visitor. Therefore the migration marks **all pre-existing sessions restricted**, retaining the rows and workshop data. Existing participant sessions remain participant-only; legacy organizer sessions fail closed. No automatic ownership restoration is attempted. New sessions created after migration explicitly remain owner-capable for their newly created tenant.

Legacy owner access requires a separately designed and verified recovery/authentication mechanism. This patch is not an authorization to migrate an existing database. Migration tests used only a temporary synthetic legacy SQLite file; it was removed afterward.

## Validation
- Fastify HTTP tests: invited role escalation, other-participant switch, reset, settlement rejection, cookie-only refresh, app reconstruction, invalid/cleared identity, cross-tenant participant ids, owner demo preservation.
- Legacy SQLite upgrade and close/reopen persistence tested on a temporary synthetic DB.
- Full Vitest suite: 296 tests pass; server and web typechecks pass; production UI build passes.
- No actual PayPal requests, no real user records, no public deployment.

## Remaining product blockers
This is not a production authentication system. There is no verified account/recovery flow, host cross-device recovery, revocable invitation lifecycle, independent security review, or remote database multi-instance concurrency validation. Existing cookies remain bearer credentials. Do not represent the app as ready for real paid workshops.

This run fixed a server authorization bug, not a completed visual UX audit. No screenshot-based design conclusions are claimed. The async libSQL deployment branch needs an explicit reviewed port and fresh test run; blindly cherry-picking synchronous repository calls would be unsafe.

## Async deployment branch port

Ported into independent deploy/post-submission-libsql with awaited getSession/bindParticipantSession and async schema inspection/ALTER. Service organizer guard also checks persisted participantBound, not only the passed view ID. Added concurrent bound-session role/reset/settle/reconcile rejection test.

Validated only disposable isolated fixtures, including legacy null-view and invitation sessions, reopen persistence, cross-tenant rejection, original fresh demo owner preview and concurrent forbidden requests. 312/312 tests (31 files), server/web type checks and production frontend build pass. No existing database was opened/migrated and no real PayPal call or public deployment occurred. Remote migration remains explicit, not performed at Vercel cold start.

Not an owner-account recovery implementation. Existing owner sessions without trustworthy capability deliberately fail closed after migration. Real owner recovery and OAuth/resource approval remain release blockers. The concurrent test covers already-bound sessions; it is not proof of all cross-instance races during first invitation binding. No production-readiness claim.
