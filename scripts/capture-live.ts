/**
 * Capture the real screens: live Fastify server + built UI, a real synthetic session,
 * a real demo flow driven through the product's own HTTP API. No `?mock=1`, no dev
 * banner, no hand-built AppState — what is captured is what the server answers.
 *
 * Requires `npm run build` first. Chrome path via CHROME_PATH.
 * Overwrites docs/screenshots/*.png and writes docs/screenshots/manifest.json.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'screenshots');
const PORT = Number(process.env.LIVE_SHOT_PORT ?? 5195);
const BASE = `http://127.0.0.1:${PORT}`;
const DB = path.join(os.tmpdir(), `gatherready-shots-${process.pid}.db`);
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

interface ShotRecord {
  file: string;
  route: string;
  width: number;
  height: number;
  state: string;
}

const shots: ShotRecord[] = [];
let page: Page;
let currentWidth = 1440;

async function api(method: string, route: string, body?: unknown): Promise<any> {
  return page.evaluate(
    async (m: string, r: string, b: unknown) => {
      const res = await fetch(r, {
        method: m,
        headers: { 'content-type': 'application/json', 'x-gatherready': '1' },
        body: b === undefined ? undefined : JSON.stringify(b),
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      return { status: res.status, json };
    },
    method,
    route,
    body,
  );
}

async function state(): Promise<any> {
  const res = await api('GET', '/api/state');
  if (res.status !== 200) throw new Error(`GET /api/state -> ${res.status}`);
  return res.json;
}

async function asParticipant(participantId: string | null): Promise<void> {
  const res = await api('POST', '/api/demo/view', { participantId });
  if (res.status !== 200) throw new Error(`demo view failed: ${JSON.stringify(res.json)}`);
}

async function shoot(slug: string, route: string, label: string): Promise<void> {
  await page.setViewport({ width: currentWidth, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0', timeout: 30_000 });
  // load lazy images below the fold before the full-page capture
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((resolve) => setTimeout(resolve, 350));
    window.scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
  await new Promise((r) => setTimeout(r, 350));
  const file = path.join(OUT, `${slug}-${currentWidth}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const { width, height } = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  shots.push({ file: path.relative(ROOT, file), route, width, height, state: label });
  console.log(`captured ${path.basename(file)} (${width}x${height}) — ${label}`);
}

async function atWidth(width: number, fn: () => Promise<void>): Promise<void> {
  const previous = currentWidth;
  currentWidth = width;
  try {
    await fn();
  } finally {
    currentWidth = previous;
  }
}

function startServer(): ChildProcess {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(PORT),
    GATHERREADY_DB: DB,
    PUBLIC_BASE_URL: BASE,
    PAYPAL_FORCE_SIMULATED: '1',
    // Opt-in: CAPTURE_LIVE_AI=1 with LLM_OLLAMA=1/LLM_MODEL=... records the live-AI
    // banner and real model answers instead of the recorded/structured fallback.
    ...(process.env.CAPTURE_LIVE_AI === '1'
      ? { LLM_OLLAMA: process.env.LLM_OLLAMA ?? '1', LLM_MODEL: process.env.LLM_MODEL ?? '', LLM_TIMEOUT_MS: process.env.LLM_TIMEOUT_MS ?? '60000' }
      : { LLM_PROVIDER: '', LLM_API_KEY: '', LLM_OLLAMA: '' }),
  };
  const tsx = path.join(ROOT, 'node_modules', '.bin', 'tsx');
  const child = spawn(tsx, ['src/server/main.ts'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderr?.on('data', (d: Buffer) => process.stderr.write(`[server] ${d}`));
  return child;
}

async function waitFor(url: string, timeoutMs = 25_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* keep waiting */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`not ready: ${url}`);
}

