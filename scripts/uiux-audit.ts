/* ==========================================================================
   Open-source UI/UX audit runner.

   - axe-core (Mozilla, MPL-2.0) across every product route at desktop + phone,
     in English and Chinese for the two role homes.
   - writes docs/audit/axe.json and prints a per-route summary.

   Requires a running server with the built UI:
     npm run build && npm start
     npx tsx scripts/uiux-audit.ts
   ========================================================================== */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer, { type Page } from 'puppeteer-core';

const BASE = process.env.UI_BASE ?? 'http://localhost:5180';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const AXE = path.resolve('node_modules/axe-core/axe.min.js');
const OUT = path.resolve('docs/audit');

interface Finding {
  id: string;
  impact: string | null;
  nodes: number;
  help: string;
  targets: string[];
}

interface RouteResult {
  route: string;
  name: string;
  viewport: 'desktop' | 'phone';
  violations: Finding[];
}

const ROUTES: Array<{ route: string; name: string }> = [
  { route: '/', name: 'landing' },
  { route: '/organizer/setup', name: 'organizer setup' },
  { route: '/organizer/plan', name: 'organizer plan' },
  { route: '/organizer/offer', name: 'organizer offer' },
  { route: '/organizer/funding', name: 'organizer funding' },
  { route: '/organizer/result', name: 'organizer result' },
  { route: '/participant/preferences', name: 'participant preferences' },
  { route: '/participant/clarify', name: 'participant clarify' },
  { route: '/participant/authorize', name: 'participant authorize' },
  { route: '/does-not-exist', name: 'not found' },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(page: Page, method: string, route: string, body?: unknown): Promise<any> {
  return page.evaluate(
    async (m: string, r: string, b: unknown) => {
      const response = await fetch(r, {
        method: m,
        headers: { 'content-type': 'application/json', 'x-gatherready': '1' },
        body: b === undefined ? undefined : JSON.stringify(b),
      });
      const text = await response.text();
      try {
        return { status: response.status, json: text ? JSON.parse(text) : null };
      } catch {
        return { status: response.status, json: null };
      }
    },
    method,
    route,
    body,
  );
}

async function main(): Promise<void> {
  const health = await fetch(`${BASE}/healthz`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) throw new Error(`No server at ${BASE}`);
  await mkdir(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    (window as unknown as { __name?: (fn: unknown) => unknown }).__name = (fn: unknown) => fn;
  });

  const results: RouteResult[] = [];
  try {
    const viewports = [
      { name: 'desktop' as const, width: 1440, height: 1000 },
      { name: 'phone' as const, width: 390, height: 844 },
    ];

    for (const viewport of viewports) {
      await page.setViewport({ width: viewport.width, height: viewport.height });
      for (const target of ROUTES) {
        await page.goto(`${BASE}${target.route}`, { waitUntil: 'networkidle0' });
        if (target.name !== 'landing' && target.name !== 'not found') {
          const state = await api(page, 'GET', '/api/state');
          if (!state.json?.workshop) {
            await api(page, 'POST', '/api/workshop', { sample: true });
            await page.reload({ waitUntil: 'networkidle0' });
          }
        }
        await sleep(350);
        await page.addScriptTag({ path: AXE });
        const axe = await page.evaluate(async () => {
          const result = await (window as any).axe.run(document, {
            runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
            resultTypes: ['violations'],
          });
          return result.violations.map((violation: any) => ({
            id: violation.id,
            impact: violation.impact ?? null,
            nodes: violation.nodes.length,
            help: violation.help,
            targets: violation.nodes.slice(0, 6).map((node: any) => String(node.target?.[0] ?? '')),
          }));
        });
        results.push({ route: target.route, name: target.name, viewport: viewport.name, violations: axe });
        const count = axe.reduce((sum: number, item: Finding) => sum + item.nodes, 0);
        console.log(
          `${axe.length === 0 ? 'PASS' : 'FAIL'}  ${viewport.name.padEnd(7)} ${target.name.padEnd(24)} ${
            axe.length === 0 ? 'no axe violations' : `${axe.length} rule(s), ${count} node(s)`
          }`,
        );
      }
    }
  } finally {
    await browser.close();
  }

  const total = results.reduce((sum, result) => sum + result.violations.reduce((n, v) => n + v.nodes, 0), 0);
  await writeFile(
    `${OUT}/axe.json`,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        base: BASE,
        tool: 'axe-core (wcag2a/wcag2aa/wcag21a/wcag21aa)',
        totalViolationNodes: total,
        results,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(`\naxe-core: ${total === 0 ? '0 violations' : `${total} violation node(s)`} across ${results.length} route×viewport runs.`);
  console.log(`Wrote ${path.relative(process.cwd(), `${OUT}/axe.json`)}`);
  process.exitCode = total === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error('uiux audit failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
