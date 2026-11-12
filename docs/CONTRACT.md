# GatherReady — build contract (frozen)

Read this before writing code. It exists so four people can build in parallel without
inventing interfaces. **If you need to change a frozen shape, message the Lead instead of
changing it silently.** Product scope comes from the user's brief; this file narrows it.

Project root: `gatherready/` (inside `/Users/ming/Projects/小程序小应用`). Node 24, TypeScript,
Fastify 5, React 19 + Vite, zod 4, `node:sqlite`, vitest. Dependencies are already installed —
do not run `npm install` and do not add packages.

## 0. Non-negotiables

1. **No fake money claims.** When PayPal sandbox credentials are absent the adapter runs in
   `simulated` mode. Every simulated payment row, API response and screen must say so
   (`simulated: true`, "Simulated PayPal — no real money"). Never label a simulated capture as real.
2. **No invented model output.** Without an API key, extraction runs in `structured` or
   `recorded` mode and the UI says which. Never hardcode an "AI-looking" success for arbitrary input.
3. **Money is integer cents.** No floats, no `parseFloat` on user input, no arithmetic on display strings.
4. **AI never moves money and never confirms on someone's behalf.** Deterministic code decides
   feasibility, amounts, capture, void, refund. The model only turns prose into reviewable constraints
   and proposes one question.
5. **Words stay verbatim.** Any AI quote attached to a constraint must be a literal substring of the
   participant's sentence; the verifier in `src/shared/schemas.ts` enforces it and you must call it.
6. **No secrets in code, logs, fixtures, tests, screenshots, or docs.** Credentials come from
   `secrets/access.json` (git-ignored) or environment variables only. Logs redact tokens, emails, keys.
7. **Sandbox only.** Refuse to start if `PAYPAL_BASE_URL` is not a sandbox host.

## 1. Fixed product facts (do not widen scope)

- One merchant, one two-hour pottery workshop, USD, three candidate slots, 4–6 seats, max 12 intents.
- Price is fixed and all-inclusive: **USD 45.00** in the demo (`4500` cents).
- Authorization window: offer publish → at most **24 hours**. Captures only if authorization age
  **< 48 hours**, not withdrawn, offer unchanged, deadline not passed, and amount/currency match.
- **One clarification per participant, at most one round.** Refusal is respected: no re-asking,
  no discount, no majority override.
- Cross-buyer payments are **not atomic**. Any capture failure/cancellation voids uncaptured
  authorizations and refunds captured ones; unknown outcomes reconcile before any retry.

## 2. File ownership (write scopes)

| Owner | Writes | Must not write |
|---|---|---|
| **Lead** | `src/shared/*`, `src/server/{config,db,repo,service,routes,main,format,seed-sample}.ts`, `scripts/{setup-access,verify,preflight}.ts`, `INDEX`, `README.md`, `docs/**`, `tests/integration/**`, `.env.example`, configs | `src/web/**`, `src/server/{domain,ai,payments,jobs}/**`, `tests/{domain,payments,ai,web}/**` |
| **payments (A)** | `src/server/payments/**`, `src/server/jobs/**`, `tests/payments/**` | everything else |
| **domain-ai (B)** | `src/server/{domain,ai}/**`, `tests/{domain,ai}/**`, `scripts/ai-eval.ts`, `fixtures/ai/**` | everything else |
| **web (C)** | `src/web/**`, `index.html`, `scripts/capture-shots.ts`, `tests/web/**` | everything else |

If a file outside your scope must change: **message the Lead** with the exact need. Do not edit it.

## 3. Module interfaces (exact signatures — implement these)

### 3.1 `src/server/domain/validation.ts` (B)

```ts
export interface ValidatedSlot { id: string; ordinal: 1 | 2 | 3; startUtc: string; endUtc: string; dayLabel: string; timeLabel: string }
export interface ValidatedWorkshop { /* same fields as WorkshopDraftInput, normalized */ slots: ValidatedSlot[] }
export function validateWorkshopDraft(input: WorkshopDraftInput, nowUtc: string): ValidationResult<ValidatedWorkshop>;
export function slotLabels(startUtc: string, endUtc: string, timezone: string): { dayLabel: string; timeLabel: string };
```

Rules: 1–3 slots, non-overlapping, each end after start, first slot start after `authDeadlineUtc`,
auth deadline in the future, price positive integer cents, `minParticipants <= capacity`,
valid IANA timezone (`Intl.DateTimeFormat` accepts it), trimmed non-empty text fields.
Stable slot ids: `slot_a`, `slot_b`, `slot_c` in input order.

### 3.2 `src/server/domain/solver.ts` (B)

