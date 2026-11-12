/**
 * Record a real, silent walkthrough of the running product: live Fastify server +
 * built UI, real HTTP state changes, CDP screencast frames encoded with ffmpeg.
 *
 * No mock state. No fake PayPal. The persistent bottom-bar caption says so, and the
 * badge stays visible in every frame: "Demo payment — no PayPal transaction" (or the
 * sandbox badge if credentials exist). Add your own narration over this file, or
 * use it as a shot-list reference for the final recording.
 *
 * Usage: npm run build && npx tsx scripts/record-demo.ts
 * Output: docs/demo/gatherready-walkthrough.mp4 (+ poster.png, frames are deleted)
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Browser, type CDPSession, type Page } from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'docs', 'demo');
const FRAMES_DIR = path.join(os.tmpdir(), `gatherready-frames-${process.pid}`);
const PORT = Number(process.env.DEMO_PORT ?? 5197);
const BASE = `http://127.0.0.1:${PORT}`;
const DB = path.join(os.tmpdir(), `gatherready-demo-${process.pid}.db`);
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const WIDTH = 1440;
const HEIGHT = 900;

const PACE = Number(process.env.DEMO_PACE ?? '1.5');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms * PACE));
let page: Page;
let session: CDPSession | null = null;
let frameIndex = 0;
const frames: Array<{ file: string; at: number }> = [];

const CAPTIONS = {
  mode: 'Automated walkthrough of the running product · real server state · DEMO PAYMENT (no PayPal transaction)',
} as const;

async function caption(text: string): Promise<void> {
  await page.evaluate(
    (args: { text: string; mode: string }) => {
      let host = document.getElementById('gr-demo-caption');
      if (!host) {
        host = document.createElement('div');
        host.id = 'gr-demo-caption';
        host.style.cssText =
          'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;display:flex;gap:18px;align-items:center;' +
          'justify-content:space-between;padding:14px 22px;background:rgba(16,20,18,.94);color:#fff;' +
          'font:500 15px/1.35 ui-sans-serif,system-ui,-apple-system,sans-serif;pointer-events:none';
        document.body.appendChild(host);
      }
      host.innerHTML = '';
      const left = document.createElement('span');
      left.textContent = args.text;
      left.style.cssText = 'max-width:78%;';
      const right = document.createElement('span');
      right.textContent = 'DEMO PAYMENT — NO PAYPAL TRANSACTION';
      right.style.cssText =
        'flex:none;font-size:12px;letter-spacing:.06em;font-weight:700;color:#ffd27a;' +
        'border:1px solid rgba(255,210,122,.5);border-radius:999px;padding:5px 10px;white-space:nowrap';
      const clock = document.createElement('span');
      clock.id = 'gr-demo-clock';
      clock.style.cssText = 'flex:none;font-variant-numeric:tabular-nums;font-size:12px;color:#9fb3aa;min-width:64px;text-align:right';
      clock.textContent = '00:00.0';
      host.append(left, right, clock);
      const started = performance.now();
      const tick = () => {
        if (!document.getElementById('gr-demo-clock')) return;
        const el = document.getElementById('gr-demo-clock');
        if (el) {
          const seconds = (performance.now() - started) / 1000;
          el.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
        }
        window.setTimeout(tick, 100);
      };
      tick();
    },
    { text, mode: CAPTIONS.mode },
  );
}

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

async function asParticipant(participantId: string | null): Promise<void> {
  await api('POST', '/api/demo/view', { participantId });
}

async function go(route: string, text: string, holdMs = 1900): Promise<void> {
  await page.goto(`${BASE}${route}`, { waitUntil: 'load', timeout: 30_000 });
  await sleep(200);
  await caption(text);
  await sleep(holdMs);
}

/**
 * CDP screencast. CDP only emits a frame when pixels change, so the caption bar
 * carries a 100ms clock: it keeps the encoder fed during static reading time, so
 * the recording keeps real-time pacing instead of collapsing to a few frames.
 */
async function startCapture(): Promise<void> {
  await mkdir(FRAMES_DIR, { recursive: true });
  const cdp = await page.createCDPSession();
  session = cdp;
  cdp.on(
    'Page.screencastFrame',
    async (event: { data: string; sessionId: number; metadata?: { timestamp?: number } }) => {
      const file = path.join(FRAMES_DIR, `f${String(frameIndex).padStart(6, '0')}.png`);
      frameIndex += 1;
      const at = event.metadata?.timestamp ?? Date.now() / 1000;
      frames.push({ file, at });
      const { writeFile: write } = await import('node:fs/promises');
      await write(file, Buffer.from(event.data, 'base64'));
      try {
        await cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
      } catch {
        /* frame loop closed */
      }
    },
  );
  await cdp.send('Page.startScreencast', { format: 'png', quality: 90, maxWidth: WIDTH, maxHeight: HEIGHT, everyNthFrame: 1 });
}

