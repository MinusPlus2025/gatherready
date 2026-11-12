import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  centsToDecimal,
  createPaypal,
  decimalToCents,
  isPaypalError,
  isUnknownPaypalOutcome,
  PaypalError,
  simWebhookSignature,
  simulationStats,
} from '../../src/server/payments/paypal.js';
import { clearSimFail, setSimFail, testConfig } from './helpers.js';

/* ==========================================================================
   Adapter-level tests. All of this runs against the labelled `simulated`
   adapter: there are no PayPal sandbox credentials on this machine, so the real
   sandbox REST path is NOT verified by these tests (see the report / INDEX).
   ========================================================================== */

function simulated() {
  return createPaypal(testConfig());
}

const ORDER_INPUT = {
  amountCents: 4500,
  currency: 'USD',
  description: 'Two-hour pottery workshop',
  customId: 'pay_1',
  invoiceId: 'pay_1',
  returnUrl: 'http://127.0.0.1:5180/return',
  cancelUrl: 'http://127.0.0.1:5180/cancel',
};

async function authorizedCapture(paypal: ReturnType<typeof simulated>, paymentId = 'pay_1') {
  const order = await paypal.createAuthorizeOrder(ORDER_INPUT, `create-order:off_1:${paymentId}`);
  await paypal.getOrder(order.orderId); // simulated buyer approval
  const auth = await paypal.authorizeOrder(order.orderId, `authorize:${order.orderId}`);
  return { order, auth, captureKey: `capture:${paymentId}` };
}

afterEach(() => {
  clearSimFail();
  vi.unstubAllGlobals();
});

/* --------------------------- mocked real HTTP ---------------------------- */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

interface FetchCall {
  url: string;
  init: RequestInit;
}

function realPaypalForTest() {
  const base = testConfig();
  const cfg = testConfig({
    paypal: {
      ...base.paypal,
      environment: 'sandbox',
      live: true,
      clientId: 'client-id-for-test',
      clientSecret: 'client-secret-for-test',
      webhookId: 'WH-CONFIG-1',
    },
  });
  const calls: FetchCall[] = [];
  const paypal = createPaypal(cfg);
  const stub = (handler: (call: FetchCall) => Response | Promise<Response>) => {
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const call: FetchCall = { url: String(input), init: init ?? {} };
      calls.push(call);
      return handler(call);
    });
  };
  return { paypal, calls, stub, cfg };
}

const CAPTURE_INPUT = {
  authorizationId: 'AUTH-1',
  amountCents: 4500,
  currency: 'USD',
  finalCapture: true as const,
  invoiceId: 'pay_1',
};

describe('money conversion', () => {
  it('converts integer cents to PayPal decimal strings exactly', () => {
    expect(centsToDecimal(4500)).toBe('45.00');
    expect(centsToDecimal(1)).toBe('0.01');
    expect(centsToDecimal(0)).toBe('0.00');
    expect(centsToDecimal(123456789)).toBe('1234567.89');
  });

  it('parses PayPal decimal strings back to integer cents without floats', () => {
    expect(decimalToCents('45.00')).toBe(4500);
    expect(decimalToCents('45')).toBe(4500);
    expect(decimalToCents('0.01')).toBe(1);
    expect(decimalToCents('1234567.89')).toBe(123456789);
    expect(() => decimalToCents('45.001')).toThrow(PaypalError);
    expect(() => decimalToCents('-1.00')).toThrow(PaypalError);
    expect(() => decimalToCents('1e3')).toThrow(PaypalError);
  });

  it('rejects non-integer / negative cent amounts before any provider call', () => {
    expect(() => centsToDecimal(45.5)).toThrow(PaypalError);
    expect(() => centsToDecimal(-1)).toThrow(PaypalError);
  });
});