```ts
export interface PlanSlotInput { id: string; ordinal: 1 | 2 | 3; label: string }
export interface PlanPreference { participantId: string; displayName: string; version: number; status: PreferenceStatus;
  acceptedSlotIds: string[]; preferredSlotIds: string[]; conditionalSlots: ConditionalSlot[] }
export interface PlanClarification { id: string; participantId: string; slotId: string; status: ClarificationStatus; answer: 'YES' | 'NO' | null }
export interface PlanInput { minimum: number; capacity: number; slots: PlanSlotInput[]; preferences: PlanPreference[]; clarifications: PlanClarification[] }
export function computePlan(input: PlanInput): PlanResult;
export function planInputsHash(input: PlanInput): string;
```

Deterministic rules, in order: (1) a preference counts for a slot only when
`status === 'CONFIRMED'` and the slot is in `acceptedSlotIds`; (2) a `conditionalSlots` entry counts
as reachable-only and never as `fits`; (3) a clarification answered `YES` is represented by the
service as an updated confirmed preference — the solver does not second-guess it; (4) rank candidate
slot ids by: meets minimum first, then fewer pending conditions, then more preferred matches, then
`ordinal`. (5) `suggestion` = the single clarification (PROPOSED or SENT, unanswered) whose YES would
close the gap on the best slot; if none exists return `null` and a `reason` string. No randomness,
no model scores. The same input must always produce byte-identical output.

### 3.3 `src/server/domain/offer.ts` (B)

```ts
export function canonicalOfferJson(terms: OfferTerms): string; // sorted keys, no whitespace
export function hashOfferTerms(terms: OfferTerms): string;     // sha256 hex of canonical JSON
export function validateOfferTerms(terms: OfferTerms): ValidationResult<OfferTerms>;
export function offerTermsRows(terms: OfferTerms): Array<{ label: string; value: string }>; // display rows, same order as brief §4.6
export const CONSENT_TEXT_VERSION: string;
export const CONSENT_CHECKBOX_LABEL: string;
export function consentText(terms: OfferTerms, authDeadlineLabel: string): string;
```

`validateOfferTerms` must reject: price not positive integer cents, currency not USD, missing
inclusions, `minParticipants > capacity`, `startUtc <= authDeadlineUtc`, unsupported timezone.
`offerTermsRows` order: merchant, workshop, date & time, timezone, venue, includes, total, minimum,
authorization deadline, cancellation, if collection fails.

### 3.4 `src/server/domain/state.ts` (B)

```ts
export function canTransitionWorkshop(from: WorkshopStatus, to: WorkshopStatus): boolean;
export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean;
export function captureGuard(input: { paymentStatus: PaymentStatus; authorizedAt: string | null; nowUtc: string;
  offerOpen: boolean; deadlineUtc: string; withdrawn: boolean }): { allowed: boolean; reason: string };
```

`captureGuard` enforces: status AUTHORIZED, authorized within 48h, deadline not passed, offer still
open, not withdrawn. Unknown/regressed provider states must never be treated as success
(`canTransitionPayment` forbids terminal→older transitions).

### 3.5 `src/server/ai/provider.ts` (B)

```ts
export type LlmResult = { ok: true; text: string } | { ok: false; kind: 'disabled' | 'timeout' | 'http' | 'empty'; message: string };
export interface LlmClient { readonly enabled: boolean; readonly provider: string; readonly model: string; readonly mode: AiMode;
  complete(req: { system: string; user: string; maxTokens?: number; timeoutMs?: number }): Promise<LlmResult>; }
export function createLlm(cfg: AppConfig): LlmClient;
```

OpenAI-compatible (`/chat/completions`), Gemini (`:generateContent`), or local Ollama
(`/api/chat`) based on config. Timeout default 12s, one attempt per call; callers own retry.
A disabled client returns `{ ok: false, kind: 'disabled' }` — never fake text.

### 3.6 `src/server/ai/extract.ts` (B)

```ts
export interface ExtractInput { sourceId: string; sourceText: string; slots: Array<{ id: string; label: string }>;
  merchantFacts: Array<{ label: string; value: string }> }
export interface ExtractOutcome { mode: ExtractionMode; model: string | null; attempts: number;
  result: PreferenceExtract; note: string | null }
export async function extractPreferences(llm: LlmClient, input: ExtractInput): Promise<ExtractOutcome>;
```

Flow: live call → `verifyExtract` → on failure retry **once** with the errors appended to the prompt →
on second failure fall back to a deterministic `recorded`/`structured` result built from the text
(`mode: 'recorded'`, `note` explaining the fallback). Never return a made-up success for text the
fallback cannot parse; return empty constraints plus uncertainties asking the one clarifying question.
Calls are bounded per day by `cfg.llm.maxCallsPerDay` (return structured fallback with a note when hit).