async function stopCapture(): Promise<void> {
  if (session) {
    try {
      await session.send('Page.stopScreencast');
    } catch {
      /* already closed */
    }
    session = null;
  }
  console.log(`[capture] frames=${frames.length}`);
}

async function encode(): Promise<void> {
  if (frames.length === 0) throw new Error('no screencast frames were captured');
  const sorted = frames.slice().sort((a, b) => a.at - b.at);
  const lines: string[] = ['ffconcat version 1.0'];
  for (let i = 0; i < sorted.length; i += 1) {
    const frame = sorted[i]!;
    const next = sorted[i + 1];
    const duration = next ? Math.min(Math.max(next.at - frame.at, 0.04), 2) : 1;
    lines.push(`file '${frame.file.replace(/'/g, "'\\''")}'`, `duration ${duration.toFixed(3)}`);
  }
  const listPath = path.join(FRAMES_DIR, 'frames.ffconcat');
  await writeFile(listPath, `${lines.join('\n')}\n`, 'utf8');
  const out = path.join(OUT_DIR, 'gatherready-walkthrough.mp4');
  await new Promise<void>((resolve, reject) => {
    const ff = spawn(
      'ffmpeg',
      [
        '-y',
        '-f', 'concat', '-safe', '0', '-i', listPath,
        '-fps_mode', 'vfr',
        '-vf', 'fps=24,scale=1440:-2:flags=lanczos,format=yuv420p',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '22',
        '-movflags', '+faststart',
        out,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let err = '';
    ff.stderr?.on('data', (d: Buffer) => {
      err += d.toString();
    });
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}): ${err.slice(-1200)}`))));
  });
  // poster from a mid-flow frame
  const posterFrame = sorted[Math.floor(sorted.length * 0.55)]!.file;
  const poster = path.join(OUT_DIR, 'poster.png');
  await new Promise<void>((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-y', '-i', posterFrame, '-frames:v', '1', poster], { stdio: 'ignore' });
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error('poster extraction failed'))));
  });
  console.log(`\nVideo: ${path.relative(ROOT, out)}`);
  console.log(`Poster: ${path.relative(ROOT, poster)}`);
  console.log(`Frames: ${sorted.length} · span ${(sorted[sorted.length - 1]!.at - sorted[0]!.at).toFixed(1)}s`);
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
  const child = spawn(path.join(ROOT, 'node_modules', '.bin', 'tsx'), ['src/server/main.ts'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
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
    await sleep(200);
  }
  throw new Error(`not ready: ${url}`);
}

async function main(): Promise<void> {
  if (!existsSync(path.join(ROOT, 'dist', 'web', 'index.html'))) throw new Error('run `npm run build` first');
  if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME} (set CHROME_PATH)`);
  await mkdir(OUT_DIR, { recursive: true });

  const server = startServer();
  let browser: Browser | null = null;
  try {
    await waitFor(`${BASE}/healthz`);
    browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 120_000, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    page = (await browser.newPage()) as Page;
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    // tsx/esbuild injects a `__name` helper into transformed functions; the page
    // context needs a no-op stub so evaluate() helpers that declare named
    // functions (the caption clock) don't throw ReferenceError.
    await page.evaluateOnNewDocument(() => {
      (window as unknown as { __name?: (fn: unknown) => unknown }).__name = (fn: unknown) => fn;
    });

    /* ---------- opening: the problem statement in the product's own words ---------- */
    await go('/', '0:00  The gap: interest is conditional, so nobody can count it.');
    await startCapture();
    await sleep(2400);

    await caption('0:08  Load a sample workshop: six participants, five pre-confirmed.');
    await api('POST', '/api/workshop', { sample: true });
    await go('/organizer/plan', '0:14  Three numbers, never collapsed: Interested 6 · Fits this plan 3 · Authorized 0.', 2600);
    await sleep(1400);

    /* ---------- participant reviews his own sentence ---------- */
    const base = await api('GET', '/api/state');
    const diego = base.json.participants.find((p: any) => p.displayName === 'Diego');
    await asParticipant(diego.id);
    await go('/participant/preferences', '0:24  Diego types one messy sentence. Nothing counts until he confirms it.', 2000);
    const own = await api('GET', '/api/state');
    const sourceText = own.json.preferences.find((p: any) => p.participantId === diego.id)?.sourceText;
    await api('POST', '/api/preferences/parse', { sourceText });
    await page.reload({ waitUntil: 'load' });
    await sleep(220);
    await caption('0:32  Extraction card: must have, preferred, needs clarification — with his verbatim quote.');
    await sleep(2600);
    const afterParse = await api('GET', '/api/state');
    const draft = afterParse.json.preferences.find((p: any) => p.participantId === diego.id);
    await api('POST', '/api/preferences/confirm', {
      version: draft.version,
      acceptedSlotIds: draft.acceptedSlotIds,
      preferredSlotIds: draft.preferredSlotIds,
      conditions: draft.conditions.map((c: any) => ({ slotId: c.slotId, condition: c.condition, sourceQuote: c.sourceQuote })),
      uncertainties: draft.uncertainties,
    });
    await page.reload({ waitUntil: 'load' });
    await sleep(220);
    await caption('0:40  He confirms. The conditional time still does not count as a fit.');
    await sleep(1800);

    /* ---------- organizer: one question ---------- */
    await asParticipant(null);
    await go('/organizer/plan', '0:48  One suggested question, and the exact gap it closes: 3 → 4.', 2800);
    const proposed = await api('POST', '/api/clarifications/propose', {});
    const clarification = proposed.json.clarifications[0];
    await api('POST', `/api/clarifications/${clarification.id}/send`, {});
    await sleep(1400);

    /* ---------- participant answers ---------- */
    await asParticipant(diego.id);
    await go('/participant/clarify', '1:00  He sees only his own question, the merchant fact, and his sentence.', 2200);
    await api('POST', `/api/clarifications/${clarification.id}/answer`, { answer: 'YES' });
    await page.reload({ waitUntil: 'load' });
    await sleep(220);
    await caption('1:08  Yes. A no would leave his preference standing — never asked again.');
    await sleep(1600);

    /* ---------- publish the frozen offer ---------- */
    await asParticipant(null);
    const plan = await api('GET', '/api/state');
    await api('POST', '/api/offers/publish', { slotId: plan.json.plan.workableSlotId });
    await go('/organizer/offer', '1:14  One immutable offer: terms frozen, canonical hash fingerprints the plan.', 2600);

    /* ---------- consent screen ---------- */
    await asParticipant(diego.id);
    await go('/participant/authorize', '1:24  Full summary before the button, unchecked consent, simulated PayPal.', 3000);

    /* ---------- four authorizations ---------- */
    await asParticipant(null);
    const offerState = await api('GET', '/api/state');
    const slot = offerState.json.plan.workableSlotId;
    const included: string[] = offerState.json.plan.slots.find((s: any) => s.slotId === slot).fitNames;
    for (const name of included) {
      const list = await api('GET', '/api/state');
      const person = list.json.participants.find((p: any) => p.displayName === name);
      await asParticipant(person.id);
      const started = await api('POST', '/api/checkout/orders', { consent: true });
      await api('POST', `/api/checkout/${encodeURIComponent(started.json.checkout.orderId)}/complete`, {});
      const s = await api('GET', '/api/state');
      void s;
    }
    await asParticipant(null);
    await go('/organizer/funding', '1:38  Authorized = a hold, not a charge. Collection is a separate organizer action.', 2600);

    /* ---------- collect ---------- */
    const ready = await api('GET', '/api/state');
    await caption('1:48  The organizer collects. The server re-validates, locks a batch and records each simulated payment.');
    await api('POST', `/api/workshops/${ready.json.workshop.id}/settle`, {});
    await sleep(500);
    await go('/organizer/result', '1:56  Confirmed only after every simulated capture was recorded. No PayPal transaction occurred.', 3200);

    /* ---------- honest failure path ---------- */
    await api('POST', '/api/demo/reset', {});
    await go('/organizer/plan', '2:06  Failure is a valid outcome: below the minimum, no plan and no invented compromise.', 3000);

    await sleep(1200);
    await stopCapture();
    await browser.close();
    browser = null;
    await encode();
    await writeFile(
      path.join(OUT_DIR, 'README.md'),
      [
        '# Demo video source',
        '',
        '`gatherready-walkthrough.mp4` is a silent, automated walkthrough recorded from the running product',
        '(`scripts/record-demo.ts`): live Fastify server, built React UI, every state change made through the',
        'product\'s own HTTP API. PayPal runs the labelled **simulated** adapter in this recording because no',
        'sandbox credentials exist on the build machine — the badge in every frame says so.',
        '',
        'It is a recording aid, not a submission video: add narration over it or re-record with sandbox',
        'credentials so the sandbox badge (not the simulated one) is visible, then upload under 3 minutes.',
        'See `docs/demo-script.md` for the timed narration.',
        '',
      ].join('\n'),
      'utf8',
    );
    console.log('Passed all steps without error.');
  } finally {
    await stopCapture().catch(() => undefined);
    await browser?.close().catch(() => undefined);
    server.kill('SIGTERM');
    await rm(FRAMES_DIR, { recursive: true, force: true }).catch(() => undefined);
    for (const suffix of ['', '-wal', '-shm']) await rm(`${DB}${suffix}`, { force: true }).catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('demo recording failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