describe('simulated adapter happy path', () => {
  it('is clearly labelled and has no real-money mode', () => {
    const paypal = simulated();
    expect(paypal.mode).toBe('simulated');
    expect(paypal.enabled).toBe(false);
  });

  it('creates deterministic SIM- ids keyed to the idempotency key', async () => {
    const paypal = simulated();
    const first = await paypal.createAuthorizeOrder(ORDER_INPUT, 'create-order:off_1:pay_1');
    const replay = await paypal.createAuthorizeOrder(ORDER_INPUT, 'create-order:off_1:pay_1');
    expect(first.orderId).toMatch(/^SIM-ORDER-[A-F0-9]{18}$/);
    expect(replay.orderId).toBe(first.orderId);
    expect(first.amountCents).toBe(4500);
    expect(first.currency).toBe('USD');
    expect(first.status).toBe('CREATED');
    expect(first.approveUrl).toContain('/return?token=');
  });

  it('walks CREATED -> APPROVED -> AUTHORIZED -> COMPLETED and can be read back', async () => {
    const paypal = simulated();
    const order = await paypal.createAuthorizeOrder(ORDER_INPUT, 'create-order:off_1:pay_1');
    const approved = await paypal.getOrder(order.orderId);
    expect(approved.status).toBe('APPROVED');
    const auth = await paypal.authorizeOrder(order.orderId, `authorize:${order.orderId}`);
    const completed = await paypal.getOrder(order.orderId);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.payerId).toMatch(/^SIM-PAYER-/);
    expect(auth.authorizationId).toMatch(/^SIM-AUTH-/);
    expect(auth.status).toBe('AUTHORIZED');
    expect(auth.amountCents).toBe(4500);
    expect(auth.orderId).toBe(order.orderId);
    expect(auth.expirationTime).not.toBeNull();

    const capture = await paypal.captureAuthorization(
      { authorizationId: auth.authorizationId, amountCents: 4500, currency: 'USD', finalCapture: true, invoiceId: 'pay_1' },
      `capture:${auth.authorizationId}`,
    );
    expect(capture.captureId).toMatch(/^SIM-CAPTURE-/);
    expect(capture.status).toBe('COMPLETED');
    expect(capture.amountCents).toBe(4500);
    expect(capture.refundedCents).toBe(0);

    const queried = await paypal.getCapture(capture.captureId);
    expect(queried.status).toBe('COMPLETED');

    const refund = await paypal.refundCapture(
      { captureId: capture.captureId, amountCents: 4500, currency: 'USD' },
      'refund:pay_1',
    );
    expect(refund.refundId).toMatch(/^SIM-REFUND-/);
    expect(refund.status).toBe('COMPLETED');
    expect((await paypal.getRefund(refund.refundId)).status).toBe('COMPLETED');
    expect((await paypal.getAuthorization(auth.authorizationId)).status).toBe('CAPTURED');
  });

  it('replays a capture with the same idempotency key instead of charging twice', async () => {
    const paypal = simulated();
    const { auth, captureKey } = await authorizedCapture(paypal);
    const input = {
      authorizationId: auth.authorizationId,
      amountCents: 4500,
      currency: 'USD',
      finalCapture: true,
      invoiceId: 'pay_1',
    };
    const first = await paypal.captureAuthorization(input, captureKey);
    const replay = await paypal.captureAuthorization(input, captureKey);
    expect(replay.captureId).toBe(first.captureId);
    expect(simulationStats(paypal)?.capturesCreated).toBe(1);
  });

  it('voids an authorization and refuses to capture after void', async () => {
    const paypal = simulated();
    const { order } = await authorizedCapture(paypal);
    const auth = await paypal.getAuthorization('SIM-AUTH-' + '0'.repeat(18)).catch(() => null);
    expect(auth).toBeNull();
    // Void the real authorization from the helper.
    const validAuth = (await paypal.authorizeOrder(order.orderId, `authorize:${order.orderId}`));
    expect((await paypal.voidAuthorization(validAuth.authorizationId, 'void:key')).status).toBe('VOIDED');
    expect((await paypal.voidAuthorization(validAuth.authorizationId, 'void:key')).status).toBe('VOIDED');
    await expect(
      paypal.captureAuthorization(
        { authorizationId: validAuth.authorizationId, amountCents: 4500, currency: 'USD', finalCapture: true, invoiceId: 'pay_1' },
        'capture:after-void',
      ),
    ).rejects.toMatchObject({ info: { name: 'AUTHORIZATION_NOT_CAPTURABLE', status: 422 } });
  });

  it('rejects non-USD and non-integer amounts on every money path', async () => {
    const paypal = simulated();
    await expect(
      paypal.createAuthorizeOrder({ ...ORDER_INPUT, currency: 'EUR' }, 'create:eur'),
    ).rejects.toMatchObject({ info: { name: 'CURRENCY_NOT_SUPPORTED' } });
    await expect(
      paypal.createAuthorizeOrder({ ...ORDER_INPUT, amountCents: 4500.5 }, 'create:float'),
    ).rejects.toMatchObject({ info: { name: 'INVALID_AMOUNT' } });
  });
});

