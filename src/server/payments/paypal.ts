/* ==========================================================================
   PayPal adapter — sandbox REST (real) and `simulated` (no credentials).

   Safety decisions:
   - Money is integer cents at every boundary. PayPal decimal strings are parsed
     exactly (no parseFloat) and rejected when they carry more than two decimals.
   - Only USD is accepted by this MVP; anything else throws before a request.
   - `PayPal-Request-Id` is sent on every POST so a retry of the same logical
     action cannot create a second authorization/capture/refund. The simulated
     adapter mirrors that contract by keying every resource to the idempotency
     key, which is what lets the settlement tests prove "no double charge".
   - Errors carry PayPal `name` / `message` / `debug_id` / HTTP status, and a
     status of 0 means "outcome unknown" (network/timeout). Callers must never
     treat unknown as success.
   - Nothing secret is logged: no tokens, no emails, no request bodies. The real
     client caches the OAuth token until 60s before expiry.
   - Simulated failures only exist behind explicit `PAYPAL_SIM_FAIL` test hooks
     and log exactly "Simulated failure for testing". No other path can make a
     simulated capture fail; no path can fake a real capture.
   - Webhooks are only trusted after verification: PayPal's
     verify-webhook-signature endpoint in sandbox mode, a local HMAC in
     simulated mode. Unsigned events are rejected, never merged.
   ========================================================================== */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../config.js';
import { assertSandbox } from '../config.js';

/* --------------------------------- shapes -------------------------------- */

export type PaypalMode = 'sandbox' | 'simulated';

export interface PaypalErrorInfo {
  name: string;
  message: string;
  status: number;
  debugId: string | null;
  details?: unknown;
}

export class PaypalError extends Error {
  readonly info: PaypalErrorInfo;

  constructor(info: PaypalErrorInfo) {
    super(`${info.name}: ${info.message}`);
    this.name = 'PaypalError';
    this.info = info;
  }
}

export function isPaypalError(err: unknown): err is PaypalError {
  return err instanceof PaypalError;
}

/**
 * `true` when the provider outcome must be treated as unknown: network error,
 * timeout, 5xx, or an explicitly ambiguous simulated failure. A definitive 4xx
 * (declined, not capturable, already voided) is *not* unknown.
 */
export function isUnknownPaypalOutcome(err: unknown): boolean {
  if (!(err instanceof PaypalError)) return true;
  if (err.info.status === 0 || err.info.status >= 500) return true;
  return /^(SIMULATED_UNKNOWN|NETWORK_)/.test(err.info.name);
}

export interface OrderSnapshot {
  orderId: string;
  status: string;
  amountCents: number;
  currency: string;
  approveUrl: string | null;
  payerId: string | null;
}

export interface AuthSnapshot {
  authorizationId: string;
  status: string;
  amountCents: number;
  currency: string;
  createTime: string | null;
  expirationTime: string | null;
  orderId: string | null;
}

export interface CaptureSnapshot {
  captureId: string;
  status: string;
  amountCents: number;
  currency: string;
  refundedCents: number;
  sellerProtection: string | null;
}

export interface RefundSnapshot {
  refundId: string;
  status: string;
  amountCents: number;
  currency: string;
}

export interface CreateOrderInput {
  amountCents: number;
  currency: string;
  description: string;
  customId: string;
  invoiceId: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface Paypal {
  readonly mode: PaypalMode;
  readonly enabled: boolean;
  createAuthorizeOrder(input: CreateOrderInput, idempotencyKey: string): Promise<OrderSnapshot>;
  getOrder(orderId: string): Promise<OrderSnapshot>;
  authorizeOrder(orderId: string, idempotencyKey: string): Promise<AuthSnapshot>;
  getAuthorization(authorizationId: string): Promise<AuthSnapshot>;
  captureAuthorization(
    input: { authorizationId: string; amountCents: number; currency: string; finalCapture: boolean; invoiceId: string },
    idempotencyKey: string,
  ): Promise<CaptureSnapshot>;
  getCapture(captureId: string): Promise<CaptureSnapshot>;
  voidAuthorization(authorizationId: string, idempotencyKey: string): Promise<{ status: string }>;
  refundCapture(
    input: { captureId: string; amountCents: number; currency: string },
    idempotencyKey: string,
  ): Promise<RefundSnapshot>;
  getRefund(refundId: string): Promise<RefundSnapshot>;
  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): Promise<WebhookVerdict>;
}

export type WebhookVerdict =
  | {
      verified: true;
      eventId: string;
      eventType: string;
      resourceType: string | null;
      resource: Record<string, unknown>;
    }
  | { verified: false; reason: string };

