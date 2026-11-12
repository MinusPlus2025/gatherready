/**
 * Real PayPal Sandbox spine — the evidence path the brief requires.
 *
 * Why this is a separate, interactive script: a real authorization needs a human
 * to approve the order in PayPal's hosted UI. Automation cannot (and should not)
 * approve a PayPal purchase. So this script creates a real sandbox order, opens the
 * approval URL, waits for you to approve it in the browser, then performs the
 * server-side calls and prints the real resource ids:
 *
 *   authorization → capture → query capture → refund → query refund
 *   authorization → void    → query authorization
 *
 * Each step uses a request id for its own resource. A new invocation creates a
 * new test run; do not rerun blindly after a timeout. Query the printed resource
 * ids first to establish the previous outcome.
 *
 * It refuses to run without sandbox credentials:
 *   node scripts/setup-access.mjs     # then re-run this
 *   npx tsx scripts/sandbox-spine.ts
 *
 * Exit codes: 0 both paths verified; 2 blocked (no credentials / no TTY);
 * 1 a PayPal step failed (real error printed with name/message/debug_id).
 */
import { createInterface } from 'node:readline/promises';
import { loadConfig, assertSandbox } from '../src/server/config.js';
import { createPaypal, centsToDecimal } from '../src/server/payments/paypal.js';

const cfg = loadConfig();
const AMOUNT_CENTS = 4500;
const CURRENCY = 'USD';
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

function line(text = ''): void {
  console.log(text);
}

function header(title: string): void {
  line(`\n=== ${title} ===`);
}

function redact(id: string | null): string {
  return id ?? '(none)';
}

