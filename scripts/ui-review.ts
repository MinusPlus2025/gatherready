/**
 * UI/UX + interaction-motion review harness.
 *
 * Why: "looks fine" is not a review. This script runs the real built UI in Chrome and
 * measures the things a design review actually checks: accessibility (axe-core),
 * overflow at phone/tablet/desktop widths, tap-target size, focus ring, layout shift,
 * hover response, entrance motion, and whether `prefers-reduced-motion` is respected.
 *
 * It writes a machine-readable JSON plus a readable report to docs/ui-review.md.
 *
 * Requires a running server with the built UI:
 *   npm run build && npm start
 *   npx tsx scripts/ui-review.ts
 * (CHROME_PATH optional on macOS; UI_BASE to point at another host.)
 */
import { existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.UI_BASE ?? 'http://localhost:5180';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const AXE = path.join(ROOT, 'node_modules', 'axe-core', 'axe.min.js');
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'small-phone', width: 320, height: 700 },
];

interface Finding {
  state: string;
  viewport: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  detail: string;
}

const findings: Finding[] = [];
const metrics: Record<string, unknown> = {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function add(state: string, viewport: string, severity: Finding['severity'], category: string, detail: string): void {
  findings.push({ state, viewport, severity, category, detail });
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
        return { status: res.status, json: text ? JSON.parse(text) : null };
      } catch {
        return { status: res.status, json: null };
      }
    },
    method,
    route,
    body,
  );
}

/** Bring the session to a screen worth reviewing, then return its route. */
async function setLocale(page: Page, locale: 'en' | 'zh'): Promise<void> {
  await page.evaluate((value) => window.localStorage.setItem('gatherready.locale', value), locale);
}

async function prepareState(
  page: Page,
  state: 'landing' | 'setup' | 'plan' | 'offer' | 'preferences' | 'authorize' | 'landing-zh' | 'plan-zh',
): Promise<string> {
  if (state === 'landing' || state === 'landing-zh') {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
    if (state === 'landing-zh') {
      await setLocale(page, 'zh');
      await page.reload({ waitUntil: 'networkidle0' });
    }
    return '/';
  }
  if (state === 'setup') {
    await page.goto(`${BASE}/organizer/setup`, { waitUntil: 'networkidle0' });
    return '/organizer/setup';
  }
  const current = await api(page, 'GET', '/api/state');
  if (!current.json?.workshop) await api(page, 'POST', '/api/workshop', { sample: true });

  if (state === 'plan' || state === 'plan-zh') {
    await page.goto(`${BASE}/organizer/plan`, { waitUntil: 'networkidle0' });
    if (state === 'plan-zh') {
      await setLocale(page, 'zh');
      await page.reload({ waitUntil: 'networkidle0' });
    }
    return '/organizer/plan';
  }
  if (state === 'offer') {
    await page.goto(`${BASE}/organizer/offer`, { waitUntil: 'networkidle0' });
    return '/organizer/offer';
  }

  // structured preference for Diego, then the offer, so the participant screens are real
  const fresh = await api(page, 'GET', '/api/state');
  const diego = fresh.json.participants.find((p: any) => p.displayName === 'Diego');
  await api(page, 'POST', '/api/demo/view', { participantId: diego.id });
  if (state === 'preferences') {
    await page.goto(`${BASE}/participant/preferences`, { waitUntil: 'networkidle0' });
    return '/participant/preferences';
  }

  await api(page, 'POST', '/api/preferences/parse', {
    sourceText: "I'd prefer the afternoon session on Saturday. If all the materials are included I could maybe do Saturday morning too.",
    structured: {
      acceptedSlotIds: ['slot_b'],
      preferredSlotIds: [],
      conditions: [{ slotId: 'slot_a', condition: 'all the materials are included' }],
    },
  });
  const parsed = await api(page, 'GET', '/api/state');
  const pref = parsed.json.preferences.find((p: any) => p.participantId === diego.id);
  await api(page, 'POST', '/api/preferences/confirm', {
    version: pref.version,
    acceptedSlotIds: pref.acceptedSlotIds,
    preferredSlotIds: pref.preferredSlotIds,
    conditions: pref.conditions.map((c: any) => ({ slotId: c.slotId, condition: c.condition, sourceQuote: c.sourceQuote })),
    uncertainties: pref.uncertainties,
  });
  await api(page, 'POST', '/api/demo/view', { participantId: null });
  const proposed = await api(page, 'POST', '/api/clarifications/propose', {});
  const clarification = proposed.json?.clarifications?.[0];
  if (clarification) await api(page, 'POST', `/api/clarifications/${clarification.id}/send`, {});
  await api(page, 'POST', '/api/demo/view', { participantId: diego.id });
  const answered = await api(page, 'POST', `/api/clarifications/${clarification?.id}/answer`, { answer: 'YES' });
  if (answered.status !== 200) throw new Error(`could not answer clarification: ${JSON.stringify(answered.json)}`);
  await api(page, 'POST', '/api/demo/view', { participantId: null });
  const plan = await api(page, 'GET', '/api/state');
  const published = await api(page, 'POST', '/api/offers/publish', { slotId: plan.json.plan.workableSlotId });
  if (published.status !== 200) throw new Error(`could not publish offer: ${JSON.stringify(published.json)}`);
  await api(page, 'POST', '/api/demo/view', { participantId: diego.id });
  await page.goto(`${BASE}/participant/authorize`, { waitUntil: 'networkidle0' });
  return '/participant/authorize';
}