describe('simulated failure hooks (only place a simulated failure can happen)', () => {
  it('CAPTURE:<invoiceId> fails definitively and moves no money', async () => {
    const paypal = simulated();
    const { auth } = await authorizedCapture(paypal);
    setSimFail('CAPTURE:pay_1');
    const error = await paypal
      .captureAuthorization(
        { authorizationId: auth.authorizationId, amountCents: 4500, currency: 'USD', finalCapture: true, invoiceId: 'pay_1' },
        'capture:pay_1',
      )
      .catch((err: unknown) => err);
    expect(isPaypalError(error)).toBe(true);
    expect((error as PaypalError).info.name).toBe('SIMULATED_FAILURE');
    expect((error as PaypalError).info.status).toBe(422);
    expect((error as PaypalError).info.message).toContain('Simulated failure for testing');
    expect(isUnknownPaypalOutcome(error)).toBe(false);
    expect(simulationStats(paypal)?.capturesCreated).toBe(0);
  });

  it('CAPTURE_AMBIGUOUS records the money move but reports an unknown outcome', async () => {
    const paypal = simulated();
    const { auth } = await authorizedCapture(paypal);
    setSimFail('CAPTURE_AMBIGUOUS:pay_1');
    const input = {
      authorizationId: auth.authorizationId,
      amountCents: 4500,
      currency: 'USD',
      finalCapture: true,
      invoiceId: 'pay_1',
    };
    const error = await paypal.captureAuthorization(input, 'capture:pay_1').catch((err: unknown) => err);
    expect((error as PaypalError).info.name).toBe('SIMULATED_UNKNOWN');
    expect(isUnknownPaypalOutcome(error)).toBe(true);
    expect(simulationStats(paypal)?.capturesCreated).toBe(1); // the money did move

    // Idempotent replay reveals the original capture; it does not charge again.
    const replay = await paypal.captureAuthorization(input, 'capture:pay_1');
    expect(replay.status).toBe('COMPLETED');
    expect(simulationStats(paypal)?.capturesCreated).toBe(1);
  });

  it('REFUND_UNKNOWN never pretends the refund happened', async () => {
    const paypal = simulated();
    const { auth } = await authorizedCapture(paypal);
    const capture = await paypal.captureAuthorization(
      { authorizationId: auth.authorizationId, amountCents: 4500, currency: 'USD', finalCapture: true, invoiceId: 'pay_1' },
      'capture:pay_1',
    );
    setSimFail(`REFUND_UNKNOWN:${capture.captureId}`);
    const error = await paypal
      .refundCapture({ captureId: capture.captureId, amountCents: 4500, currency: 'USD' }, 'refund:pay_1')
      .catch((err: unknown) => err);
    expect((error as PaypalError).info.name).toBe('SIMULATED_UNKNOWN');
    expect(isUnknownPaypalOutcome(error)).toBe(true);
    expect(simulationStats(paypal)?.refundsCreated).toBe(0);
    expect((await paypal.getCapture(capture.captureId)).status).toBe('COMPLETED');
  });

  it('surfaces provider-shaped errors with name/status/debug id for unknown resources', async () => {
    const paypal = simulated();
    const error = await paypal.getCapture('SIM-CAPTURE-DOES-NOT-EXIST').catch((err: unknown) => err);
    expect(isPaypalError(error)).toBe(true);
    const info = (error as PaypalError).info;
    expect(info.name).toBe('RESOURCE_NOT_FOUND');
    expect(info.status).toBe(404);
    expect(info.debugId).toBeNull();
    expect(isUnknownPaypalOutcome(error)).toBe(false); // a definite 404 is not "unknown"
  });

  it('treats local/network failures as unknown, never as success', () => {
    const network = new PaypalError({ name: 'NETWORK_TIMEOUT', message: 'timed out', status: 0, debugId: null });
    expect(isUnknownPaypalOutcome(network)).toBe(true);
    const server = new PaypalError({ name: 'INTERNAL_SERVER_ERROR', message: 'boom', status: 503, debugId: null });
    expect(isUnknownPaypalOutcome(server)).toBe(true);
    expect(isUnknownPaypalOutcome(new Error('random'))).toBe(true);
  });
});

