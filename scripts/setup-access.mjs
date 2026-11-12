#!/usr/bin/env node
/**
 * GatherReady — local credential setup.
 *
 * Why this exists: keys must never go into the chat, the repo, screenshots or the
 * video. This script writes a git-ignored file that only the running server reads,
 * with 0600 permissions, and never echoes a secret back.
 *
 * Usage:
 *   node scripts/setup-access.mjs           # interactive
 *   node scripts/setup-access.mjs --check   # show which parts are configured
 *
 * Sandbox only. These credentials cannot move real money; the app also refuses to
 * boot against any non-sandbox PayPal host.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import path from 'node:path';

const ROOT = process.cwd();
const SECRETS_DIR = path.join(ROOT, 'secrets');
const SECRETS_PATH = path.join(SECRETS_DIR, 'access.json');

function loadSecrets() {
  if (!existsSync(SECRETS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SECRETS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function check() {
  const s = loadSecrets();
  const pp = s.paypal ?? {};
  const llm = s.llm ?? {};
  const envPp = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  const envLlm = Boolean(process.env.LLM_API_KEY);
  console.log('GatherReady credential check (values are never printed)');
  console.log(`  secrets file:        ${existsSync(SECRETS_PATH) ? SECRETS_PATH : 'missing'}`);
  console.log(`  PayPal client id:    ${pp.clientId || envPp ? 'configured' : 'missing'}`);
  console.log(`  PayPal client secret:${pp.clientSecret || envPp ? ' configured' : ' missing'}`);
  console.log(`  PayPal webhook id:   ${pp.webhookId || process.env.PAYPAL_WEBHOOK_ID ? 'configured' : 'missing (optional until webhooks are delivered)'}`);
  console.log(`  Model key:           ${llm.apiKey || envLlm ? 'configured' : 'missing (structured baseline will be used)'}`);
  console.log(`  git-ignored:         ${isIgnored() ? 'yes' : 'NO — check .gitignore before committing'}`);
  process.exit(0);
}

function isIgnored() {
  const ignore = path.join(ROOT, '.gitignore');
  if (!existsSync(ignore)) return false;
  return readFileSync(ignore, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .some((l) => l === 'secrets/' || l === 'secrets' || l === 'secrets/*');
}

async function main() {
  if (process.argv.includes('--check')) check();
  if (!existsSync(path.join(ROOT, 'package.json')) || readFileSync(path.join(ROOT, 'package.json'), 'utf8').includes('"gatherready"') === false) {
    console.warn('warning: run this from the gatherready project root.');
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Interactive setup requires a local terminal. Use --check for non-interactive status.');
  }
  if (!isIgnored()) throw new Error('secrets/ must be git-ignored before saving credentials.');
  let muted = false;
  const safeOutput = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  safeOutput.isTTY = true;
  const rl = createInterface({ input: process.stdin, output: safeOutput, terminal: true });
  async function hiddenQuestion(prompt) {
    const answer = rl.question(prompt);
    muted = true;
    try { return await answer; }
    finally { muted = false; process.stdout.write('\n'); }
  }
  console.log('GatherReady setup — sandbox credentials only. Press Enter to keep an existing value or skip.');
  const existing = loadSecrets();
  const pp = existing.paypal ?? {};
  const llm = existing.llm ?? {};

  const clientId = (await rl.question(`PayPal sandbox client ID${pp.clientId ? ' [kept]' : ''}: `)).trim() || pp.clientId || '';
  const clientSecret = (await hiddenQuestion(`PayPal sandbox client secret${pp.clientSecret ? ' [kept]' : ''}: `)).trim() || pp.clientSecret || '';
  const webhookId = (await rl.question(`PayPal webhook ID (optional, press Enter to skip): `)).trim() || pp.webhookId || '';
  const merchantEmail = (await rl.question(`Sandbox business account email (optional, for your own reference): `)).trim() || pp.merchantEmail || '';
  const paypalOnly = process.argv.includes('--paypal-only');
  const llmKey = paypalOnly ? (llm.apiKey || '') : (await hiddenQuestion(`Model API key (optional; Enter = structured baseline): `)).trim() || llm.apiKey || '';
  const llmProvider = paypalOnly ? (llm.provider || 'openai') : (await rl.question(`Model provider (openai|gemini|ollama) [${llm.provider || 'openai'}]: `)).trim() || llm.provider || 'openai';
  const llmModel = paypalOnly ? (llm.model || 'gpt-4o-mini') : (await rl.question(`Model name [${llm.model || 'gpt-4o-mini'}]: `)).trim() || llm.model || 'gpt-4o-mini';
  const llmBaseUrl = paypalOnly ? (llm.baseUrl || '') : (await rl.question(`Model base URL (optional): `)).trim() || llm.baseUrl || '';
  rl.close();

  if (!clientId || !clientSecret) {
    console.log('\nNo PayPal credentials entered — the app will run in SIMULATED mode and label it in the UI.');
  }
  mkdirSync(SECRETS_DIR, { recursive: true });
  const payload = {
    ...existing,
    paypal: { ...pp, clientId: clientId || '', clientSecret: clientSecret || '', webhookId: webhookId || '', merchantEmail: merchantEmail || '' },
    llm: paypalOnly ? llm : { apiKey: llmKey || '', provider: llmProvider, model: llmModel, baseUrl: llmBaseUrl },
  };
  writeFileSync(SECRETS_PATH, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  chmodSync(SECRETS_PATH, 0o600);
  if (!isIgnored()) {
    console.error('\nERROR: secrets/ is not in .gitignore — fix .gitignore before running git add.');
    process.exit(1);
  }
  console.log(`\nWrote ${SECRETS_PATH} (0600, git-ignored).`);
  console.log('Restart the server, then check: npm run verify');
  console.log('`npm run verify` uses simulated payments; it is not real PayPal Sandbox evidence.');
  console.log('For real Sandbox checks, run `npm run paypal-preflight`, then `npm run sandbox-spine` in an interactive terminal for buyer approval.');
}

main().catch((err) => {
  console.error('setup failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
