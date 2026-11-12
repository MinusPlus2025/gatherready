#!/usr/bin/env node
/**
 * Save one PayPal sandbox credential from the macOS clipboard into the
 * git-ignored secrets file — no typing, no echo, no chat.
 *
 * Why: when you are driving this from a GUI session, pasting a client secret into
 * an interactive prompt is the easiest way to leak it into a screenshot or screen
 * recording. Copying it to the clipboard and running one short command keeps the
 * value out of the terminal and out of shell history.
 *
 * Usage (copy the value first, then run one line):
 *   node scripts/setup-access-clipboard.mjs client-id
 *   node scripts/setup-access-clipboard.mjs client-secret
 *   node scripts/setup-access-clipboard.mjs webhook-id        # optional
 *   node scripts/setup-access-clipboard.mjs merchant-email   # optional
 *   node scripts/setup-access-clipboard.mjs clear            # clear the clipboard
 *
 * It never prints the value, only which field was written and the file mode.
 * Sandbox credentials only. The app refuses to run against live PayPal.
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SECRETS_DIR = path.join(ROOT, 'secrets');
const SECRETS_PATH = path.join(SECRETS_DIR, 'access.json');

const FIELDS = {
  'client-id': { path: ['paypal', 'clientId'], label: 'PayPal sandbox client id', pattern: /^[A-Za-z0-9_-]{20,200}$/ },
  'client-secret': {
    path: ['paypal', 'clientSecret'],
    label: 'PayPal sandbox client secret',
    pattern: /^[A-Za-z0-9_.-]{20,300}$/,
  },
  'webhook-id': { path: ['paypal', 'webhookId'], label: 'PayPal webhook id', pattern: /^[A-Za-z0-9_-]{6,120}$/ },
  'merchant-email': {
    path: ['paypal', 'merchantEmail'],
    label: 'sandbox business email (reference only)',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
};

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function clipboard() {
  try {
    return execFileSync('pbpaste', { encoding: 'utf8' }).trim();
  } catch {
    fail('could not read the clipboard (pbpaste). On non-macOS, use: node scripts/setup-access.mjs');
  }
}

function clearClipboard() {
  try {
    execFileSync('pbcopy', { input: '' });
    console.log('Clipboard cleared.');
  } catch {
    fail('could not clear the clipboard.');
  }
}

function loadSecrets() {
  if (!existsSync(SECRETS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SECRETS_PATH, 'utf8'));
  } catch {
    fail(`${SECRETS_PATH} is not valid JSON. Fix or delete it, then retry.`);
  }
}

function isIgnored() {
  const ignore = path.join(ROOT, '.gitignore');
  if (!existsSync(ignore)) return false;
  return readFileSync(ignore, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === 'secrets/' || line === 'secrets' || line === 'secrets/*');
}

const kind = process.argv[2];
if (!kind || kind === 'help' || kind === '--help') {
  console.log('Usage: node scripts/setup-access-clipboard.mjs <client-id|client-secret|webhook-id|merchant-email|clear>');
  process.exit(0);
}
if (kind === 'clear') {
  clearClipboard();
  process.exit(0);
}

const field = FIELDS[kind];
if (!field) fail(`unknown field "${kind}"`);

if (!isIgnored()) fail('secrets/ is not in .gitignore — refusing to write credentials');

const value = clipboard();
if (!value) fail('the clipboard is empty. Copy the value from the PayPal dashboard first.');
if (/\s/.test(value)) fail('the clipboard contains whitespace/newlines — copy only the value itself.');
if (!field.pattern.test(value)) {
  fail(`that does not look like a ${field.label}. Copy the exact value from the PayPal dashboard.`);
}

const secrets = loadSecrets();
const [section, key] = field.path;
const target = secrets[section] ?? {};
target[key] = value;
secrets[section] = target;

mkdirSync(SECRETS_DIR, { recursive: true });
writeFileSync(SECRETS_PATH, `${JSON.stringify(secrets, null, 2)}\n`, { mode: 0o600 });
chmodSync(SECRETS_PATH, 0o600);
console.log(`Saved ${field.label} to ${path.relative(ROOT, SECRETS_PATH)} (0600, git-ignored).`);
console.log('Value not printed. Run `node scripts/setup-access-clipboard.mjs clear` to clear the clipboard.');