describe('simulated webhook verification', () => {
  const rawBody = JSON.stringify({
    id: 'WH-EVT-1',
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource_type: 'capture',
    resource: { id: 'SIM-CAPTURE-1', status: 'COMPLETED' },
  });

  it('verifies a body carrying the local HMAC signature', async () => {
    const paypal = simulated();
    const verdict = await paypal.verifyWebhook(
      { 'x-gatherready-sim-signature': simWebhookSignature(rawBody) },
      rawBody,
    );
    expect(verdict.verified).toBe(true);
    if (verdict.verified) {
      expect(verdict.eventId).toBe('WH-EVT-1');
      expect(verdict.eventType).toBe('PAYMENT.CAPTURE.COMPLETED');
      expect(verdict.resourceType).toBe('capture');
      expect(verdict.resource.id).toBe('SIM-CAPTURE-1');
    }
  });

  it('rejects a forged, missing, or non-JSON signature', async () => {
    const paypal = simulated();
    expect((await paypal.verifyWebhook({ 'x-gatherready-sim-signature': 'deadbeef' }, rawBody)).verified).toBe(false);
    expect((await paypal.verifyWebhook({}, rawBody)).verified).toBe(false);
    const badJson = '{not json';
    expect(
      (await paypal.verifyWebhook({ 'x-gatherready-sim-signature': simWebhookSignature(badJson) }, badJson)).verified,
    ).toBe(false);
  });
});

describe('real sandbox mode wiring (UNVERIFIED — no credentials on this machine)', () => {
  const base = testConfig();

  it('builds a sandbox adapter when config says live, without touching the network', () => {
    const paypal = createPaypal(
      testConfig({
        paypal: {
          ...base.paypal,
          environment: 'sandbox',
          live: true,
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        },
      }),
    );
    expect(paypal.mode).toBe('sandbox');
    expect(paypal.enabled).toBe(true);
    expect(simulationStats(paypal)).toBeNull();
  });

  it('refuses to point at a non-sandbox PayPal host', () => {
    expect(() =>
      createPaypal(
        testConfig({
          paypal: {
            ...base.paypal,
            environment: 'sandbox',
            live: true,
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            baseUrl: 'https://api-m.paypal.com',
          },
        }),
      ),
    ).toThrow(/sandbox/);
  });
});

