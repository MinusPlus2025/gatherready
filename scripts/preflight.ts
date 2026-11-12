/**
 * Preflight — what is actually real on this machine, before anything is claimed.
 *
 * Prints a checklist and exits non-zero only for conditions that would make the
 * server unsafe or unusable (non-sandbox PayPal URL, unwritable DB dir, wrong
 * Node version). Missing credentials are reported as degraded, not as failures.
 */
import { existsSync, accessSync, constants } from 'node:fs';
import path from 'node:path';
import { loadConfig, assertSandbox } from '../src/server/config.js';

interface Line {
  ok: boolean | 'warn';
  label: string;
  detail: string;
}
const lines: Line[] = [];
function add(ok: boolean | 'warn', label: string, detail: string): void {
  lines.push({ ok, label, detail });
}

const [major, minor] = process.versions.node.split('.').map(Number) as [number, number];
add(major > 22 || (major === 22 && minor >= 5), 'Node.js >= 22.5', `found ${process.versions.node}`);

let cfg;
try {
  cfg = loadConfig();
  add(true, 'config loaded', `root ${cfg.rootDir}`);
} catch (err) {
  add(false, 'config loaded', err instanceof Error ? err.message : String(err));
  report();
  process.exit(1);
}

try {
  assertSandbox(cfg);
  add(true, 'PayPal host is sandbox-only', cfg.paypal.baseUrl);
} catch (err) {
  add(false, 'PayPal host is sandbox-only', err instanceof Error ? err.message : String(err));
}

add(
  cfg.paypal.live ? true : 'warn',
  'PayPal credentials',
  cfg.paypal.live
    ? 'sandbox REST app configured (real sandbox authorization/capture/void/refund path)'
    : 'missing — simulated adapter; UI labels it. Add via: node scripts/setup-access.mjs',
);
add(
  cfg.llm.provider !== 'none' ? true : 'warn',
  'language model',
  cfg.llm.provider !== 'none'
    ? `${cfg.llm.provider} / ${cfg.llm.model}`
    : 'missing — structured baseline plus checked-in recorded sample; UI labels it',
);

const dbDir = path.dirname(cfg.dbPath);
try {
  const { mkdirSync } = await import('node:fs');
  mkdirSync(dbDir, { recursive: true });
  accessSync(dbDir, constants.W_OK);
  add(true, 'database directory writable', cfg.dbPath);
} catch (err) {
  add(false, 'database directory writable', err instanceof Error ? err.message : String(err));
}

add(existsSync(cfg.webDist) ? true : 'warn', 'built UI', existsSync(cfg.webDist) ? cfg.webDist : 'not built yet — run `npm run build`');
add(existsSync(path.join(cfg.rootDir, '.gitignore')) ? true : 'warn', '.gitignore present', 'secrets/ and data/ must stay untracked');
add(existsSync(path.join(cfg.rootDir, 'secrets', 'access.json')) ? true : 'warn', 'secrets file', existsSync(path.join(cfg.rootDir, 'secrets', 'access.json')) ? 'present (git-ignored; never printed)' : 'absent (expected until credentials are supplied)');

report();

function report(): void {
  for (const line of lines) {
    const tag = line.ok === true ? 'OK  ' : line.ok === 'warn' ? 'WARN' : 'FAIL';
    console.log(`${tag}  ${line.label}${line.detail ? ` — ${line.detail}` : ''}`);
  }
  const failures = lines.filter((l) => l.ok === false).length;
  console.log(
    failures === 0
      ? '\npreflight passed (degraded-mode warnings do not block the run)'
      : `\npreflight failed: ${failures} blocking issue(s)`,
  );
  if (failures > 0) process.exitCode = 1;
}
