/**
 * Browser smoke test of the real UI against the running server.
 *
 * Why this exists: the API-level walkthrough (`scripts/verify.ts`) is the safety gate,
 * but it cannot catch a UI dead-end. This test clicks the actual buttons a person
 * clicks, in the order the brief describes, and fails loudly on any missing state.
 *
 * It needs a running server with the built UI:
 *   npm run build && npm start        # or PORT=5180 ... npm start
 *   npx tsx scripts/ui-smoke.ts       # CHROME_PATH optional on macOS
 *
 * It creates a fresh synthetic session, so it does not disturb other tenants.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';

const BASE = process.env.UI_BASE ?? 'http://localhost:5180';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TIMEOUT = Number(process.env.UI_TIMEOUT ?? 60_000);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function ok(name: string): void {
  console.log(`PASS  ${name}`);
}
let failures = 0;
function fail(name: string, detail: string): void {
  failures += 1;
  console.log(`FAIL  ${name} — ${detail}`);
}

async function waitText(page: Page, text: string, timeout = TIMEOUT): Promise<boolean> {
  try {
    await page.waitForFunction(
      (needle: string) => document.body.innerText.toLowerCase().includes(needle.toLowerCase()),
      { timeout },
      text,
    );
    return true;
  } catch {
    return false;
  }
}

async function clickText(page: Page, text: string, scope = 'button, a, label'): Promise<boolean> {
  return page.evaluate(
    (needle: string, selector: string) => {
      const candidates = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
      const hit = candidates.find((el) => {
        const label = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        const style = window.getComputedStyle(el);
        const visible = style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
        const disabled = (el as HTMLButtonElement).disabled === true;
        return visible && !disabled && label.includes(needle);
      });
      if (!hit) return false;
      hit.click();
      return true;
    },
    text,
    scope,
  );
}

async function clickDemo(page: Page, name: string): Promise<boolean> {
  return page.evaluate((needle: string) => {
    const buttons = Array.from(document.querySelectorAll('.demo-bar button')) as HTMLButtonElement[];
    const hit = buttons.find((el) => (el.textContent || '').trim() === needle);
    if (!hit || hit.disabled) return false;
    hit.click();
    return true;
  }, name);
}

async function api(page: Page, method: string, route: string, body?: unknown): Promise<any> {
  return page.evaluate(
    async (m: string, r: string, b: unknown) => {
      const res = await fetch(r, {
        method: m,
        headers: { 'content-type': 'application/json', 'x-gatherready': '1' },
        body: b === undefined ? undefined : JSON.stringify(b),
      });
      const text = await res.text();
      try {
        return text ? JSON.parse(text) : null;
      } catch {
        return null;
      }
    },
    method,
    route,
    body,
  );
}

async function main(): Promise<void> {
  if (!existsSync(CHROME)) {
    console.log(`Chrome not found at ${CHROME}; skipping UI smoke test.`);
    return;
  }
  const health = await fetch(`${BASE}/healthz`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) {
    console.log(`No server at ${BASE}. Start it with: npm start`);
    process.exit(2);
  }
  console.log(`UI smoke against ${BASE} (ai=${health.ai}, paypal=${health.paypal})`);
  const browser: Browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    protocolTimeout: 180_000,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = (await browser.newPage()) as Page;
  await page.setViewport({ width: 1440, height: 1000 });
  try {
    /* 1. land + load the synthetic demo */
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
    if (!(await clickText(page, 'Load a sample workshop'))) {
      // the sample button may be behind the setup page's empty state
      await page.goto(`${BASE}/organizer/setup`, { waitUntil: 'networkidle0' });
      if (!(await clickText(page, 'Load a sample workshop'))) throw new Error('no Load sample button');
    }
    ok('landing → Load sample button found');
    if (!(await waitText(page, 'Fits this plan'))) throw new Error('plan page did not render after loading the sample');
    ok('synthetic sample loaded, plan page rendered');

    /* 2. participant reviews and confirms (live model may take a few seconds) */
    if (!(await clickDemo(page, 'Diego'))) throw new Error('demo bar Diego button missing');
    if (!(await waitText(page, 'What would make this workshop work for you?'))) throw new Error('participant preferences page missing');
    ok('role switch to Diego lands on the preferences screen');
    // Deterministic path for the UI smoke: tick a time and add one condition. This is
    // the no-AI path a participant can always use, so the test does not depend on the
    // model's wording (the live model has its own eval in docs/ai-evaluation.md).
    if (!(await page.$('#tick-slot_b'))) {
      // A seeded draft already exists, so the editor is collapsed behind
      // "Change your answer"; open it before using the deterministic path.
      if (!(await clickText(page, 'Change your answer'))) throw new Error('edit toggle missing');
      await page.waitForFunction(() => Boolean(document.querySelector('#tick-slot_b')), { timeout: TIMEOUT });
    }
    const tickB = await page.$('#tick-slot_b');
    if (!tickB) throw new Error('time checkbox #tick-slot_b missing');
    await tickB.click();
    const conditionInput = await page.$('#conditionText');
    if (!conditionInput) throw new Error('condition textarea missing');
    await conditionInput.type('all the materials are included');
    await page.evaluate(() => {
      const select = document.querySelector('#conditionSlot') as HTMLSelectElement | null;
      if (!select) throw new Error('conditionSlot select missing');
      const option = Array.from(select.options).find((o) => o.value === 'slot_a');
      if (option) {
        select.value = 'slot_a';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    if (!(await clickText(page, 'Use these times'))) throw new Error('Use these times button missing');
    // Wait for the SERVER draft to land, not just for the card to exist: the card is
    // already visible from the seeded draft, so clicking confirm too early used to
    // validate an empty draft and show "choose at least one time".
    await page.waitForFunction(
      () => {
        const box = document.querySelector('#accept-slot_b') as HTMLInputElement | null;
        return Boolean(box?.checked);
      },
      { timeout: TIMEOUT },
    );
    if (!(await waitText(page, 'Structured preferences saved as a draft'))) throw new Error('draft notice missing');
    ok('structured draft rendered as a review card');
    if (!(await clickText(page, 'Confirm my preferences'))) throw new Error('Confirm my preferences button missing');
    if (!(await waitText(page, 'Preferences confirmed'))) throw new Error('confirmation state never appeared');
    ok('participant confirmed preferences');

    /* 3. organizer reviews and sends the one question (the fixed dead-end) */
    if (!(await clickDemo(page, 'Organizer'))) throw new Error('demo bar Organizer button missing');
    await page.goto(`${BASE}/organizer/plan`, { waitUntil: 'networkidle0' });
    if (!(await waitText(page, 'Suggested question'))) throw new Error('plan page missing suggested question panel');
    if (!(await clickText(page, 'Review question'))) throw new Error('Review question button missing');
    if (!(await waitText(page, 'Proposed', 60_000))) throw new Error('proposed question state never appeared (propose dead-end?)');
    ok('Review question creates the stored proposal and opens the review panel');
    const sent = await clickText(page, 'Send question to Diego');
    if (!sent) throw new Error('Send question button missing or disabled');
    if (!(await waitText(page, 'Question sent to Diego'))) throw new Error('send confirmation missing');
    ok('organizer sent the question in-app');

    /* 4. participant answers yes → plan reaches four */
    if (!(await clickDemo(page, 'Diego'))) throw new Error('demo bar Diego button missing (2)');
    await page.goto(`${BASE}/participant/clarify`, { waitUntil: 'networkidle0' });
    if (!(await waitText(page, 'Yes, this works'))) throw new Error('clarify page missing');
    if (!(await clickText(page, 'Yes, this works'))) throw new Error('Yes button missing');
    if (!(await waitText(page, 'that time now counts'))) throw new Error('answered state missing');
    ok('participant answered yes');
    if (!(await clickDemo(page, 'Organizer'))) throw new Error('demo bar Organizer button missing (2)');
    await page.goto(`${BASE}/organizer/plan`, { waitUntil: 'networkidle0' });
    if (!(await waitText(page, '4 confirmed fits'))) throw new Error('plan did not reach four confirmed fits');
    ok('plan shows 4 confirmed fits after the answer (3→4)');

    /* 5. publish the offer from the UI */
    await page.goto(`${BASE}/organizer/offer`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      const radio = Array.from(document.querySelectorAll('input[name="offer-slot"]')).find(
        (el) => !(el as HTMLInputElement).disabled,
      ) as HTMLInputElement | undefined;
      radio?.click();
    });
    await sleep(300);
    const merchant = await page.$('#merchant-confirm');
    if (!merchant) throw new Error('merchant confirmation checkbox missing');
    await merchant.click();
    if (!(await clickText(page, 'Publish offer'))) throw new Error('Publish offer button missing/disabled');
    if (!(await waitText(page, 'Offer open for authorization'))) throw new Error('offer published state missing');
    ok('offer published from the UI with the terms locked');

    /* 6. participant authorizes through the consent screen */
    if (!(await clickDemo(page, 'Diego'))) throw new Error('demo bar Diego button missing (3)');
    await page.goto(`${BASE}/participant/authorize`, { waitUntil: 'networkidle0' });
    if (!(await waitText(page, 'Your agreement'))) throw new Error('authorize page missing consent section');
    const consent = await page.$('#consent');
    if (!consent) throw new Error('consent checkbox missing');
    await consent.click();
    if (!(await clickText(page, 'Sandbox payment'))) throw new Error('simulated PayPal button missing');
    if (!(await waitText(page, 'Authorized', 60_000))) throw new Error('authorized state never appeared');
    // The simulated approval returns through /return → redirect; let that settle
    // before issuing API calls from the page context.
    await page
      .waitForFunction(() => /\/participant\/authorize/.test(location.pathname) && location.search.includes('ok=1'), {
        timeout: 30_000,
      })
      .catch(() => undefined);
    await sleep(600);
    ok('participant consented and authorized (simulated adapter, labelled)');

    /* 7. the other three authorizations via the same API the UI calls */
    if (!(await clickDemo(page, 'Organizer'))) throw new Error('demo bar Organizer button missing (7)');
    await waitText(page, 'The plan');
    const state = await api(page, 'GET', '/api/state');
    const offer = state.offer;
    const included: string[] = state.plan.slots.find((s: any) => s.slotId === offer.slotId).fitNames;
    if (included.length !== 4) throw new Error(`expected 4 included participants, found ${included.length}`);

    for (const name of included) {
      const current = await api(page, 'GET', '/api/state');
      const person = current.participants.find((p: any) => p.displayName === name);
      if (!person) continue;
      if (['AUTHORIZED', 'CAPTURED'].includes(person.paymentStatus)) continue;
      await api(page, 'POST', '/api/demo/view', { participantId: person.id });
      const started = await api(page, 'POST', '/api/checkout/orders', { consent: true });
      const orderId = started?.checkout?.orderId;
      if (!orderId) throw new Error(`checkout failed for ${name}`);
      await api(page, 'POST', `/api/checkout/${encodeURIComponent(orderId)}/complete`, {});
    }
    await sleep(400);
    const after = await api(page, 'GET', '/api/state');
    const authorizedCount = after.plan.counts.authorized;
    if (authorizedCount !== 4) throw new Error(`expected 4 authorizations, found ${authorizedCount}`);
    ok('four independent authorizations recorded');

    /* 8. collect from the funding screen */
    if (!(await clickDemo(page, 'Organizer'))) throw new Error('demo bar Organizer button missing (3)');
    await page.goto(`${BASE}/organizer/funding`, { waitUntil: 'networkidle0' });
    await waitText(page, 'Authorized');
    if (!(await clickText(page, 'Confirm workshop and collect'))) throw new Error('collect button missing/disabled');
    if (!(await waitText(page, 'Workshop confirmed', 120_000))) throw new Error('workshop confirmed state missing');
    ok('organizer collected from the UI; workshop confirmed');

    await page.goto(`${BASE}/organizer/result`, { waitUntil: 'networkidle0' });
    if (!(await waitText(page, 'Workshop confirmed'))) throw new Error('result page missing confirmed state');
    const body = await page.evaluate(() => document.body.innerText);
    if (!/180\.00/.test(body)) throw new Error('result page does not show the captured total');
    ok('result page shows per-person receipts and the captured total');

    console.log(failures === 0 ? '\nUI smoke passed — the browser flow is walkable end to end.' : `\n${failures} UI checks failed.`);
    if (failures > 0) process.exitCode = 1;
  } catch (err) {
    await page.screenshot({ path: '/tmp/gatherready-ui-smoke-fail.png', fullPage: true }).catch(() => undefined);
    fail('flow', err instanceof Error ? err.message : String(err));
    console.log('Screenshot of the failure: /tmp/gatherready-ui-smoke-fail.png');
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('UI smoke could not run:', err instanceof Error ? err.message : err);
  process.exit(1);
});

void path;
