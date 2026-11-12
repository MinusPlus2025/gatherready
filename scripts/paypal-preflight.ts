/**
 * PayPal sandbox readiness check + webhook registration.
 *
 * Run this the moment sandbox credentials exist, before the interactive spine:
 *
 *   node scripts/setup-access.mjs        # write client id/secret into secrets/access.json
 *   npx tsx scripts/paypal-preflight.ts  # OAuth + create order + query + register webhook
 *   npx tsx scripts/sandbox-spine.ts     # interactive authorize/capture/void/refund
 *
 * What it proves: OAuth works, Orders v2 create/query work against the sandbox, and the
 * webhook endpoint is registered with PayPal (printing the id to put in secrets/config).
 * What it does NOT prove: buyer approval, authorization, capture, void or refund — those
 * need the interactive spine because a human must approve the order in PayPal's UI.
 *
 * Sandbox only. The process refuses a non-sandbox base URL.
 */
import { loadConfig, assertSandbox } from '../src/server/config.js';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const cfg = loadConfig();
const amountCents = 4500;
const currency = 'USD';

interface PaypalOrder {
  id: string;
  status: string;
  links?: Array<{ href: string; rel: string }>;
}

function fail(message: string): never {
  console.error(`\nPAYPAL PREFLIGHT FAILED: ${message}`);
  process.exit(1);
}

if (!cfg.paypal.live) {
  console.log('BLOCKED: no PayPal sandbox credentials found.');
  console.log(`  secrets file: ${cfg.secretsPath}`);
  console.log('  1) run: node scripts/setup-access.mjs');
  console.log('  2) re-run: npx tsx scripts/paypal-preflight.ts');
  console.log('Nothing is claimed as verified. The app currently uses the labelled simulated adapter.');
  process.exit(2);
}
assertSandbox(cfg);
if (!/sandbox/i.test(cfg.paypal.baseUrl)) fail(`refusing non-sandbox host: ${cfg.paypal.baseUrl}`);

async function main(): Promise<void> {
  const base = cfg.paypal.baseUrl.replace(/\/+$/, '');
  console.log(`PayPal sandbox: ${base}`);
  console.log(`Client id: ${cfg.paypal.clientId.slice(0, 6)}… (never printed in full)`);

  /* 1. OAuth */
  const auth = Buffer.from(`${cfg.paypal.clientId}:${cfg.paypal.clientSecret}`).toString('base64');
  const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { authorization: `Basic ${auth}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    fail(`OAuth failed (${tokenRes.status}): ${body.slice(0, 400)}`);
  }
  const tokenBody = (await tokenRes.json()) as { access_token: string; expires_in: number };
  if (!tokenBody.access_token) fail('OAuth returned no access_token');
  console.log(`OK  OAuth token acquired (expires in ${tokenBody.expires_in}s)`);
  const api = async (method: string, route: string, body?: unknown): Promise<Response> =>
    fetch(`${base}${route}`, {
      method,
      headers: {
        authorization: `Bearer ${tokenBody.access_token}`,
        'content-type': 'application/json',
        ...(method === 'POST' ? { 'PayPal-Request-Id': `gr-preflight-${Date.now()}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  /* 2. Create an AUTHORIZE order (no money moves) */
  const orderRes = await api('POST', '/v2/checkout/orders', {
    intent: 'AUTHORIZE',
    purchase_units: [
      {
        reference_id: 'gatherready-preflight',
        description: 'GatherReady sandbox preflight (never approved, never charged)',
        amount: { currency_code: currency, value: (amountCents / 100).toFixed(2) },
        custom_id: `preflight-${Date.now()}`,
      },
    ],
    application_context: {
      brand_name: 'GatherReady sandbox preflight',
      user_action: 'CONTINUE',
      return_url: `${cfg.publicBaseUrl}/return`,
      cancel_url: `${cfg.publicBaseUrl}/cancel`,
    },
  });
  const orderText = await orderRes.text();
  if (!orderRes.ok) fail(`order create failed (${orderRes.status}): ${orderText.slice(0, 500)}`);
  const order = JSON.parse(orderText) as PaypalOrder;
  console.log(`OK  order created (intent=AUTHORIZE): ${order.id} status=${order.status}`);

  /* 3. Query it back */
  const readRes = await api('GET', `/v2/checkout/orders/${order.id}`);
  if (!readRes.ok) fail(`order query failed (${readRes.status}): ${(await readRes.text()).slice(0, 400)}`);
  const read = (await readRes.json()) as PaypalOrder;
  console.log(`OK  order queried: ${read.id} status=${read.status}`);
  const approve = read.links?.find((l) => l.rel === 'approve')?.href;
  if (approve) console.log(`    approval link (do not open for this order): ${approve.slice(0, 80)}…`);

  /* 4. Register the webhook (idempotent by URL lookup first) */
  const url = `${cfg.publicBaseUrl}/api/paypal/webhook`;
  if (!/^https:\/\//.test(url)) {
    console.log('SKIP webhook registration: PUBLIC_BASE_URL is not HTTPS. OAuth and order creation/query above are independent of webhook delivery.');
    console.log('Public webhook verification is still pending; no callback or webhook success is claimed.');
    return;
  }
  const listRes = await api('GET', '/v1/notifications/webhooks');
  if (listRes.ok) {
    const listed = (await listRes.json()) as { webhooks?: Array<{ id: string; url: string }> };
    const existing = listed.webhooks?.find((w) => w.url === url);
    if (existing) {
      console.log(`OK  webhook already registered: ${existing.id} -> ${url}`);
      await persistWebhookId(existing.id);
      return;
    }
  }
  const eventTypes = [
    'CHECKOUT.ORDER.APPROVED',
    'PAYMENT.AUTHORIZATION.CREATED',
    'PAYMENT.AUTHORIZATION.VOIDED',
    'PAYMENT.CAPTURE.COMPLETED',
    'PAYMENT.CAPTURE.DENIED',
    'PAYMENT.CAPTURE.REFUNDED',
  ].map((name) => ({ name }));
  const createRes = await api('POST', '/v1/notifications/webhooks', { url, event_types: eventTypes });
  const createText = await createRes.text();
  if (!createRes.ok) {
    console.log(`WARN webhook registration failed (${createRes.status}): ${createText.slice(0, 400)}`);
    console.log('     Register it manually in Dashboard -> Apps & Credentials -> Webhooks, then set PAYPAL_WEBHOOK_ID.');
    return;
  }
  const created = JSON.parse(createText) as { id: string };
  console.log(`OK  webhook registered: ${created.id} -> ${url}`);
  await persistWebhookId(created.id);
}

async function persistWebhookId(webhookId: string): Promise<void> {
  const file = cfg.secretsPath;
  if (!existsSync(file)) {
    console.log(`     set PAYPAL_WEBHOOK_ID=${webhookId} in your environment (no secrets file found).`);
    return;
  }
  try {
    const current = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    const paypal = (current.paypal ?? {}) as Record<string, unknown>;
    paypal.webhookId = webhookId;
    current.paypal = paypal;
    writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`, { mode: 0o600 });
    console.log(`     wrote paypal.webhookId into ${path.relative(process.cwd(), file)} (git-ignored, 0600)`);
  } catch (err) {
    console.log(`     could not update secrets file: ${err instanceof Error ? err.message : String(err)}`);
    console.log(`     set PAYPAL_WEBHOOK_ID=${webhookId} manually.`);
  }
}

main().catch((err) => {
  console.error(`\nPAYPAL PREFLIGHT FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