async function auditViewport(page: Page, state: string, viewport: { name: string; width: number; height: number }): Promise<void> {
  const vp = viewport.name;
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(250);

  /* Let entrance/route animations settle before measuring colours and layout:
     scanning mid-fade reports false contrast failures against a translucent page. */
  await page.evaluate(async () => {
    const running = document.getAnimations().map((animation) => animation.finished.catch(() => undefined));
    await Promise.race([Promise.all(running), new Promise((resolve) => setTimeout(resolve, 900))]);
  });
  await sleep(120);

  /* accessibility: axe-core WCAG 2.1 A/AA */
  await page.addScriptTag({ path: AXE });
  const axe = await page.evaluate(async () => {
    const result = await (window as any).axe.run(document, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    });
    return result.violations.map((v: any) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  });
  for (const violation of axe) {
    add(state, vp, violation.impact === 'critical' || violation.impact === 'serious' ? 'high' : 'medium', 'a11y', `${violation.id} (${violation.nodes} node(s))`);
  }

  /* overflow at this width */
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    offenders: Array.from(document.querySelectorAll('*'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > document.documentElement.clientWidth + 1;
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`),
  }));
  if (overflow.scrollWidth > overflow.clientWidth + 1) {
    add(state, vp, 'high', 'layout', `horizontal overflow ${overflow.scrollWidth}px > ${overflow.clientWidth}px; ${overflow.offenders.join(', ')}`);
  }

  /* tap targets (interactive, visible, outside running text links) */
  const smallTargets = await page.evaluate(() => {
    const selector = 'button, [role="button"], input, select, textarea, .btn, .chip-button, .demo-bar button';
    const offenders: Array<{ label: string; html: string; minHeight: string; height: string; visibility: string }> = [];
    for (const el of Array.from(document.querySelectorAll(selector)) as HTMLElement[]) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      // Only choice controls are hit through their label; a text input's associated
      // label is the caption above it, so measuring that would be a false positive.
      const isChoice = el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio');
      const labels = (el as HTMLInputElement).labels;
      const host = isChoice && labels && labels.length > 0 ? labels[0]! : el;
      const r = host.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 44 || r.height < 44) {
        const style2 = window.getComputedStyle(el);
        const parent = el.parentElement;
        const pr = parent?.getBoundingClientRect();
        offenders.push({
          label: `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} ${Math.round(r.width)}x${Math.round(r.height)}`,
          html: el.outerHTML.slice(0, 120) + ` | offset=${el.offsetWidth}x${el.offsetHeight} client=${el.clientWidth}x${el.clientHeight} | parent=${parent?.tagName}.${(parent?.className || '').toString().split(' ')[0]} ${pr ? `${Math.round(pr.width)}x${Math.round(pr.height)}` : ''}`,
          minHeight: style2.minHeight,
          height: style2.height,
          visibility: `${style2.display}/${style2.visibility}/opacity:${style2.opacity}`,
        });
      }
    }
    return offenders.slice(0, 8);
  });
  for (const target of smallTargets) {
    add(
      state,
      vp,
      'medium',
      'touch',
      `tap target under 44px: ${target.label} [minH=${target.minHeight} h=${target.height} ${target.visibility}]`,
    );
  }

  /* clipped text and negative margins (layout smells that overflow checks miss) */
  const layoutSmells = await page.evaluate(() => {
    const clipped: string[] = [];
    const negative: string[] = [];
    for (const el of Array.from(document.querySelectorAll('p, span, h1, h2, h3, h4, label, button, a, li, dd, dt, code, div')) as HTMLElement[]) {
      const style = window.getComputedStyle(el);
      if (el.closest('.visually-hidden') || el.classList.contains('visually-hidden')) continue;
      if (el.getClientRects().length === 0) continue;
      const hiddenX = style.overflowX === 'hidden' || style.overflowX === 'clip';
      const hiddenAll = style.overflow === 'hidden' || style.overflow === 'clip';
      if ((hiddenX || hiddenAll) && style.textOverflow !== 'ellipsis') {
        if ((el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) && el.clientHeight > 4) {
          const label = `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`;
          clipped.push(`${label} content ${el.scrollWidth}x${el.scrollHeight} > box ${el.clientWidth}x${el.clientHeight}`);
        }
      }
      const marginTop = parseFloat(style.marginTop || '0');
      const marginBottom = parseFloat(style.marginBottom || '0');
      if (marginTop < -1 || marginBottom < -1) {
        negative.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} margin ${marginTop}/${marginBottom}`);
      }
    }
    return { clipped: clipped.slice(0, 8), negative: negative.slice(0, 8) };
  });
  for (const item of layoutSmells.clipped) add(state, vp, 'medium', 'layout', `clipped content: ${item}`);
  for (const item of layoutSmells.negative) add(state, vp, 'low', 'layout', `negative margin: ${item}`);

  /* focus ring on the first visible button */
  const focus = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button, .btn, a.btn')).find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) as HTMLElement | undefined;
    if (!button) return { checked: false } as const;
    button.focus();
    const style = window.getComputedStyle(button);
    return {
      checked: true,
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth || '0'),
      visible: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth || '0') >= 2,
    };
  });
  if (focus.checked && !focus.visible) add(state, vp, 'high', 'a11y', 'focused control has no visible 2px focus ring');

  /* layout shift during load */
  const cls = await page.evaluate(async () => {
    return await new Promise<number>((resolve) => {
      let value = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) value += entry.value;
        }
      });
      try {
        observer.observe({ type: 'layout-shift', buffered: true });
      } catch {
        resolve(0);
        return;
      }
      setTimeout(() => {
        observer.disconnect();
        resolve(Math.round(value * 1000) / 1000);
      }, 600);
    });
  });
  if (cls > 0.1) add(state, vp, 'medium', 'performance', `cumulative layout shift ${cls}`);

  metrics[`${state}:${vp}`] = { axe, overflow, smallTargets, layoutSmells, focus, cls };
}