/** Statistics that only the simulated adapter exposes (tests prove "no double charge"). */
export interface PaypalSimulationStats {
  ordersCreated: number;
  authorizationsCreated: number;
  capturesCreated: number;
  refundsCreated: number;
  voidsCreated: number;
}

/* ------------------------------ amount math ------------------------------ */

const PAYPAL_TIMEOUT_MS = 20_000;
const TOKEN_EARLY_REFRESH_MS = 60_000;

/** 4500 -> "45.00". Integer cents only; never a float. */
export function centsToDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new PaypalError({
      name: 'INVALID_AMOUNT',
      message: 'amount must be a non-negative integer number of cents',
      status: 400,
      debugId: null,
    });
  }
  const centsPart = String(cents % 100).padStart(2, '0');
  return `${Math.trunc(cents / 100)}.${centsPart}`;
}

/** "45.00" -> 4500. Rejects negative, >2 decimals, spaces, and anything odd. */
export function decimalToCents(value: string): number {
  const trimmed = value.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) {
    throw new PaypalError({
      name: 'INVALID_AMOUNT',
      message: `PayPal returned an amount that is not an exact cent value: ${JSON.stringify(value)}`,
      status: 500,
      debugId: null,
    });
  }
  const whole = Number(match[1]);
  const fractional = Number((match[2] ?? '').padEnd(2, '0'));
  const cents = whole * 100 + fractional;
  if (!Number.isSafeInteger(cents)) {
    throw new PaypalError({ name: 'INVALID_AMOUNT', message: 'PayPal amount is out of range', status: 500, debugId: null });
  }
  return cents;
}

function assertUsd(currency: string): void {
  if (currency !== 'USD') {
    throw new PaypalError({
      name: 'CURRENCY_NOT_SUPPORTED',
      message: `only USD is supported by this workflow (received ${currency})`,
      status: 400,
      debugId: null,
    });
  }
}

function assertPositiveCents(cents: number): void {
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new PaypalError({ name: 'INVALID_AMOUNT', message: 'amount must be a positive integer number of cents', status: 400, debugId: null });
  }
}

/** Strip anything that looks like an email or a token before it can be shown or logged. */
function redact(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted-email]')
    .replace(/\b(sk|pk|client_secret|access_token)[_-][A-Za-z0-9_-]+/gi, '[redacted-secret]');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isoTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function isoPlusDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmacHex(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

/* ------------------------------ simulated -------------------------------- */

const SIM_WEBHOOK_SECRET_ENV = 'GATHERREADY_SIM_WEBHOOK_SECRET';
const DEFAULT_SIM_WEBHOOK_SECRET = 'gatherready-sim-webhook-secret-dev-only';

function simWebhookSecret(): string {
  const fromEnv = process.env[SIM_WEBHOOK_SECRET_ENV];
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_SIM_WEBHOOK_SECRET;
}

/**
 * Signature used by the simulated webhook path and by tests. Real deployments
 * never use this; it exists so the dedupe/merge logic can be exercised without
 * credentials, and it is labelled as simulated everywhere a human can see it.
 */
export function simWebhookSignature(rawBody: string, secret: string = simWebhookSecret()): string {
  return hmacHex(secret, rawBody);
}

interface SimOrder {
  orderId: string;
  amountCents: number;
  currency: string;
  status: string;
  approveUrl: string;
  payerId: string | null;
  authorizationId: string | null;
}

interface SimAuthorization {
  authorizationId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  status: string;
  createTime: string;
  expirationTime: string;
}

interface SimCapture {
  captureId: string;
  authorizationId: string;
  amountCents: number;
  currency: string;
  status: string;
  refundedCents: number;
  sellerProtection: string | null;
}

interface SimRefund {
  refundId: string;
  captureId: string;
  amountCents: number;
  currency: string;
  status: string;
}

interface SimStore {
  orders: Map<string, SimOrder>;
  orderByKey: Map<string, string>;
  authorizations: Map<string, SimAuthorization>;
  authorizationByKey: Map<string, string>;
  captures: Map<string, SimCapture>;
  captureByKey: Map<string, string>;
  refunds: Map<string, SimRefund>;
  refundByKey: Map<string, string>;
  voids: Map<string, string>;
  stats: PaypalSimulationStats;
}

const SIM_STORES = new WeakMap<Paypal, SimStore>();

/** Test-only view of how many provider resources the simulated adapter created. */
export function simulationStats(paypal: Paypal): PaypalSimulationStats | null {
  const store = SIM_STORES.get(paypal);
  return store ? { ...store.stats } : null;
}

function newSimStore(): SimStore {
  return {
    orders: new Map(),
    orderByKey: new Map(),
    authorizations: new Map(),
    authorizationByKey: new Map(),
    captures: new Map(),
    captureByKey: new Map(),
    refunds: new Map(),
    refundByKey: new Map(),
    voids: new Map(),
    stats: { ordersCreated: 0, authorizationsCreated: 0, capturesCreated: 0, refundsCreated: 0, voidsCreated: 0 },
  };
}

function simNotFound(kind: string, id: string): PaypalError {
  return new PaypalError({
    name: 'RESOURCE_NOT_FOUND',
    message: `simulated ${kind} not found: ${id}`,
    status: 404,
    debugId: null,
  });
}

function simulatedFailure(action: string): PaypalError {
  // The exact phrase is required by the contract; it is logged and carried in
  // the error message so a human reading the UI knows this is a test hook.
  console.warn(`[paypal] Simulated failure for testing: ${action}`);
  return new PaypalError({
    name: 'SIMULATED_FAILURE',
    message: `Simulated failure for testing (${action})`,
    status: 422,
    debugId: null,
  });
}

function simulatedUnknown(action: string): PaypalError {
  // Outcome unknown: the simulated provider may already have moved the money
  // (or may not have) and the caller must reconcile before retrying.
  console.warn(`[paypal] Simulated failure for testing: ${action} (unknown outcome)`);
  return new PaypalError({
    name: 'SIMULATED_UNKNOWN',
    message: `Simulated failure for testing (${action}); provider outcome unknown`,
    status: 0,
    debugId: null,
  });
}

interface SimHook {
  action: string;
  needle: string;
}

/** Read `PAYPAL_SIM_FAIL` at call time: "CAPTURE:<invoiceId>,REFUND_UNKNOWN:*". */
function readSimHooks(): SimHook[] {
  const raw = process.env.PAYPAL_SIM_FAIL ?? '';
  return raw
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const colon = entry.indexOf(':');
      if (colon < 0) return { action: entry.toUpperCase(), needle: '*' };
      return { action: entry.slice(0, colon).trim().toUpperCase(), needle: entry.slice(colon + 1).trim() };
    });
}