async function main(): Promise<void> {
  if (!existsSync(path.join(ROOT, 'dist', 'web', 'index.html'))) {
    throw new Error('dist/web missing — run `npm run build` first');
  }
  if (!existsSync(CHROME)) {
    console.log(`Chrome not found at ${CHROME}; set CHROME_PATH to capture screenshots. Skipping.`);
    return;
  }
  await mkdir(OUT, { recursive: true });
  for (const file of await readdir(OUT)) {
    if (file.endsWith('.png')) await rm(path.join(OUT, file), { force: true });
  }

  const server = startServer();
  let browser: Browser | null = null;
  try {
    await waitFor(`${BASE}/healthz`);
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
    });
    page = (await browser.newPage()) as Page;
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });

    /* landing + sample setup */
    await shoot('landing', '/', 'landing');
    await atWidth(420, async () => shoot('landing', '/', 'landing (mobile)'));

    const loaded = await api('POST', '/api/workshop', { sample: true });
    if (loaded.status !== 200) throw new Error(`load sample failed: ${JSON.stringify(loaded.json)}`);
    await shoot('organizer-setup', '/organizer/setup', 'organizer setup after loading synthetic sample');
    await shoot('organizer-plan', '/organizer/plan', 'no workable plan yet: 3 confirmed fits, one condition not counted');

    /* Diego reviews, confirms, gets one question */
    const base = await state();
    const diego = base.participants.find((p: any) => p.displayName === 'Diego');
    if (!diego) throw new Error('Diego missing from sample');
    await asParticipant(diego.id);
    await shoot('participant-preferences', '/participant/preferences', 'participant view: own sentence prefilled');
    const diegoState = await state();
    const diegoPref = diegoState.preferences.find((p: any) => p.participantId === diego.id);
    if (!diegoPref?.sourceText) throw new Error('Diego own source text missing from participant view');
    const parsed = await api('POST', '/api/preferences/parse', { sourceText: diegoPref.sourceText });
    if (parsed.status !== 200) throw new Error(`parse failed: ${JSON.stringify(parsed.json)}`);
    await shoot('participant-preferences-parsed', '/participant/preferences', 'reviewable card with verbatim quote');
    const mine = await state();
    const draft = mine.preferences.find((p: any) => p.participantId === diego.id);
    const confirmed = await api('POST', '/api/preferences/confirm', {
      version: draft.version,
      acceptedSlotIds: draft.acceptedSlotIds,
      preferredSlotIds: draft.preferredSlotIds,
      conditions: draft.conditions.map((c: any) => ({ slotId: c.slotId, condition: c.condition, sourceQuote: c.sourceQuote })),
      uncertainties: draft.uncertainties,
    });
    if (confirmed.status !== 200) throw new Error(`confirm failed: ${JSON.stringify(confirmed.json)}`);
    await shoot('participant-preferences-confirmed', '/participant/preferences', 'confirmed preference (still not a fit)');

    /* organizer sees the single question */
    await asParticipant(null);
    await shoot('organizer-plan-suggestion', '/organizer/plan', 'one suggested question with the fact and the gap it closes');
    await atWidth(420, async () =>
      shoot('organizer-plan-suggestion', '/organizer/plan', 'plan with suggestion (mobile)'),
    );
    const proposed = await api('POST', '/api/clarifications/propose', {});
    const clarification = proposed.json?.clarifications?.[0];
    if (!clarification) throw new Error(`propose failed: ${JSON.stringify(proposed.json)}`);
    const sent = await api('POST', `/api/clarifications/${clarification.id}/send`, {});
    if (sent.status !== 200) throw new Error(`send failed: ${JSON.stringify(sent.json)}`);

    /* participant answers */
    await asParticipant(diego.id);
    await shoot('participant-clarify', '/participant/clarify', 'participant sees only their own question');
    const answered = await api('POST', `/api/clarifications/${clarification.id}/answer`, { answer: 'YES' });
    if (answered.status !== 200) throw new Error(`answer failed: ${JSON.stringify(answered.json)}`);

    /* publish offer */
    await asParticipant(null);
    const planState = await state();
    const slot = planState.plan.workableSlotId;
    const published = await api('POST', '/api/offers/publish', { slotId: slot });
    if (published.status !== 200) throw new Error(`publish failed: ${JSON.stringify(published.json)}`);
    await shoot('organizer-offer', '/organizer/offer', 'one frozen offer: terms and fingerprint');

    /* participant authorizes (simulated) */
    await asParticipant(diego.id);
    await shoot('participant-authorize', '/participant/authorize', 'fixed summary + unchecked consent + PayPal button');
    await atWidth(420, async () =>
      shoot('participant-authorize', '/participant/authorize', 'consent screen (mobile)'),
    );

    /* four authorizations */
    await asParticipant(null);
    const offerState = await state();
    const included: string[] = offerState.plan.slots.find((s: any) => s.slotId === slot).fitNames;
    for (const name of included) {
      const list = await state();
      const person = list.participants.find((p: any) => p.displayName === name);
      await asParticipant(person.id);
      const started = await api('POST', '/api/checkout/orders', { consent: true });
      const orderId = started.json?.checkout?.orderId;
      if (!orderId) throw new Error(`checkout failed for ${name}: ${JSON.stringify(started.json)}`);
      const done = await api('POST', `/api/checkout/${encodeURIComponent(orderId)}/complete`, {});
      if (done.status !== 200) throw new Error(`complete failed for ${name}: ${JSON.stringify(done.json)}`);
    }

    /* funding + settle + result */
    await asParticipant(null);
    await shoot('organizer-funding', '/organizer/funding', 'authorized, not charged — collect is a separate action');
    const settled = await api('POST', `/api/workshops/${offerState.workshop.id}/settle`, {});
    if (settled.status !== 200) throw new Error(`settle failed: ${JSON.stringify(settled.json)}`);
    await shoot('organizer-result', '/organizer/result', 'workshop confirmed only after every capture completed');

    /* honest failure state: fresh sample below the minimum */
    const reset = await api('POST', '/api/demo/reset', {});
    if (reset.status !== 200) throw new Error(`reset failed: ${JSON.stringify(reset.json)}`);
    await shoot('organizer-plan-no-plan', '/organizer/plan', 'no plan: minimum not reached, no invented compromise');

    /* Chinese interface captures (same live state, real switch, not a mock) */
    await page.evaluate(() => window.localStorage.setItem('gatherready.locale', 'zh'));
    await shoot('landing-zh', '/', 'Chinese landing after switching the interface language');
    await shoot('organizer-plan-zh', '/organizer/plan', 'Chinese organizer home after switching the interface language');
    await shoot('organizer-setup-zh', '/organizer/setup', 'Chinese organizer setup after switching the interface language');
    await page.evaluate(() => window.localStorage.setItem('gatherready.locale', 'en'));

    await writeFile(
      path.join(OUT, 'manifest.json'),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          source: 'live server + built UI (no mock state)',
          mode: 'PayPal simulated, AI recorded/structured (no credentials on this machine)',
          shots,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    console.log(`\nWrote ${shots.length} screenshots + manifest.json to ${path.relative(ROOT, OUT)}`);
  } finally {
    await browser?.close().catch(() => undefined);
    server.kill('SIGTERM');
    for (const suffix of ['', '-wal', '-shm']) await rm(`${DB}${suffix}`, { force: true }).catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('live capture failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
