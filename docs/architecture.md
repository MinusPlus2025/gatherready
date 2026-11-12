# Architecture

GatherReady is one process: Fastify serves the API and the built React UI; SQLite is the only state.
The design goal is not "AI product" — it is **a payment decision no model can talk its way out of**.

```text
participant prose ──► AI extraction ──► participant-confirmed constraints ──┐
                                                                           ├─► deterministic solver
merchant facts ────────────────────────────────────────────────────────────┘        │
                                                                                    ▼
                                                      one suggested question (AI proposes, human sends)
                                                                                    │
                                                                                    ▼
                        immutable offer (canonical JSON + sha256) ◄── merchant publishes
                                                                                    │
                              participant reads terms, ticks consent ◄──────────────┘
                                                                                    │
                                                    PayPal order (intent=AUTHORIZE)
                                                                                    │
                                             server authorizes after buyer approval
                                                                                    │
                                 organizer clicks "Confirm workshop and collect"
                                                                                    │
                        server re-validates ──► LOCKED batch ──► serial captures ──► queries
                                                                                    │
                                  all COMPLETED & ≥ minimum → CONFIRMED   else → compensate
```

## Boundaries

| Layer | Owns | Must never |
|---|---|---|
| `src/server/ai/*` | prose → constraint draft; one question proposal | set amounts, confirm on behalf of a person, call payments, alter confirmed constraints |
| `src/server/domain/*` | validation, feasibility, ranking, hashing, transition guards | read the DB, call the network, use randomness |
| `src/server/payments/*` | PayPal REST calls, idempotency, batch lock, compensation, webhook merge | trust client input, treat HTTP 2xx as money moved, treat unknown as failure |
| `src/server/service.ts` | sequencing, authorization checks, audit | let the UI choose amounts/hashes; skip consent validation |
| `src/web/*` | presentation, polling, consent checkbox UX | hold secrets, decide payment state, mark "paid" from a browser redirect |

The model output schema ([`src/shared/schemas.ts`](../src/shared/schemas.ts)) and the **verbatim-quote
verifier** are the boundary: slot ids must exist in the workshop, condition quotes must be literal
substrings of the participant's sentence, arrays/strings are length-limited. A failed verification is a
failed call, not an accepted answer.

## Why the solver is deterministic

Three fixed slots make the core question small: for each slot, how many *confirmed* participants accept
it? Ranking is fixed and total: zero hard-constraint violations → minimum met → fewest pending
conditions → most preferred matches → stable slot ordinal. The model never supplies a score. The same
input state produces byte-identical output, which is what makes "the plan changed because a preference
version changed" auditable.

A condition never counts as a fit. It contributes only to `reachableMax` — the ceiling if the person
answered yes — which is why the organizer sees a separate suggestion rather than an inflated number.

## Preference lifecycle

```text
DRAFT ──confirm──► CONFIRMED ──withdraw──► WITHDRAWN
  │                     │
  └──(new parse)──┐     └──(clarification yes)──► CONFIRMED (new version)
                  └──► NEEDS_CLARIFICATION ──answer──► CONFIRMED (new version)
```

Every confirmation, edit, withdrawal and clarification answer **bumps the preference version**. Plans
carry a `planInputsHash` over the confirmed set; the UI treats a changed hash as a new plan, so a stale
screen cannot act on old constraints.

## Offer immutability and consent

