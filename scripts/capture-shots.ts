/* ==========================================================================
   Capture desktop and mobile screenshots of every product screen.

   Dev-only utility, not part of the app. It starts the Vite dev server itself
   (the screens rely on the DEV-only `?mock=1` AppState), captures 1440px and
   420px full-page PNGs into docs/screenshots/, writes a manifest and stops the
   server again. If no Chrome/Chromium is installed it skips with a clear
   message and exit code 0 — a missing browser is not a product failure.

     CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
       npm run capture-shots

   Optional:
     BASE_URL=http://127.0.0.1:5180   use an already-running dev server
     SHOT_PORT=5180                   port to start Vite on (default 5180)
   ========================================================================== */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Browser } from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'docs', 'screenshots');
const VITE_BIN = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const MOCK_TOKEN = 'mockdemo_mockdemo_mockdemo_mockdemo_mockdem';

const WIDTHS = [1440, 420] as const;

interface Shot {
  slug: string;
  route: string;
  scene: string;
}

const SHOTS: Shot[] = [
  { slug: 'landing', route: '/', scene: 'setup' },
  { slug: 'organizer-setup', route: '/organizer/setup', scene: 'setup' },
  { slug: 'participant-preferences', route: '/participant/preferences', scene: 'preferences' },
  { slug: 'organizer-plan', route: '/organizer/plan', scene: 'plan' },
  { slug: 'participant-clarify', route: '/participant/clarify', scene: 'clarify' },
  { slug: 'organizer-offer-publish', route: '/organizer/offer', scene: 'plan-ready' },
  { slug: 'organizer-offer-published', route: '/organizer/offer', scene: 'offer' },
  { slug: 'participant-authorize', route: '/participant/authorize', scene: 'offer' },
  { slug: 'organizer-funding', route: '/organizer/funding', scene: 'funding' },
  { slug: 'organizer-result-confirmed', route: '/organizer/result', scene: 'result-confirmed' },
  { slug: 'organizer-result-not-confirmed', route: '/organizer/result', scene: 'result-not' },
  { slug: 'participant-link', route: `/p/${MOCK_TOKEN}`, scene: 'offer' },
];

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter((candidate): candidate is string => Boolean(candidate));

function findChrome(): string | null {
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

interface ManifestRow {
  file: string;
  width: number;
  height: number;
}

async function waitForServer(baseUrl: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite dev server did not become ready at ${baseUrl}`);
}

function startVite(port: number): { child: ChildProcess; url: Promise<string> } {
  const child = spawn(process.execPath, [VITE_BIN, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const url = new Promise<string>((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Vite did not report a URL in time. Output:\n${output}`)), 20_000);
    const onData = (chunk: Buffer): void => {
      output += chunk.toString();
      const match = /https?:\/\/(?:127\.0\.0\.1|localhost):(\d+)\//.exec(output);
      if (match) {
        clearTimeout(timer);
        resolve(`http://127.0.0.1:${match[1]}`);
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Vite exited with code ${code ?? 'null'} before reporting a URL. Output:\n${output}`));
    });
  });
  return { child, url };
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 4_000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

async function main(): Promise<void> {
  const chromePath = findChrome();
  if (!chromePath) {
    console.log('Skipped screenshots: no Chrome/Chromium found.');
    console.log('Install Google Chrome or set CHROME_PATH=/path/to/chrome and run `npm run capture-shots` again.');
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });

  let server: ChildProcess | null = null;
  let browser: Browser | null = null;
  const manifest: ManifestRow[] = [];

  try {
    let baseUrl = process.env.BASE_URL ?? '';
    if (!baseUrl) {
      const port = Number(process.env.SHOT_PORT ?? 5180);
      const { child, url } = startVite(Number.isFinite(port) ? port : 5180);
      server = child;
      baseUrl = await url;
      await waitForServer(baseUrl);
      console.log(`Started Vite dev server at ${baseUrl}`);
    } else {
      await waitForServer(baseUrl);
      console.log(`Using running server at ${baseUrl}`);
    }

    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: [
      // CI/agent environments often forbid Chrome's own sandbox and GPU process.
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
    ],
    });

    for (const shot of SHOTS) {
      for (const width of WIDTHS) {
        const page = await browser.newPage();
        try {
          await page.setViewport({ width, height: width === 1440 ? 1000 : 900, deviceScaleFactor: 1 });
          const url = `${baseUrl}${shot.route}?mock=1&scene=${encodeURIComponent(shot.scene)}`;
          await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
          await page.waitForSelector('main h1, main .empty__title', { timeout: 20_000 });
          await page.waitForFunction(() => !document.querySelector('main .loading'), { timeout: 10_000 });
          await new Promise((resolve) => setTimeout(resolve, 200));

          const pageHeight = await page.evaluate(() =>
            Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
          );
          const file = path.join(OUT_DIR, `${shot.slug}-${width}.png`);
          await page.screenshot({ path: file as `${string}.png`, fullPage: true });
          manifest.push({ file: path.relative(ROOT, file), width, height: pageHeight });
          console.log(`Captured ${path.relative(ROOT, file)} (${width}×${pageHeight})`);
        } finally {
          await page.close();
        }
      }
    }

    const manifestPath = path.join(OUT_DIR, 'manifest.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    console.log('\nScreenshot manifest');
    console.log('-------------------');
    for (const row of manifest) {
      console.log(`${row.file}\t${row.width}\t${row.height}`);
    }
    console.log(`\nWrote ${manifest.length} screenshots + manifest.json to ${path.relative(ROOT, OUT_DIR)}`);
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
    if (server) {
      await stopChild(server);
      console.log('Stopped the Vite dev server.');
    }
  }
}

main().catch((error: unknown) => {
  console.error('Screenshot capture failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