function hasSimHook(actions: string[], needle: string): boolean {
  const hooks = readSimHooks();
  return hooks.some((hook) => actions.includes(hook.action) && (hook.needle === '*' || hook.needle === needle));
}

function createSimulatedPaypal(cfg: AppConfig): Paypal {
  const store = newSimStore();

  const orderSnapshot = (order: SimOrder): OrderSnapshot => ({
    orderId: order.orderId,
    status: order.status,
    amountCents: order.amountCents,
    currency: order.currency,
    approveUrl: order.approveUrl,
    payerId: order.payerId,
  });

  const authorizationSnapshot = (auth: SimAuthorization): AuthSnapshot => ({
    authorizationId: auth.authorizationId,
    status: auth.status,
    amountCents: auth.amountCents,
    currency: auth.currency,
    createTime: auth.createTime,
    expirationTime: auth.expirationTime,
    orderId: auth.orderId,
  });

  const captureSnapshot = (capture: SimCapture): CaptureSnapshot => ({
    captureId: capture.captureId,
    status: capture.status,
    amountCents: capture.amountCents,
    currency: capture.currency,
    refundedCents: capture.refundedCents,
    sellerProtection: capture.sellerProtection,
  });

  const refundSnapshot = (refund: SimRefund): RefundSnapshot => ({
    refundId: refund.refundId,
    status: refund.status,
    amountCents: refund.amountCents,
    currency: refund.currency,
  });

  const adapter: Paypal = {
    mode: 'simulated',
    enabled: false,

    async createAuthorizeOrder(input, idempotencyKey) {
      assertPositiveCents(input.amountCents);
      assertUsd(input.currency);
      const existingId = store.orderByKey.get(idempotencyKey);
      if (existingId) {
        const existing = store.orders.get(existingId);
        if (existing) return orderSnapshot(existing); // idempotent replay
      }
      if (hasSimHook(['ORDER', 'CREATE_ORDER_FAIL'], input.invoiceId)) throw simulatedFailure('CREATE_ORDER');
      const orderId = `SIM-ORDER-${sha256(idempotencyKey).slice(0, 18).toUpperCase()}`;
      const order: SimOrder = {
        orderId,
        amountCents: input.amountCents,
        currency: input.currency,
        status: 'CREATED',
        approveUrl: `${cfg.publicBaseUrl}/return?token=${encodeURIComponent(orderId)}`,
        payerId: null,
        authorizationId: null,
      };
      store.orders.set(orderId, order);
      store.orderByKey.set(idempotencyKey, orderId);
      store.stats.ordersCreated += 1;
      return orderSnapshot(order);
    },

    async getOrder(orderId) {
      const order = store.orders.get(orderId);
      if (!order) throw simNotFound('order', orderId);
      // A simulated buyer has no browser: asking for the order is the approval
      // step, exactly like returning from PayPal after the buyer clicks Approve.
      if (order.status === 'CREATED') order.status = 'APPROVED';
      return orderSnapshot(order);
    },

    async authorizeOrder(orderId, idempotencyKey) {
      const order = store.orders.get(orderId);
      if (!order) throw simNotFound('order', orderId);
      const replayId = store.authorizationByKey.get(idempotencyKey);
      if (replayId) {
        const replay = store.authorizations.get(replayId);
        if (replay) {
          order.status = 'COMPLETED';
          return authorizationSnapshot(replay);
        }
      }
      if (hasSimHook(['AUTHORIZE', 'AUTHORIZE_FAIL'], orderId)) throw simulatedFailure('AUTHORIZE');
      if (order.status !== 'APPROVED' && order.status !== 'CREATED') {
        throw new PaypalError({
          name: 'ORDER_NOT_APPROVABLE',
          message: `simulated order is ${order.status}, not approvable`,
          status: 422,
          debugId: null,
        });
      }
      const authorizationId = `SIM-AUTH-${sha256(idempotencyKey).slice(0, 18).toUpperCase()}`;
      const auth: SimAuthorization = {
        authorizationId,
        orderId,
        amountCents: order.amountCents,
        currency: order.currency,
        status: 'AUTHORIZED',
        createTime: isoTimestamp(),
        expirationTime: isoPlusDays(29),
      };
      store.authorizations.set(authorizationId, auth);
      store.authorizationByKey.set(idempotencyKey, authorizationId);
      order.authorizationId = authorizationId;
      order.payerId = `SIM-PAYER-${sha256(orderId).slice(0, 12).toUpperCase()}`;
      order.status = 'COMPLETED';
      store.stats.authorizationsCreated += 1;
      return authorizationSnapshot(auth);
    },

    async getAuthorization(authorizationId) {
      const auth = store.authorizations.get(authorizationId);
      if (!auth) throw simNotFound('authorization', authorizationId);
      return authorizationSnapshot(auth);
    },

    async captureAuthorization(input, idempotencyKey) {
      assertPositiveCents(input.amountCents);
      assertUsd(input.currency);
      const auth = store.authorizations.get(input.authorizationId);
      if (!auth) throw simNotFound('authorization', input.authorizationId);
      const replayId = store.captureByKey.get(idempotencyKey);
      if (replayId) {
        const replay = store.captures.get(replayId);
        if (replay) return captureSnapshot(replay); // idempotent replay: never a second charge
      }
      if (hasSimHook(['CAPTURE_FAIL', 'CAPTURE'], input.invoiceId)) throw simulatedFailure('CAPTURE');
      if (auth.status === 'CAPTURED') {
        throw new PaypalError({
          name: 'AUTHORIZATION_ALREADY_CAPTURED',
          message: 'the authorization has already been captured with another request',
          status: 422,
          debugId: null,
        });
      }
      if (auth.status !== 'AUTHORIZED') {
        throw new PaypalError({
          name: 'AUTHORIZATION_NOT_CAPTURABLE',
          message: `authorization is ${auth.status}, not capturable`,
          status: 422,
          debugId: null,
        });
      }
      if (input.amountCents !== auth.amountCents || input.currency !== auth.currency) {
        throw new PaypalError({
          name: 'AMOUNT_MISMATCH',
          message: 'capture amount/currency does not match the authorization',
          status: 422,
          debugId: null,
        });
      }
      const pending = hasSimHook(['CAPTURE_PENDING'], input.invoiceId);
      const ambiguous =
        hasSimHook(['CAPTURE_AMBIGUOUS', 'CAPTURE_TIMEOUT', 'CAPTURE_UNKNOWN'], input.invoiceId);
      const captureId = `SIM-CAPTURE-${sha256(idempotencyKey).slice(0, 18).toUpperCase()}`;
      const capture: SimCapture = {
        captureId,
        authorizationId: auth.authorizationId,
        amountCents: auth.amountCents,
        currency: auth.currency,
        status: pending ? 'PENDING' : 'COMPLETED',
        refundedCents: 0,
        sellerProtection: 'ELIGIBLE',
      };
      store.captures.set(captureId, capture);
      store.captureByKey.set(idempotencyKey, captureId);
      store.stats.capturesCreated += 1;
      if (!pending) auth.status = 'CAPTURED';
      if (ambiguous) throw simulatedUnknown('CAPTURE');
      return captureSnapshot(capture);
    },

    async getCapture(captureId) {
      const capture = store.captures.get(captureId);
      if (!capture) throw simNotFound('capture', captureId);
      return captureSnapshot(capture);
    },

    async voidAuthorization(authorizationId, idempotencyKey) {
      const replay = store.voids.get(idempotencyKey);
      if (replay) return { status: replay };
      if (hasSimHook(['VOID_FAIL', 'VOID'], authorizationId)) throw simulatedFailure('VOID');
      const auth = store.authorizations.get(authorizationId);
      if (!auth) throw simNotFound('authorization', authorizationId);
      if (auth.status === 'CAPTURED') {
        throw new PaypalError({
          name: 'AUTHORIZATION_ALREADY_CAPTURED',
          message: 'the authorization was captured; it cannot be voided',
          status: 422,
          debugId: null,
        });
      }
      auth.status = 'VOIDED';
      store.voids.set(idempotencyKey, 'VOIDED');
      store.stats.voidsCreated += 1;
      return { status: 'VOIDED' };
    },

    async refundCapture(input, idempotencyKey) {
      assertPositiveCents(input.amountCents);
      assertUsd(input.currency);
      const replayId = store.refundByKey.get(idempotencyKey);
      if (replayId) {
        const replay = store.refunds.get(replayId);
        if (replay) return refundSnapshot(replay); // idempotent replay
      }
      if (hasSimHook(['REFUND_FAIL', 'REFUND'], input.captureId)) throw simulatedFailure('REFUND');
      const capture = store.captures.get(input.captureId);
      if (!capture) throw simNotFound('capture', input.captureId);
      if (capture.status !== 'COMPLETED') {
        throw new PaypalError({
          name: 'CAPTURE_NOT_REFUNDABLE',
          message: `capture is ${capture.status}, not refundable`,
          status: 422,
          debugId: null,
        });
      }
      if (input.amountCents !== capture.amountCents || input.currency !== capture.currency) {
        throw new PaypalError({
          name: 'REFUND_AMOUNT_MISMATCH',
          message: 'refund amount/currency does not match the capture',
          status: 422,
          debugId: null,
        });
      }
      if (hasSimHook(['REFUND_UNKNOWN', 'REFUND_TIMEOUT', 'REFUND_UNKNOWN_OUTCOME'], input.captureId)) {
        // Never recorded: the money may or may not have been refunded. The
        // caller must reconcile and must not mark REFUNDED.
        throw simulatedUnknown('REFUND');
      }
      const refundId = `SIM-REFUND-${sha256(idempotencyKey).slice(0, 18).toUpperCase()}`;
      const refund: SimRefund = {
        refundId,
        captureId: capture.captureId,
        amountCents: capture.amountCents,
        currency: capture.currency,
        status: 'COMPLETED',
      };
      store.refunds.set(refundId, refund);
      store.refundByKey.set(idempotencyKey, refundId);
      capture.status = 'REFUNDED';
      capture.refundedCents += capture.amountCents;
      store.stats.refundsCreated += 1;
      return refundSnapshot(refund);
    },

    async getRefund(refundId) {
      const refund = store.refunds.get(refundId);
      if (!refund) throw simNotFound('refund', refundId);
      return refundSnapshot(refund);
    },

    async verifyWebhook(headers, rawBody) {
      const provided = headerValue(headers, 'x-gatherready-sim-signature');
      if (!provided) return { verified: false, reason: 'missing simulated signature header' };
      const expected = simWebhookSignature(rawBody);
      if (!safeEqualHex(provided, expected)) return { verified: false, reason: 'invalid simulated signature' };
      const parsed = parseWebhookBody(rawBody);
      if (!parsed.ok) return { verified: false, reason: parsed.reason };
      return parsed.verdict;
    },
  };

  SIM_STORES.set(adapter, store);
  return adapter;
}