async function auditMotion(page: Page): Promise<void> {
  /* entrance motion inventory + hover response */
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  await sleep(120);
  const motion = await page.evaluate(() => {
    const animations = document.getAnimations?.() ?? [];
    return {
      count: animations.length,
      durations: animations.map((a) => (a.effect as KeyframeEffect | null)?.getTiming().duration ?? 0).slice(0, 10),
      heroVisible: (() => {
        const h1 = document.querySelector('.hero__copy h1');
        if (!h1) return null;
        return window.getComputedStyle(h1).opacity;
      })(),
    };
  });
  metrics.motionInventory = motion;
  if (motion.count === 0) add('landing', 'desktop', 'low', 'motion', 'no entrance animation found');

  const hover = await page.evaluate(() => {
    const button = document.querySelector('.btn-primary') as HTMLElement | null;
    if (!button) return null;
    const before = window.getComputedStyle(button);
    return { before: { transform: before.transform, boxShadow: before.boxShadow } };
  });
  if (hover) {
    const box = await page.evaluate(() => {
      const button = document.querySelector('.btn-primary') as HTMLElement | null;
      if (!button) return null;
      const r = button.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (box) {
      await page.mouse.move(box.x, box.y);
      await sleep(250);
      const after = await page.evaluate(() => {
        const button = document.querySelector('.btn-primary') as HTMLElement | null;
        if (!button) return null;
        const style = window.getComputedStyle(button);
        return { transform: style.transform, boxShadow: style.boxShadow };
      });
      metrics.hover = { before: hover.before, after };
      if (after && hover.before.transform === after.transform && hover.before.boxShadow === after.boxShadow) {
        add('landing', 'desktop', 'low', 'motion', 'primary button has no visible hover response');
      }
    }
  }

  /* reduced motion: nothing may keep animating, nothing may stay hidden */
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(200);
  const reduced = await page.evaluate(() => {
    const animations = document.getAnimations?.() ?? [];
    const longRunning = animations.filter((a) => {
      const timing = (a.effect as KeyframeEffect | null)?.getTiming();
      return (timing?.duration ?? 0) as number > 50;
    });
    const hero = document.querySelector('.hero__copy h1');
    return {
      animations: animations.length,
      longRunning: longRunning.length,
      heroOpacity: hero ? window.getComputedStyle(hero).opacity : null,
    };
  });
  metrics.reducedMotion = reduced;
  if (reduced.longRunning > 0) add('landing', 'desktop', 'high', 'motion', `reduced-motion still runs ${reduced.longRunning} long animation(s)`);
  if (reduced.heroOpacity !== null && reduced.heroOpacity !== '1') add('landing', 'desktop', 'high', 'motion', 'content stays hidden under reduced motion');
  await page.emulateMediaFeatures([]);
}

function dedupe(items: Finding[]): Finding[] {
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const item of items) {
    const key = `${item.state}|${item.viewport}|${item.category}|${item.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function renderReport(): string {
  const order = { high: 0, medium: 1, low: 2 } as const;
  const unique = dedupe(findings);
  const sorted = unique.slice().sort((a, b) => order[a.severity] - order[b.severity]);
  const lines = [
    '# UI/UX and interaction-motion review',
    '',
    'Generated by `scripts/ui-review.ts` against the running product (built UI) on this machine.',
    'Every row is a measurement from Chrome, not an opinion. `npm run ui-review` regenerates this file.',
    '',
    `Reviewed states: landing (EN/中文), organizer setup, organizer plan (EN/中文), organizer offer, participant preferences, participant authorize.`,
    `Viewports: ${VIEWPORTS.map((v) => `${v.width}px`).join(', ')}.`,
    `Motion checks: entrance inventory, hover response, reduced-motion behaviour, focus ring, layout shift.`,
    '',
    '| Severity | State | Viewport | Category | Finding |',
    '| --- | --- | --- | --- | --- |',
  ];
  if (sorted.length === 0) {
    lines.push('| — | — | — | — | No findings: every check passed. |');
  } else {
    for (const finding of sorted) {
      lines.push(
        `| ${finding.severity.toUpperCase()} | ${finding.state} | ${finding.viewport} | ${finding.category} | ${finding.detail.replace(/\|/g, '\\|')} |`,
      );
    }
  }
  lines.push(
    '',
    '## Measurements',
    '',
    '```json',
    JSON.stringify(metrics, null, 2).slice(0, 20000),
    '```',
    '',
  );
  return lines.join('\n');
}

async function main(): Promise<void> {
  if (!existsSync(CHROME)) {
    console.log(`Chrome not found at ${CHROME}; cannot run the review.`);
    process.exit(2);
  }
  const health = await fetch(`${BASE}/healthz`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) {
    console.log(`No server at ${BASE}. Run: npm run build && npm start`);
    process.exit(2);
  }
  const browser: Browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    protocolTimeout: 240_000,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = (await browser.newPage()) as Page;
  // tsx/esbuild injects a `__name` helper for named functions; the page context
  // needs a no-op stub so evaluate() helpers do not throw ReferenceError.
  await page.evaluateOnNewDocument(() => {
    (window as unknown as { __name?: (fn: unknown) => unknown }).__name = (fn: unknown) => fn;
  });
  const consoleErrors: string[] = [];
  page.on('pageerror', (error: unknown) =>
    consoleErrors.push(`pageerror: ${error instanceof Error ? error.message.slice(0, 200) : String(error)}`),
  );
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`console: ${message.text().slice(0, 200)}`);
  });
  try {
    for (const state of [
      'landing',
      'landing-zh',
      'setup',
      'plan',
      'plan-zh',
      'offer',
      'preferences',
      'authorize',
    ] as const) {
      const route = await prepareState(page, state);
      for (const viewport of VIEWPORTS) {
        await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0' });
        await sleep(250);
        await auditViewport(page, state, viewport);
      }
    }
    await auditMotion(page);
    for (const error of consoleErrors.slice(0, 10)) add('runtime', 'desktop', 'high', 'console', error);

    await mkdir(path.join(ROOT, 'docs'), { recursive: true });
    await writeFile(path.join(ROOT, 'docs', 'ui-review.md'), renderReport(), 'utf8');
    await writeFile(
      path.join(ROOT, 'docs', 'ui-review.json'),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, findings, metrics }, null, 2)}\n`,
      'utf8',
    );

    const uniqueFindings = dedupe(findings);
    const counts = {
      high: uniqueFindings.filter((f) => f.severity === 'high').length,
      medium: uniqueFindings.filter((f) => f.severity === 'medium').length,
      low: uniqueFindings.filter((f) => f.severity === 'low').length,
    };
    console.log(`UI review: high=${counts.high} medium=${counts.medium} low=${counts.low} (${uniqueFindings.length} findings)`);
    for (const finding of uniqueFindings.filter((f) => f.severity === 'high').slice(0, 10)) {
      console.log(`HIGH  ${finding.state}/${finding.viewport} [${finding.category}] ${finding.detail}`);
    }
    console.log('Wrote docs/ui-review.md and docs/ui-review.json');
    if (counts.high > 0) process.exitCode = 1;
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('ui-review failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