describe('real sandbox request construction (mocked fetch, never PayPal itself)', () => {
  it('caches the OAuth token and sends PayPal-Request-Id + exact cents on the order POST', async () => {
    const { paypal, calls, stub } = realPaypalForTest();
    stub((call) => {
      if (call.url.endsWith('/v1/oauth2/token')) {
        return jsonResponse({ access_token: 'sandbox-token', expires_in: 3600 });
      }
      if (call.url.endsWith('/v2/checkout/orders')) {
        return jsonResponse({
          id: 'ORDER-REAL-1',
          status: 'CREATED',
          links: [{ rel: 'payer-action', href: 'https://sandbox.paypal.com/checkoutnow?token=ORDER-REAL-1' }],
          purchase_units: [{ amount: { currency_code: 'USD', value: '45.00' } }],
        });
      }
      throw new Error(`unexpected URL ${call.url}`);
    });
    const order = await paypal.createAuthorizeOrder(ORDER_INPUT, 'create-order:real:1');
    expect(order.orderId).toBe('ORDER-REAL-1');
    expect(order.amountCents).toBe(4500);
    expect(order.currency).toBe('USD');
    expect(order.approveUrl).toContain('sandbox.paypal.com/checkoutnow');

    const tokenCall = calls.find((call) => call.url.endsWith('/v1/oauth2/token'));
    expect(tokenCall?.url).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token');
    const tokenHeaders = tokenCall?.init.headers as Record<string, string>;
    expect(tokenHeaders.Authorization).toMatch(/^Basic /);
    expect(tokenHeaders['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(tokenCall?.init.body).toBe('grant_type=client_credentials');

    const orderCall = calls.find((call) => call.url.endsWith('/v2/checkout/orders'));
    const headers = orderCall?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sandbox-token');
    expect(headers['PayPal-Request-Id']).toBe('create-order:real:1');
    expect(headers.Prefer).toBe('return=representation');
    const body = JSON.parse(String(orderCall?.init.body)) as Record<string, unknown>;
    expect(body.intent).toBe('AUTHORIZE');
    const units = body.purchase_units as Array<Record<string, unknown>>;
    expect(units[0].amount).toEqual({ currency_code: 'USD', value: '45.00' });
    expect(units[0].custom_id).toBe('pay_1');

    // Same adapter, second POST: the cached token is reused, no second OAuth call.
    await paypal.createAuthorizeOrder(ORDER_INPUT, 'create-order:real:2');
    expect(calls.filter((call) => call.url.endsWith('/v1/oauth2/token'))).toHaveLength(1);
  });

  it('uses the exact Orders/Payments v2 endpoints and request bodies', async () => {
    const { paypal, calls, stub } = realPaypalForTest();
    stub((call) => {
      if (call.url.endsWith('/v1/oauth2/token')) return jsonResponse({ access_token: 't', expires_in: 3600 });
      if (call.url.endsWith('/v2/checkout/orders/ORDER-1/authorize')) {
        return jsonResponse({
          id: 'ORDER-1',
          status: 'COMPLETED',
          purchase_units: [{ payments: { authorizations: [{
            id: 'AUTH-1', status: 'CREATED',
            amount: { currency_code: 'USD', value: '45.00' },
            create_time: '2026-11-12T06:00:00Z',
            expiration_time: '2026-12-11T06:00:00Z',
          }] } }],
        });
      }
      if (call.url.includes('/v2/payments/authorizations/AUTH-1/capture')) {
        return jsonResponse({
          id: 'CAPTURE-1',
          status: 'COMPLETED',
          amount: { currency_code: 'USD', value: '45.00' },
          seller_protection: { status: 'ELIGIBLE' },
        });
      }
      if (call.url.includes('/v2/payments/captures/CAPTURE-1/refund')) {
        return jsonResponse({ id: 'REFUND-1', status: 'PENDING', amount: { currency_code: 'USD', value: '45.00' } });
      }
      if (call.url.includes('/v2/payments/refunds/REFUND-1')) {
        return jsonResponse({ id: 'REFUND-1', status: 'COMPLETED', amount: { currency_code: 'USD', value: '45.00' } });
      }
      if (call.url.includes('/v2/payments/authorizations/AUTH-1/void')) return new Response(null, { status: 204 });
      throw new Error(`unexpected URL ${call.url}`);
    });

    const auth = await paypal.authorizeOrder('ORDER-1', 'authorize:ORDER-1');
    expect(auth.authorizationId).toBe('AUTH-1');
    expect(auth.status).toBe('AUTHORIZED'); // provider CREATED is an uncaptured authorization
    expect(auth.orderId).toBe('ORDER-1');
    const capture = await paypal.captureAuthorization(CAPTURE_INPUT, 'capture:pay_1');
    expect(capture.captureId).toBe('CAPTURE-1');
    await paypal.voidAuthorization('AUTH-1', 'void:AUTH-1');
    const refund = await paypal.refundCapture(
      { captureId: 'CAPTURE-1', amountCents: 4500, currency: 'USD' },
      'refund:pay_1',
    );
    expect(refund.status).toBe('PENDING');
    expect((await paypal.getRefund('REFUND-1')).status).toBe('COMPLETED');

    const captureCall = calls.find((call) => call.url.includes('/capture'));
    expect(captureCall?.url).toBe('https://api-m.sandbox.paypal.com/v2/payments/authorizations/AUTH-1/capture');
    expect((captureCall?.init.headers as Record<string, string>)['PayPal-Request-Id']).toBe('capture:pay_1');
    const captureBody = JSON.parse(String(captureCall?.init.body)) as Record<string, unknown>;
    expect(captureBody).toEqual({
      amount: { currency_code: 'USD', value: '45.00' },
      invoice_id: 'pay_1',
      final_capture: true,
    });

    const voidCall = calls.find((call) => call.url.includes('/void'));
    expect(voidCall?.url).toBe('https://api-m.sandbox.paypal.com/v2/payments/authorizations/AUTH-1/void');
    expect((voidCall?.init.headers as Record<string, string>)['PayPal-Request-Id']).toBe('void:AUTH-1');

    const refundCall = calls.find((call) => call.url.includes('/captures/CAPTURE-1/refund'));
    expect(refundCall?.url).toBe('https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE-1/refund');
    expect((refundCall?.init.headers as Record<string, string>)['PayPal-Request-Id']).toBe('refund:pay_1');
  });

  it('maps PayPal errors into PaypalError and redacts emails from the message', async () => {
    const { paypal, stub } = realPaypalForTest();
    stub((call) => {
      if (call.url.endsWith('/v1/oauth2/token')) return jsonResponse({ access_token: 't', expires_in: 3600 });
      return jsonResponse(
        { name: 'INSTRUMENT_DECLINED', message: 'payer@example.com declined the instrument', debug_id: 'dbg_123' },
        422,
      );
    });
    const error = await paypal
      .captureAuthorization(CAPTURE_INPUT, 'capture:pay_1')
      .catch((err: unknown) => err);
    expect(isPaypalError(error)).toBe(true);
    const info = (error as PaypalError).info;
    expect(info.name).toBe('INSTRUMENT_DECLINED');
    expect(info.status).toBe(422);
    expect(info.debugId).toBe('dbg_123');
    expect(info.message).not.toContain('payer@example.com');
    expect(info.message).toContain('[redacted-email]');
    expect(isUnknownPaypalOutcome(error)).toBe(false);
  });

  it('models a timeout as an unknown outcome, never as success', async () => {
    const { paypal, stub } = realPaypalForTest();
    stub(() => {
      throw Object.assign(new Error('aborted'), { name: 'TimeoutError' });
    });
    const error = await paypal.getOrder('ORDER-1').catch((err: unknown) => err);
    expect((error as PaypalError).info.name).toBe('NETWORK_TIMEOUT');
    expect((error as PaypalError).info.status).toBe(0);
    expect(isUnknownPaypalOutcome(error)).toBe(true);
  });

  it('posts the raw body and headers to verify-webhook-signature', async () => {
    const { paypal, calls, stub } = realPaypalForTest();
    stub((call) =>
      call.url.endsWith('/v1/oauth2/token')
        ? jsonResponse({ access_token: 't', expires_in: 3600 })
        : jsonResponse({ verification_status: 'SUCCESS' }),
    );
    const rawBody = JSON.stringify({
      id: 'WH-1',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource_type: 'capture',
      resource: { id: 'CAPTURE-1', status: 'COMPLETED' },
    });
    const verdict = await paypal.verifyWebhook(
      {
        'paypal-transmission-id': 'tid',
        'paypal-transmission-time': '2026-11-12T06:00:00Z',
        'paypal-cert-url': 'https://api.paypal.com/cert.pem',
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-transmission-sig': 'sig',
      },
      rawBody,
    );
    expect(verdict.verified).toBe(true);
    const call = calls.find((entry) => entry.url.endsWith('/v1/notifications/verify-webhook-signature'));
    expect(call?.url).toBe('https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature');
    expect((call?.init.headers as Record<string, string>)['PayPal-Request-Id']).toBe('verify-webhook:WH-1');
    const body = JSON.parse(String(call?.init.body)) as Record<string, unknown>;
    expect(body.webhook_id).toBe('WH-CONFIG-1');
    expect(body.transmission_id).toBe('tid');
    expect((body.webhook_event as Record<string, unknown>).id).toBe('WH-1');
  });

  it('rejects a real webhook when the signature headers are missing', async () => {
    const { paypal, calls, stub } = realPaypalForTest();
    stub(() => jsonResponse({ verification_status: 'SUCCESS' }));
    const verdict = await paypal.verifyWebhook({}, JSON.stringify({ id: 'WH-1', event_type: 'X' }));
    expect(verdict.verified).toBe(false);
    expect(calls).toHaveLength(0); // never called PayPal for an incomplete signature
  });
});