/* --------------------------------- real ---------------------------------- */

interface JsonObject extends Record<string, unknown> {}

function orderSnapshotFrom(data: JsonObject, fallbackOrderId: string): OrderSnapshot {
  const purchaseUnits = Array.isArray(data.purchase_units) ? data.purchase_units : [];
  const unit = asRecord(purchaseUnits[0]);
  let amountCents: number;
  let currency: string;
  try {
    const amount = readAmount(unit.amount);
    amountCents = amount.cents;
    currency = amount.currency;
  } catch {
    const top = readAmount(data.amount);
    amountCents = top.cents;
    currency = top.currency;
  }
  return {
    orderId: asString(data.id) || fallbackOrderId,
    status: asString(data.status) || 'UNKNOWN',
    amountCents,
    currency,
    approveUrl: approveUrlFrom(data),
    payerId: asString(asRecord(data.payer).payer_id) || null,
  };
}

function approveUrlFrom(data: JsonObject): string | null {
  const links = Array.isArray(data.links) ? data.links : [];
  for (const link of links) {
    const record = asRecord(link);
    const rel = asString(record.rel);
    if (rel === 'payer-action' || rel === 'approve') {
      const href = asString(record.href);
      if (href) return href;
    }
  }
  return null;
}

function readAmount(raw: unknown): { cents: number; currency: string } {
  const amount = asRecord(raw);
  const value = asString(amount.value);
  const currency = asString(amount.currency_code);
  if (!value || !currency) {
    throw new PaypalError({
      name: 'INVALID_RESPONSE',
      message: 'PayPal response did not contain an amount',
      status: 500,
      debugId: null,
    });
  }
  return { cents: decimalToCents(value), currency };
}

