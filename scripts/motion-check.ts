/* ==========================================================================
   Motion check: proves the interaction animations exist, that expanding a
   candidate really moves the layout, and that reduced motion removes movement.
   Run with `npm run test:motion` (starts its own server on PORT 5181).
   ========================================================================== */

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.MOTION_PORT ?? 5181);
const BASE = `http://127.0.0.1:${PORT}`;

interface Result {
  name: string;
  pass: boolean;
  detail: string;
}

const results: Result[] = [];

function check(name: string, pass: boolean, detail: string): void {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/healthz`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`server did not become healthy on ${BASE}`);
}

async function main(): Promise<void> {
  const server = spawn('npx', ['tsx', 'src/server/main.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      PUBLIC_BASE_URL: BASE,
      GATHERREADY_DB: `data/motion-${Date.now()}.db`,
      LLM_OLLAMA: '0',
    },
    stdio: 'ignore',
    detached: false,
  });

  try {
    await waitForServer();

    const browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    /* landing interactions: reveal, gallery, lightbox */
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
    await sleep(700);
    const gallery = await page.evaluate(() => ({
      items: document.querySelectorAll('.gallery__item').length,
      hiddenReveals: document.querySelectorAll('[data-reveal]:not(.is-visible)').length,
    }));
    check('Gallery renders five frames', gallery.items === 5, `${gallery.items} frames`);

    await page.evaluate(() => document.querySelector('.how')?.scrollIntoView({ block: 'center' }));
    await sleep(800);
    const revealed = await page.evaluate(() => ({
      total: document.querySelectorAll('[data-reveal]').length,
      visible: document.querySelectorAll('[data-reveal].is-visible').length,
      howVisible: document.querySelector('.how')?.classList.contains('is-visible') ?? false,
    }));
    check(
      'Sections reveal on scroll',
      revealed.howVisible && revealed.visible >= 1,
      `${revealed.visible}/${revealed.total} revealed, .how visible=${revealed.howVisible}`,
    );

    await page.evaluate(() => document.querySelector('.gallery')?.scrollIntoView({ block: 'center' }));
    await sleep(400);
    await page.click('.gallery__item');
    await page.waitForSelector('.lightbox', { timeout: 2000 }).catch(() => undefined);
    const lightbox = await page.evaluate(() => ({
      open: Boolean(document.querySelector('.lightbox')),
      locked: document.body.style.overflow === 'hidden',
    }));
    check('Gallery lightbox opens and locks scroll', lightbox.open && lightbox.locked, JSON.stringify(lightbox));
    await page.keyboard.press('Escape');
    await sleep(350);
    const closed = await page.evaluate(() => !document.querySelector('.lightbox'));
    check('Lightbox closes on Escape', closed, closed ? 'closed' : 'still open');

    await page.goto(`${BASE}/organizer/setup`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      (window as unknown as { __name?: (fn: unknown) => unknown }).__name = (fn: unknown) => fn;
    });
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Load a sample'));
      button?.click();
    });
    await sleep(1600);
    await page.goto(`${BASE}/organizer/plan`, { waitUntil: 'networkidle0' });
    await sleep(500);

    /* 1. route transition exists and is short */
    const route = await page.evaluate(() => {
      const element = document.querySelector('.route-enter');
      if (!element) return null;
      const style = window.getComputedStyle(element);
      return { name: style.animationName, duration: style.animationDuration };
    });
    check(
      'Route change animates',
      Boolean(route && route.name === 'routeIn' && route.duration === '0.22s'),
      route ? `${route.name} / ${route.duration}` : 'no .route-enter',
    );

    /* 2. a candidate row expands with a real height transition */
    const before = await page.evaluate(() => {
      const row = document.querySelector('.matrix-table__row');
      return row ? row.getBoundingClientRect().height : 0;
    });
    await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>('.matrix-row-button');
      button?.click();
    });
    await sleep(420);
    const expanded = await page.evaluate(() => {
      const detail =
        (document.querySelector('.matrix-table__detail--open .matrix-detail') as HTMLElement | null) ??
        (document.querySelector('.matrix-detail--open') as HTMLElement | null);
      const chevron = document.querySelector('.matrix-row-button[aria-expanded="true"]');
      return {
        hasOpenClass: Boolean(detail),
        detailHeight: detail ? detail.getBoundingClientRect().height : 0,
        pressed: Boolean(chevron),
        transition: detail ? window.getComputedStyle(detail).transitionProperty : '',
      };
    });
    check(
      'Candidate detail expands',
      expanded.hasOpenClass && expanded.detailHeight > 80 && expanded.pressed,
      `detail ${Math.round(expanded.detailHeight)}px, transition ${expanded.transition.slice(0, 40)}`,
    );

    /* the expanded people fade in with a stagger */
    const stagger = await page.evaluate(() =>
      [...document.querySelectorAll('.matrix-table__detail--open .matrix-person')].map((person) => {
        const style = window.getComputedStyle(person);
        return { name: style.animationName, delay: style.animationDelay };
      }),
    );
    check(
      'Expanded people stagger in',
      stagger.length > 0 && stagger.every((item) => item.name === 'personIn') && new Set(stagger.map((item) => item.delay)).size > 1,
      `${stagger.length} people, delays ${stagger.map((item) => item.delay).join('/')}`,
    );

    /* 3. collapse moves back to zero height */
    await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>('.matrix-row-button[aria-expanded="true"]');
      button?.click();
    });
    await sleep(360);
    const collapsed = await page.evaluate(() => {
      const detail = document.querySelector('.matrix-detail') as HTMLElement | null;
      return detail ? detail.getBoundingClientRect().height : -1;
    });
    check('Candidate detail collapses', collapsed >= 0 && collapsed < 8, `detail ${collapsed}px after collapse`);

    /* 4. avatar pulse and rail value pop are wired */
    const classes = await page.evaluate(() => {
      const avatar = document.querySelector('.avatar');
      const rail = document.querySelector('.rail');
      if (!avatar || !rail) return null;
      avatar.classList.add('avatar--pulse');
      rail.classList.add('rail--changed');
      const avatarAnimation = window.getComputedStyle(avatar).animationName;
      const railAnimation = window.getComputedStyle(rail.querySelector('.rail__value')!).animationName;
      avatar.classList.remove('avatar--pulse');
      rail.classList.remove('rail--changed');
      return { avatarAnimation, railAnimation };
    });
    check(
      'Avatar state pulse and rail value pop exist',
      Boolean(classes && classes.avatarAnimation === 'avatarPulse' && classes.railAnimation === 'valuePop'),
      JSON.stringify(classes),
    );

    /* 5. the demo menu scales from its trigger */
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('.demo-bar__screens-toggle')?.click();
    });
    await sleep(220);
    const menu = await page.evaluate(() => {
      const element = document.querySelector('.demo-bar__screens-menu') as HTMLElement | null;
      return element ? { animation: window.getComputedStyle(element).animationName, origin: window.getComputedStyle(element).transformOrigin } : null;
    });
    check(
      'Screens menu animates from its trigger',
      Boolean(menu && menu.animation === 'menuIn'),
      menu ? `${menu.animation} / origin ${menu.origin}` : 'no menu',
    );

    /* screenshot of the open state for the record */
    await mkdir('docs/screenshots', { recursive: true });
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('.demo-bar__screens-toggle')?.click();
      const button = document.querySelector<HTMLButtonElement>('.matrix-row-button');
      button?.click();
    });
    await sleep(380);
    await page.screenshot({ path: 'docs/screenshots/motion-expanded-1280.png', fullPage: false });

    /* 6. reduced motion: no movement, no long animations */
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(`${BASE}/organizer/plan`, { waitUntil: 'networkidle0' });
    await sleep(200);
    const reduced = await page.evaluate(() => {
      const animations = document.getAnimations().map((animation) => {
        const timing = animation.effect?.getComputedTiming();
        return Number(timing?.duration ?? 0);
      });
      const detail = document.querySelector('.matrix-detail') as HTMLElement | null;
      const button = document.querySelector('.btn') as HTMLElement | null;
      return {
        maxDuration: animations.length > 0 ? Math.max(...animations) : 0,
        detailTransition: detail ? parseFloat(window.getComputedStyle(detail).transitionDuration) : 0,
        buttonTransition: button ? parseFloat(window.getComputedStyle(button).transitionDuration) : 0,
      };
    });
    check(
      'Reduced motion removes movement',
      reduced.maxDuration <= 250 && reduced.detailTransition <= 20 && reduced.buttonTransition <= 20,
      `max opacity fade ${Math.round(reduced.maxDuration)}ms, movement transitions ${reduced.detailTransition}ms/${reduced.buttonTransition}ms`,
    );

    await browser.close();
  } finally {
    server.kill('SIGTERM');
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    passed: results.filter((item) => item.pass).length,
    total: results.length,
    results,
  };
  await writeFile('docs/motion-check.json', `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const failed = results.filter((item) => !item.pass);
  if (failed.length > 0) {
    console.error(`\n${failed.length} motion check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log(`\nMotion checks passed — ${results.length}/${results.length}. Wrote docs/motion-check.json.`);
  }
}

main().catch((error: unknown) => {
  console.error('motion check failed:', error);
  process.exitCode = 1;
});