### 3.7 `src/server/ai/clarify.ts` (B)

```ts
export interface ClarifyInput { participantName: string; condition: string; sourceQuote: string; slotLabel: string;
  factLabel: string; factValue: string }
export async function proposeClarification(llm: LlmClient, input: ClarifyInput): Promise<{ questionText: string; questionSource: 'ai' | 'template'; attempts: number; note: string | null }>;
export function templateQuestion(input: ClarifyInput): string;
```

Reject an AI question (fall back to template) when: > 160 chars, contains a price different from the
offer total, names a slot other than the target, promises anything beyond `factValue`, or asks a
second question. Exactly one question per participant; wording must be yes/no answerable.

### 3.8 `src/server/payments/paypal.ts` (A)

```ts
export type PaypalMode = 'sandbox' | 'simulated';
export interface PaypalErrorInfo { name: string; message: string; status: number; debugId: string | null; details?: unknown }
export class PaypalError extends Error { info: PaypalErrorInfo }
export interface OrderSnapshot { orderId: string; status: string; amountCents: number; currency: string; approveUrl: string | null; payerId: string | null }
export interface AuthSnapshot { authorizationId: string; status: string; amountCents: number; currency: string; createTime: string | null; expirationTime: string | null; orderId: string | null }
export interface CaptureSnapshot { captureId: string; status: string; amountCents: number; currency: string; refundedCents: number; sellerProtection: string | null }
export interface RefundSnapshot { refundId: string; status: string; amountCents: number; currency: string }
export interface CreateOrderInput { amountCents: number; currency: string; description: string; customId: string; invoiceId: string; returnUrl: string; cancelUrl: string }
export interface Paypal {
  readonly mode: PaypalMode; readonly enabled: boolean;
  createAuthorizeOrder(input: CreateOrderInput, idempotencyKey: string): Promise<OrderSnapshot>;
  getOrder(orderId: string): Promise<OrderSnapshot>;
  authorizeOrder(orderId: string, idempotencyKey: string): Promise<AuthSnapshot>;
  getAuthorization(authorizationId: string): Promise<AuthSnapshot>;
  captureAuthorization(input: { authorizationId: string; amountCents: number; currency: string; finalCapture: boolean; invoiceId: string }, idempotencyKey: string): Promise<CaptureSnapshot>;
  getCapture(captureId: string): Promise<CaptureSnapshot>;
  voidAuthorization(authorizationId: string, idempotencyKey: string): Promise<{ status: string }>;
  refundCapture(input: { captureId: string; amountCents: number; currency: string }, idempotencyKey: string): Promise<RefundSnapshot>;
  getRefund(refundId: string): Promise<RefundSnapshot>;
  verifyWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string): Promise<WebhookVerdict>;
}
export type WebhookVerdict = { verified: true; eventId: string; eventType: string; resourceType: string | null; resource: Record<string, unknown> } | { verified: false; reason: string };
export function createPaypal(cfg: AppConfig): Paypal;
```

- Real mode: `https://api-m.sandbox.paypal.com`, OAuth client-credentials token cached until 60s before
  expiry; every POST sends `PayPal-Request-Id`; amounts from server-side offer only; errors carry
  PayPal `name`/`message`/`debug_id`. Endpoints exactly those in the brief §6.2.
- Simulated mode: deterministic ids prefixed `SIM-` (hash of the idempotency key), `simulated: true`
  recorded by the service, statuses mirror PayPal's (`CREATED→APPROVED→AUTHORIZED→COMPLETED`,
  `VOIDED`, `REFUNDED`), and simulated failures are only reachable through explicitly named test hooks
  (`PAYPAL_SIM_FAIL=CAPTURE:<invoiceId>` etc.) which must be logged as "Simulated failure for testing".
- Webhook verification: real mode posts to `/v1/notifications/verify-webhook-signature` with the raw body
  and headers; simulated mode accepts only bodies carrying `x-gatherready-sim-signature` computed with a
  local test secret, otherwise `verified:false`. Never trust unsigned events.

### 3.9 `src/server/payments/settlement.ts` (A)

```ts
export interface SettlementDeps { repo: Repo; paypal: Paypal; now(): string }
export function lockBatch(deps: SettlementDeps, workshopId: string): Promise<{ ok: true; batch: SettlementBatch } | { ok: false; code: string; message: string }>;
export function executeBatch(deps: SettlementDeps, batchId: string): Promise<{ ok: boolean; batch: SettlementBatch; error?: string }>;
export function compensateBatch(deps: SettlementDeps, batchId: string, reason: string): Promise<{ ok: boolean; batch: SettlementBatch }>;
export function recoverPending(deps: SettlementDeps): Promise<{ reconciled: number; captured: number; voided: number; refunded: number; manualReview: number }>;
```