function relatedOrderId(data: JsonObject): string | null {
  const direct = asString(data.order_id);
  if (direct) return direct;
  const supplementary = asRecord(data.supplementary_data);
  const related = asRecord(supplementary.related_ids);
  return asString(related.order_id) || null;
}

function authorizationSnapshotFrom(data: JsonObject, fallbackOrderId: string | null): AuthSnapshot {
  const purchaseUnits = Array.isArray(data.purchase_units) ? data.purchase_units : [];
  const unit = asRecord(purchaseUnits[0]);
  const payments = asRecord(unit.payments);
  const nested = Array.isArray(payments.authorizations) ? asRecord(payments.authorizations[0]) : {};
  let amount: { cents: number; currency: string };
  try {
    amount = readAmount(data.amount);
  } catch {
    try {
      amount = readAmount(nested.amount);
    } catch {
      amount = readAmount(unit.amount);
    }
  }
  // Orders authorize responses wrap authorization under purchase_units.
  // The top-level id/status belong to the order, not the authorization.
  const authorizationId = asString(nested.id) || asString(data.id);
  if (!authorizationId) {
    throw new PaypalError({
      name: 'INVALID_RESPONSE',
      message: 'PayPal authorization response did not contain an id',
      status: 500,
      debugId: null,
    });
  }
  // PayPal authorization CREATED means a valid uncaptured authorization.
  // Normalize only this authorization resource state, never an order CREATED.
  const providerStatus = asString(nested.status) || asString(data.status) || 'UNKNOWN';
  return {
    authorizationId,
    status: providerStatus === 'CREATED' ? 'AUTHORIZED' : providerStatus,
    amountCents: amount.cents,
    currency: amount.currency,
    createTime: asString(nested.create_time) || asString(data.create_time) || null,
    expirationTime: asString(nested.expiration_time) || asString(data.expiration_time) || null,
    orderId: fallbackOrderId ?? relatedOrderId(data),
  };
}