When the merchant publishes, the terms are written once as canonical JSON (sorted keys, no whitespace)
and hashed with sha256. Every money path re-reads the stored offer and compares the hash before acting.
Changing price, time, timezone, minimum, merchant or policy requires a new offer version — an old
authorization is never reused for a new plan (T14). The consent row stores participant, offer id,
offer hash, amount, currency, consent-copy version and click time. The checkbox starts unchecked and the
server rejects a checkout whose `consent` is not `true` (T08's sibling case).

## Money state machine

Application states are normalized; PayPal's raw status is stored separately
(`provider_status`, `resource_type`, `observed_at`) and mapped explicitly. Terminal states never regress.

```text
NONE → ORDER_CREATED → APPROVED → AUTHORIZING → AUTHORIZED ─┬─► CAPTURING → CAPTURED ─► REFUNDING → REFUNDED
                                                            └─► VOIDING → VOIDED
AUTHORIZED / CAPTURING / CAPTURED → FAILED | UNKNOWN | MANUAL_REVIEW (needs reconciliation)
```

`CAPTURED` is written only after a capture **query** returns `COMPLETED`. `REFUNDED` only after a refund
query returns `COMPLETED`. Unknown outcomes are `UNKNOWN`, are picked up by the recovery scheduler, and
are never retried with a new key — the original `PayPal-Request-Id` is reused.

### Settlement (not atomic, on purpose)

The brief's core warning is adopted literally: multiple PayPal payments are independent transactions and
there is no cross-buyer atomic commit. The batch is all-or-nothing by **compensation**:

1. `lockBatch` runs in `BEGIN IMMEDIATE`: same offer hash, one payment per included participant, each
   `AUTHORIZED`, amount/currency equal to the frozen offer, age < 48h, not withdrawn, deadline not
   passed, count within `[minimum, capacity]`. It persists the payment-id list as an immutable snapshot
   and is idempotent (a second click returns the same batch).
2. `executeBatch` captures **serially** (easier to explain and reconcile), persisting an `operations`
   row per action with a stable idempotency key.
3. Every capture is queried. `CONFIRMED` requires all `COMPLETED` **and** count ≥ minimum.
4. Any failure or unresolved outcome → `COMPENSATING`: void uncaptured authorizations, refund captured
   amounts, query refunds, keep `MANUAL_REVIEW` when PayPal will not tell us the final state.
5. The UI shows `CANCELLED` only after every void/refund is resolved. "Request sent" is never drawn as
   "refunded".

## Concurrency, idempotency, recovery

- SQLite `BEGIN IMMEDIATE` serializes money-critical writes in one process; withdrawal and settlement
  therefore have exactly one legal order (T09).
- Unique indexes encode invariants: one payment per `(participant, offer)`, one batch per offer, one
  operation per idempotency key, one webhook row per provider event id.
- Webhooks: signature verification first (simulated mode uses a local HMAC test secret), then
  `INSERT OR IGNORE` on event id, then state merge. Unsigned events are rejected, never "best effort".
- The browser return URL only asks the server to query PayPal. It cannot mark anything as paid.
- `jobs/scheduler.ts` runs on boot and every 30s: cancel expired offers, void their holds, reconcile
  unresolved operations. No browser tab or `setTimeout` is required.

## Isolation and privacy

- Each browser session gets a synthetic tenant. Participants, payments and audit rows are tenant-scoped;
  demo role switching is refused for non-synthetic tenants.
- Participant links carry 32 random bytes; the database stores only the hash. An order id, even a valid
  one, is checked against the caller's tenant and participant before anything is returned.
- The organizer sees constraints, counts and the condition being clarified — never a participant's
  unrelated private sentence. Participants see only their own rows.
- Logs redact tokens, emails and keys; the model receipt contains the participant's sentence only
  because extraction requires it, and the UI says so.

## Failure-driven defaults

| Failure | Default behaviour |
|---|---|
| No model key | Structured form + labelled recorded sample; no fake AI |
| Model timeout / bad JSON | one bounded retry → structured fallback with a visible note |
| Daily model budget hit | structured fallback with a note (bounded spend) |
| PayPal error | typed error surfaced with PayPal's name/message/debug id; no state is faked |
| Payment unknown (timeout) | query, reconcile, then reuse the same idempotency key; never a second charge |
| Refund unknown | keep `REFUNDING`/`MANUAL_REVIEW`; never show "refunded" |
| Deadline passed | cancel the round, release holds, show why |
| Stale page / old preference version | server rejects with a conflict code and a reload instruction |