`lockBatch`: verify offer OPEN + hash matches every included payment + each payment AUTHORIZED, age <48h,
amount/currency equal to offer, count in [minimum, capacity], deadline not passed; then persist a LOCKED
batch with an immutable payment id list in one `BEGIN IMMEDIATE` transaction. Idempotent: a second call
returns the same batch.
`executeBatch`: set CAPTURING, then for each payment serially create/records an operation row and
`captureAuthorization`; query each capture; only when **every** capture is `COMPLETED` and the count meets
the minimum → CONFIRMED (also mark workshop CONFIRMED). Any failure → `compensateBatch`. Never report success
on unknown; query first.

### 3.10 `src/server/payments/webhook.ts` + `src/server/jobs/scheduler.ts` (A)

```ts
export async function handleWebhook(deps: SettlementDeps, input: { headers: ...; rawBody: string }): Promise<{ status: number; body: { ok: boolean; note?: string } }>;
export function startScheduler(deps: SettlementDeps, opts?: { intervalMs?: number }): { stop(): void };
```

Scheduler on boot + every 30s: cancel OFFER_OPEN workshops whose deadline passed (void authorized, mark
CANCELLED); call `recoverPending`; never trust `setTimeout` for money state.

### 3.11 `src/server/repo.ts` (Lead) — available to A/B

The Lead owns this file. It exposes typed row helpers and the transaction helper:

```ts
export class Repo {
  db: DB;
  tx<T>(fn: () => T): T;                     // BEGIN IMMEDIATE … COMMIT/ROLLBACK
  // workshops, slots, participants, preferences, clarifications, offers, consents, payments,
  // settlement_batches, operations, webhook_events, audit_events: get/list/insert/update helpers.
}
export function newId(prefix: string): string;      // crypto random, prefixed
export function sha256Hex(value: string): string;
export function tokenHash(token: string): string;
```

Ask the Lead (message) for any accessor you need that is missing; do not open the SQLite file yourself
inside domain/payments code.

## 4. HTTP contract (Lead owns `routes.ts`)

`GET /api/state` and every `POST` return `AppState` (see `src/shared/api.ts`). Errors are
`{ error: { code, message, fields? } }` with 4xx/5xx codes. Session cookie `gr_session` scopes a
tenant; `?ptoken=` (or `X-Participant-Token`) scopes a participant and binds the session to that
participant's tenant. Demo role switching is allowed only on synthetic tenants.

Routes: `POST /api/workshop`, `POST /api/preferences/parse`, `POST /api/preferences/confirm`,
`POST /api/plans/compute`, `POST /api/clarifications/:id/send`, `POST /api/clarifications/:id/answer`,
`POST /api/offers/publish`, `POST /api/checkout/orders`, `POST /api/checkout/:orderId/complete`,
`POST /api/participants/:id/withdraw`, `POST /api/workshops/:id/settle`, `POST /api/paypal/webhook`,
`POST /api/demo/view`, `POST /api/demo/reset`, `GET /return`, `GET /cancel`.

## 5. Testing contract

- `npx vitest run` from `gatherready/` must be green; each owner adds tests in their scope.
- Domain/AI/payments tests use the adapter with injected fakes; **a simulated pass is never reported
  as sandbox evidence** (`docs/testing.md` keeps the two columns separate).
- Every payment safety rule has a named test: T01–T20 from the brief, mapped in `tests/`.
- Tests must not reach the network. Use fixed clocks (`now` injected) and fixed ids.
- Typecheck: `npx tsc -p tsconfig.json --noEmit` (server + shared). Web: `npx vite build` must pass.

## 6. Commands

```bash
cd gatherready
npx vitest run                       # tests
npx tsc -p tsconfig.json --noEmit    # server typecheck
npm run dev                          # Fastify API on :5180
npm run dev:web                      # Vite UI on :5181 (proxies /api)
npm run build                        # UI to dist/web, served by Fastify
npm run verify                       # end-to-end flow assertions
```

## 7. Definition of done for a module

- Interfaces above implemented exactly (names, params, return shapes).
- No `any` at module boundaries; no unused imports; strict TS passes.
- Failure paths return typed errors, not thrown strings; network errors never become "success".
- The module's tests cover its failure modes, not just the happy path.
- A short note at the top of the file explaining the non-obvious safety decision.