function captureSnapshotFrom(data: JsonObject): CaptureSnapshot {
  const captureId = asString(data.id);
  if (!captureId) {
    throw new PaypalError({
      name: 'INVALID_RESPONSE',
      message: 'PayPal capture response did not contain an id',
      status: 500,
      debugId: null,
    });
  }
  const amount = readAmount(data.amount);
  const breakdown = asRecord(data.seller_receivable_breakdown);
  let refundedCents = 0;
  try {
    refundedCents = readAmount(breakdown.refunded_amount).cents;
  } catch {
    refundedCents = asString(data.status) === 'REFUNDED' ? amount.cents : 0;
  }
  return {
    captureId,
    status: asString(data.status) || 'UNKNOWN',
    amountCents: amount.cents,
    currency: amount.currency,
    refundedCents,
    sellerProtection: asString(asRecord(data.seller_protection).status) || null,
  };
}

function refundSnapshotFrom(data: JsonObject): RefundSnapshot {
  const refundId = asString(data.id);
  if (!refundId) {
    throw new PaypalError({
      name: 'INVALID_RESPONSE',
      message: 'PayPal refund response did not contain an id',
      status: 500,
      debugId: null,
    });
  }
  const amount = readAmount(data.amount);
  return { refundId, status: asString(data.status) || 'UNKNOWN', amountCents: amount.cents, currency: amount.currency };
}

function headerValue(headers: Record<string, string | string[] | undefined>, name: string): string | null {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lower) continue;
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }
  return null;
}