async function main(): Promise<void> {
  if (!cfg.paypal.live) {
    line('BLOCKED: no PayPal sandbox credentials were found.');
    line(`  secrets file: ${cfg.secretsPath}`);
    line('  1) run: node scripts/setup-access.mjs');
    line('  2) restart: npx tsx scripts/sandbox-spine.ts');
    line('Nothing was claimed as verified. The app and its tests currently use the labelled simulated adapter.');
    process.exit(2);
  }
  assertSandbox(cfg);
  if (!process.stdin.isTTY) {
    line('BLOCKED: this script needs an interactive terminal to wait for your PayPal approval.');
    process.exit(2);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const paypal = createPaypal(cfg);
  line(`PayPal sandbox: ${cfg.paypal.baseUrl}`);
  line(`Amount per check: ${centsToDecimal(AMOUNT_CENTS)} ${CURRENCY}`);
  line('This is sandbox money only. It is not a real charge.');

  async function waitForApproval(approveUrl: string, label: string): Promise<void> {
    line(`\nOpen this URL and approve with a sandbox PERSONAL (buyer) account:\n  ${approveUrl}\n`);
    await rl.question(`Press Enter once PayPal shows "${label}"... `);
  }

  try {
    /* ---------------- Path A: authorize → capture → refund ---------------- */
    header('PATH A — authorization, capture, refund');
    const orderA = await paypal.createAuthorizeOrder(
      {
        amountCents: AMOUNT_CENTS,
        currency: CURRENCY,
        description: 'GatherReady sandbox spine — capture and refund',
        customId: `spine-a-${stamp}`,
        invoiceId: `SPINE-A-${stamp}`,
        returnUrl: `${cfg.publicBaseUrl}/return`,
        cancelUrl: `${cfg.publicBaseUrl}/cancel`,
      },
      `spine-a-create-${stamp}`,
    );
    line(`order created: ${redact(orderA.orderId)} status=${orderA.status}`);
    if (!orderA.approveUrl) throw new Error('PayPal did not return an approval link for the order');
    await waitForApproval(orderA.approveUrl, 'approval complete');

    const readA = await paypal.getOrder(orderA.orderId);
    line(`order queried: ${redact(orderA.orderId)} status=${readA.status}`);
    if (readA.status !== 'APPROVED' && readA.status !== 'COMPLETED') {
      throw new Error(`order is ${readA.status}; approve it before continuing`);
    }

    const authA = await paypal.authorizeOrder(orderA.orderId, `spine-a-authorize-${orderA.orderId}`);
    line(`authorization: ${redact(authA.authorizationId)} status=${authA.status} amount=${centsToDecimal(authA.amountCents)} ${authA.currency}`);
    if (authA.status !== 'CREATED' && authA.status !== 'AUTHORIZED' && authA.status !== 'CAPTURED') {
      throw new Error(`authorization is ${authA.status}`);
    }
    if (authA.amountCents !== AMOUNT_CENTS || authA.currency !== CURRENCY) throw new Error('authorization amount/currency mismatch');
    const authARead = await paypal.getAuthorization(authA.authorizationId);
    line(`authorization queried: ${redact(authA.authorizationId)} status=${authARead.status}`);

    const captureA = await paypal.captureAuthorization(
      {
        authorizationId: authA.authorizationId,
        amountCents: AMOUNT_CENTS,
        currency: CURRENCY,
        finalCapture: true,
        invoiceId: `SPINE-A-${stamp}`,
      },
      `spine-a-capture-${authA.authorizationId}`,
    );
    line(`capture: ${redact(captureA.captureId)} status=${captureA.status} amount=${centsToDecimal(captureA.amountCents)} ${captureA.currency}`);
    if (captureA.amountCents !== AMOUNT_CENTS || captureA.currency !== CURRENCY) throw new Error('capture amount/currency mismatch');
    const captureARead = await paypal.getCapture(captureA.captureId);
    line(`capture queried: ${redact(captureA.captureId)} status=${captureARead.status} refunded=${centsToDecimal(captureARead.refundedCents)}`);
    if (captureARead.status !== 'COMPLETED') throw new Error(`capture is ${captureARead.status}; not complete`);

    const refundA = await paypal.refundCapture(
      { captureId: captureA.captureId, amountCents: AMOUNT_CENTS, currency: CURRENCY },
      `spine-a-refund-${captureA.captureId}`,
    );
    line(`refund: ${redact(refundA.refundId)} status=${refundA.status} amount=${centsToDecimal(refundA.amountCents)}`);
    const refundARead = await paypal.getRefund(refundA.refundId);
    line(`refund queried: ${redact(refundA.refundId)} status=${refundARead.status}`);
    if (refundARead.status !== 'COMPLETED') throw new Error(`refund is ${refundARead.status}; not complete`);

    /* ---------------- Path B: authorize → void ---------------- */
    header('PATH B — authorization, void');
    const orderB = await paypal.createAuthorizeOrder(
      {
        amountCents: AMOUNT_CENTS,
        currency: CURRENCY,
        description: 'GatherReady sandbox spine — void',
        customId: `spine-b-${stamp}`,
        invoiceId: `SPINE-B-${stamp}`,
        returnUrl: `${cfg.publicBaseUrl}/return`,
        cancelUrl: `${cfg.publicBaseUrl}/cancel`,
      },
      `spine-b-create-${stamp}`,
    );
    line(`order created: ${redact(orderB.orderId)} status=${orderB.status}`);
    if (!orderB.approveUrl) throw new Error('PayPal did not return an approval link for the order');
    await waitForApproval(orderB.approveUrl, 'approval complete');

    const authB = await paypal.authorizeOrder(orderB.orderId, `spine-b-authorize-${orderB.orderId}`);
    line(`authorization: ${redact(authB.authorizationId)} status=${authB.status}`);
    const voidB = await paypal.voidAuthorization(authB.authorizationId, `spine-b-void-${authB.authorizationId}`);
    line(`void: status=${voidB.status}`);
    const authBRead = await paypal.getAuthorization(authB.authorizationId);
    line(`authorization queried: ${redact(authB.authorizationId)} status=${authBRead.status}`);
    if (authBRead.status !== 'VOIDED') {
      throw new Error(`void did not reach VOIDED (status ${authBRead.status})`);
    }

    header('SANDBOX SPINE PASSED');
    line('Real sandbox resources (no secrets, no PII):');
    line(`  order A:         ${orderA.orderId}`);
    line(`  authorization A: ${authA.authorizationId}`);
    line(`  capture A:       ${captureA.captureId} (${captureARead.status})`);
    line(`  refund A:        ${refundA.refundId} (${refundARead.status})`);
    line(`  order B:         ${orderB.orderId}`);
    line(`  authorization B: ${authB.authorizationId} (${authBRead.status})`);
    line('');
    line('Copy these ids into docs/testing.md under "real sandbox evidence" with the date and commit.');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nSANDBOX SPINE FAILED: ${message}`);
  if (err && typeof err === 'object' && 'info' in err) {
    const info = (err as { info: { name?: string; status?: number; debugId?: string | null } }).info;
    console.error(`PayPal said: name=${info.name} status=${info.status} debug_id=${info.debugId ?? '(none)'}`);
  }
  process.exitCode = 1;
});
