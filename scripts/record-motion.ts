/* ==========================================================================
   Record a short interaction clip that shows the motion contract in use:
   route transition, candidate expansion with staggered people, the screens
   popover, identity switch, and a participant confirmation updating the
   status sentence. Writes docs/motion-demo.mp4 and docs/motion-demo.gif.

   Run: npm run record:motion
   ========================================================================== */

import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { copyFile, link, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import puppeteer from 'puppeteer-core';

const run = promisify(execFile);
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.MOTION_PORT ?? 5182);
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/healthz`);
      if (response.ok) return;
    } catch {
      /* keep waiting */
    }
    await sleep(250);
  }
  throw new Error(`server did not become healthy on ${BASE}`);
}

async function clickText(page: import('puppeteer-core').Page, text: string): Promise<boolean> {
  return page.evaluate((needle) => {
    const candidates = [...document.querySelectorAll<HTMLElement>('button, a')];
    const target = candidates.find((element) => element.textContent?.trim().includes(needle));
    target?.click();
    return Boolean(target);
  }, text);
}

async function waitText(page: import('puppeteer-core').Page, text: string, timeout = 8000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const found = await page.evaluate((needle) => document.body.innerText.includes(needle), text);
    if (found) return true;
    await sleep(160);
  }
  return false;
}

async function main(): Promise<void> {
  const frameDir = await mkdtemp(path.join(tmpdir(), 'gatherready-motion-'));
  const server = spawn('npx', ['tsx', 'src/server/main.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      PUBLIC_BASE_URL: BASE,
      GATHERREADY_DB: `data/motion-record-${Date.now()}.db`,
      LLM_OLLAMA: '0',
    },
    stdio: 'ignore',
  });

  try {
    await waitForServer();

    const browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/organizer/setup`, { waitUntil: 'networkidle0' });

    const client = await page.createCDPSession();
    const frames: number[] = [];
    let writeChain: Promise<void> = Promise.resolve();
    let frameIndex = 0;
    let recording = true;

    client.on('Page.screencastFrame', (event) => {
      if (!recording) return;
      const frame = event as unknown as {
        data: string;
        sessionId: number;
        metadata?: { timestamp?: number };
      };
      const index = frameIndex;
      frameIndex += 1;
      frames.push(frame.metadata?.timestamp ?? Date.now() / 1000);
      writeChain = writeChain.then(() =>
        writeFile(path.join(frameDir, `frame-${String(index).padStart(5, '0')}.png`), Buffer.from(frame.data, 'base64')),
      );
      void client.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => undefined);
    });

    await client.send('Page.startScreencast', {
      format: 'png',
      maxWidth: 1280,
      maxHeight: 800,
      everyNthFrame: 1,
    });

    /* 1. load the synthetic sample */
    await sleep(500);
    await clickText(page, 'Load a sample');
    await sleep(1900);

    /* 2. route into the plan */
    await page.goto(`${BASE}/organizer/plan`, { waitUntil: 'networkidle0' });
    await sleep(900);

    /* 3. hover and expand one candidate */
    await page.hover('.matrix-row-button');
    await sleep(260);
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('.matrix-row-button')?.click());
    await sleep(1200);

    /* 4. collapse it again */
    await page.evaluate(() =>
      document.querySelector<HTMLButtonElement>('.matrix-row-button[aria-expanded="true"]')?.click(),
    );
    await sleep(700);

    /* 5. screens popover opens from its trigger */
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('.demo-bar__screens-toggle')?.click());
    await sleep(750);
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('.demo-bar__screens-toggle')?.click());
    await sleep(450);

    /* 6. identity switch -> route fade into the participant screen */
    await clickText(page, 'Diego');
    await waitText(page, 'What would make this workshop work');
    await sleep(850);

    /* 7. confirm preferences -> status sentence, steps and rails change */
    await page.evaluate(() => {
      const box = document.querySelector<HTMLInputElement>('#accept-slot_b');
      if (box && !box.checked) box.click();
    });
    await sleep(260);
    await clickText(page, 'Use these times');
    await waitText(page, 'Structured preferences saved as a draft');
    await sleep(650);
    await clickText(page, 'Confirm my preferences');
    await waitText(page, 'Preferences confirmed');
    await sleep(1500);

    /* 8. back to the organizer plan (explicit route: the timer must end on a
       composed screen, not a role guard placeholder) */
    await clickText(page, 'Organizer');
    await sleep(400);
    await page.goto(`${BASE}/organizer/plan`, { waitUntil: 'networkidle0' });
    await sleep(1200);

    recording = false;
    await client.send('Page.stopScreencast').catch(() => undefined);
    await writeChain;
    await browser.close();

    if (frames.length < 30) throw new Error(`only ${frames.length} frames captured`);
    const span = frames[frames.length - 1]! - frames[0]!;
    const FPS = 30;
    console.log(`frames=${frames.length} span=${span.toFixed(2)}s`);

    /* CDP only emits a frame when the page changes, so encoding at a constant
       rate would speed the clip up. Resample the timeline to 30fps by
       hard-linking each captured frame as many times as its real duration
       needs: playback then matches wall-clock time exactly. */
    const sequenceDir = path.join(frameDir, 'sequence');
    await mkdir(sequenceDir, { recursive: true });
    const rawDurations = frames.map((timestamp, index) => {
      const next = frames[index + 1] ?? timestamp + 0.2;
      return Math.max(0.02, next - timestamp);
    });
    const rawTotal = rawDurations.reduce((sum, value) => sum + value, 0);
    const scale = rawTotal > 0 ? span / rawTotal : 1;
    let sequenceIndex = 0;
    for (let index = 0; index < frames.length; index += 1) {
      const duration = rawDurations[index]! * scale;
      const repeats = Math.max(1, Math.round(duration * FPS));
      const source = path.join(frameDir, `frame-${String(index).padStart(5, '0')}.png`);
      for (let repeat = 0; repeat < repeats; repeat += 1) {
        const target = path.join(sequenceDir, `seq-${String(sequenceIndex).padStart(5, '0')}.png`);
        sequenceIndex += 1;
        try {
          await link(source, target);
        } catch {
          await copyFile(source, target);
        }
      }
    }
    const sequencePattern = path.join(sequenceDir, 'seq-%05d.png');
    console.log(`resampled to ${sequenceIndex} frames at ${FPS}fps`);

    await mkdir('docs', { recursive: true });
    await run('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      String(FPS),
      '-i',
      sequencePattern,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '20',
      '-movflags',
      '+faststart',
      'docs/motion-demo.mp4',
    ]);
    await run('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      String(FPS),
      '-i',
      sequencePattern,
      '-vf',
      'fps=12,scale=880:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=bayer',
      '-loop',
      '0',
      'docs/motion-demo.gif',
    ]);
    console.log('Wrote docs/motion-demo.mp4 and docs/motion-demo.gif');
  } finally {
    server.kill('SIGTERM');
    await rm(frameDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error('motion recording failed:', error);
  process.exitCode = 1;
});