function parseWebhookBody(rawBody: string): { ok: true; verdict: Extract<WebhookVerdict, { verified: true }> } | { ok: false; reason: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { ok: false, reason: 'body is not valid JSON' };
  }
  const event = asRecord(parsed);
  const eventId = asString(event.id);
  const eventType = asString(event.event_type);
  if (!eventId) return { ok: false, reason: 'webhook event has no id' };
  if (!eventType) return { ok: false, reason: 'webhook event has no event_type' };
  return {
    ok: true,
    verdict: {
      verified: true,
      eventId,
      eventType,
      resourceType: asString(event.resource_type) || null,
      resource: asRecord(event.resource),
    },
  };
}

function createSandboxPaypal(cfg: AppConfig): Paypal {
  const base = cfg.paypal.baseUrl.replace(/\/+$/, '');
  let tokenCache: { value: string; expiresAtMs: number } | null = null;

  async function parseErrorResponse(res: Response): Promise<PaypalError> {
    let raw: unknown = null;
    try {
      raw = await res.json();
    } catch {
      /* non-JSON error body: never surface it */
    }
    const body = asRecord(raw);
    const details = Array.isArray(body.details) ? body.details : undefined;
    return new PaypalError({
      name: asString(body.name) || `HTTP_${res.status}`,
      message: redact(asString(body.message) || res.statusText || 'PayPal request failed'),
      status: res.status,
      debugId: asString(body.debug_id) || null,
      ...(details ? { details } : {}),
    });
  }

  function networkError(err: unknown): PaypalError {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return new PaypalError({
      name: timedOut ? 'NETWORK_TIMEOUT' : 'NETWORK_ERROR',
      message: timedOut
        ? 'PayPal request timed out; the outcome is unknown'
        : 'could not reach PayPal; the outcome is unknown',
      status: 0,
      debugId: null,
      details: { kind: timedOut ? 'timeout' : 'network' },
    });
  }

  async function issueToken(): Promise<string> {
    const nowMs = Date.now();
    if (tokenCache && nowMs < tokenCache.expiresAtMs - TOKEN_EARLY_REFRESH_MS) return tokenCache.value;
    const basic = Buffer.from(`${cfg.paypal.clientId}:${cfg.paypal.clientSecret}`, 'utf8').toString('base64');
    let res: Response;
    try {
      res = await fetch(`${base}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(PAYPAL_TIMEOUT_MS),
      });
    } catch (err) {
      throw networkError(err);
    }
    if (!res.ok) throw await parseErrorResponse(res);
    let data: JsonObject;
    try {
      data = asRecord(await res.json());
    } catch {
      throw new PaypalError({ name: 'OAUTH_FAILED', message: 'PayPal token response was not JSON', status: 500, debugId: null });
    }
    const token = asString(data.access_token);
    const expiresIn = asNumber(data.expires_in);
    if (!token || expiresIn <= 0) {
      throw new PaypalError({ name: 'OAUTH_FAILED', message: 'PayPal did not return an access token', status: 500, debugId: null });
    }
    tokenCache = { value: token, expiresAtMs: nowMs + expiresIn * 1000 };
    return token;
  }

  async function api(
    method: 'GET' | 'POST',
    path: string,
    options: { body?: unknown; requestId?: string } = {},
  ): Promise<JsonObject> {
    const token = await issueToken();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.requestId) headers['PayPal-Request-Id'] = options.requestId;
    // Orders default to minimal responses; parsers need provider-confirmed amounts.
    if (method === 'POST') headers.Prefer = 'return=representation';
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(PAYPAL_TIMEOUT_MS),
      });
    } catch (err) {
      throw networkError(err);
    }
    if (!res.ok) throw await parseErrorResponse(res);
    if (res.status === 204) return {};
    const text = await res.text();
    if (!text) return {};
    try {
      return asRecord(JSON.parse(text));
    } catch {
      throw new PaypalError({
        name: 'INVALID_RESPONSE',
        message: 'PayPal returned a response that was not valid JSON',
        status: 502,
        debugId: null,
      });
    }
  }

  return {
    mode: 'sandbox',
    enabled: true,

    async createAuthorizeOrder(input, idempotencyKey) {
      assertPositiveCents(input.amountCents);
      assertUsd(input.currency);
      const data = await api('POST', '/v2/checkout/orders', {
        requestId: idempotencyKey,
        body: {
          intent: 'AUTHORIZE',
          purchase_units: [
            {
              amount: { currency_code: input.currency, value: centsToDecimal(input.amountCents) },
              description: input.description,
              custom_id: input.customId,
              invoice_id: input.invoiceId,
            },
          ],
          application_context: {
            brand_name: 'GatherReady',
            user_action: 'CONTINUE',
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
          },
        },
      });
      return orderSnapshotFrom(data, asString(data.id));
    },

    async getOrder(orderId) {
      const data = await api('GET', `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
      return orderSnapshotFrom(data, orderId);
    },

    async authorizeOrder(orderId, idempotencyKey) {
      const data = await api('POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, {
        requestId: idempotencyKey,
        body: {},
      });
      return authorizationSnapshotFrom(data, orderId);
    },

    async getAuthorization(authorizationId) {
      const data = await api('GET', `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}`);
      return authorizationSnapshotFrom(data, null);
    },

    async captureAuthorization(input, idempotencyKey) {
      assertPositiveCents(input.amountCents);
      assertUsd(input.currency);
      const data = await api(
        'POST',
        `/v2/payments/authorizations/${encodeURIComponent(input.authorizationId)}/capture`,
        {
          requestId: idempotencyKey,
          body: {
            amount: { currency_code: input.currency, value: centsToDecimal(input.amountCents) },
            invoice_id: input.invoiceId,
            final_capture: input.finalCapture,
          },
        },
      );
      return captureSnapshotFrom(data);
    },

    async getCapture(captureId) {
      const data = await api('GET', `/v2/payments/captures/${encodeURIComponent(captureId)}`);
      return captureSnapshotFrom(data);
    },

    async voidAuthorization(authorizationId, idempotencyKey) {
      const data = await api(
        'POST',
        `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`,
        { requestId: idempotencyKey, body: {} },
      );
      return { status: asString(data.status) || 'VOIDED' };
    },

    async refundCapture(input, idempotencyKey) {
      assertPositiveCents(input.amountCents);
      assertUsd(input.currency);
      const data = await api('POST', `/v2/payments/captures/${encodeURIComponent(input.captureId)}/refund`, {
        requestId: idempotencyKey,
        body: { amount: { currency_code: input.currency, value: centsToDecimal(input.amountCents) } },
      });
      return refundSnapshotFrom(data);
    },

    async getRefund(refundId) {
      const data = await api('GET', `/v2/payments/refunds/${encodeURIComponent(refundId)}`);
      return refundSnapshotFrom(data);
    },

    async verifyWebhook(headers, rawBody) {
      const parsed = parseWebhookBody(rawBody);
      if (!parsed.ok) return { verified: false, reason: parsed.reason };
      const transmissionId = headerValue(headers, 'paypal-transmission-id');
      const transmissionTime = headerValue(headers, 'paypal-transmission-time');
      const certUrl = headerValue(headers, 'paypal-cert-url');
      const authAlgo = headerValue(headers, 'paypal-auth-algo');
      const transmissionSig = headerValue(headers, 'paypal-transmission-sig');
      const missing = [
        ['paypal-transmission-id', transmissionId],
        ['paypal-transmission-time', transmissionTime],
        ['paypal-cert-url', certUrl],
        ['paypal-auth-algo', authAlgo],
        ['paypal-transmission-sig', transmissionSig],
      ]
        .filter(([, value]) => !value)
        .map(([name]) => name);
      if (missing.length > 0) return { verified: false, reason: `missing signature headers: ${missing.join(', ')}` };
      if (!cfg.paypal.webhookId) {
        return { verified: false, reason: 'PAYPAL_WEBHOOK_ID is not configured, so no event can be verified' };
      }
      let verification: JsonObject;
      try {
        verification = await api('POST', '/v1/notifications/verify-webhook-signature', {
          requestId: `verify-webhook:${parsed.verdict.eventId}`,
          body: {
            auth_algo: authAlgo,
            cert_url: certUrl,
            transmission_id: transmissionId,
            transmission_sig: transmissionSig,
            transmission_time: transmissionTime,
            webhook_id: cfg.paypal.webhookId,
            webhook_event: JSON.parse(rawBody) as unknown,
          },
        });
      } catch (err) {
        if (isUnknownPaypalOutcome(err)) {
          return { verified: false, reason: 'verification service unavailable; event not trusted' };
        }
        return { verified: false, reason: 'PayPal rejected the signature verification request' };
      }
      if (asString(verification.verification_status) !== 'SUCCESS') {
        return { verified: false, reason: 'PayPal did not verify this webhook signature' };
      }
      return parsed.verdict;
    },
  };
}

/* ------------------------------- factory --------------------------------- */

export function createPaypal(cfg: AppConfig): Paypal {
  if (cfg.paypal.live) {
    // Fail closed: never talk to a non-sandbox host, even if a caller forgot boot checks.
    assertSandbox(cfg);
    if (!cfg.paypal.clientId || !cfg.paypal.clientSecret) {
      // Config said live but the credentials are gone. Refuse rather than silently
      // downgrade: mode must be decided in exactly one place (`config.ts`).
      throw new Error('paypal: live mode requested without client credentials');
    }
    return createSandboxPaypal(cfg);
  }
  return createSimulatedPaypal(cfg);
}
