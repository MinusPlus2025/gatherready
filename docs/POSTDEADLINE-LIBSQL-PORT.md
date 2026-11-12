# Independent post-submission libSQL port

Base: cce566d (post-submission UX), itself based on frozen contest master 8c11d27.
Port: 4de89af, adapted from prototype a46ef71. No web/UI files changed by this port.

## Preserved latest fixes
- Existing PayPal authorization is queried rather than re-authorized on recovery.
- Existing AUTHORIZE operation is updated rather than inserted twice; async regression test retained.
- Failed AI extraction explanatory copy retained.
- Startup simulation label no longer asserts credentials are absent.
- Latest invitation, role handoff and mobile UX remain from cce566d.

## Local verification
- npm run typecheck: pass
- npm run typecheck:web: pass
- npm test -- --run: 22 files / 267 tests pass
- npm run build: pass
- A React unique-key warning remains in invitation render test; not treated as an all-clear UI audit.
- Test persistence uses local file-backed libSQL, not remote Turso. Simulated payment tests do not constitute new PayPal Sandbox evidence.

## Explicit remaining gates
- No remote DB configured, no new accounts/resources, no hosted deployment.
- No remote transaction/concurrency, Vercel cold-start, real cloud AI or HTTPS callback acceptance.
- API adapter requires remote LIBSQL_URL and GATHERREADY_SERVERLESS_EXPERIMENT=true.
- No unattended background scheduler in Vercel adapter. Organizer-triggered reconciliation is implemented and tested locally; remote acceptance remains required. See SERVERLESS-RECONCILIATION.md.
- Cloud credentials/quotas must be checked and authorized; no automatic paid fallback.
- No contest master or submission changes; do not merge or replace original submission after cutoff without organizer permission.

Current offline configuration command: `npm run deploy:check:serverless`. Do not use the legacy persistent-disk `deploy:check` for this Vercel branch. Latest verification: 304 local tests and both TypeScript checks pass; no remote acceptance implied.
