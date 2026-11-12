/* Deployment preflight for a judge-accessible, single-instance, persistent Node
   service. Read-only: checks configuration and prints READY/BLOCKED, never prints
   secret values. It does not create accounts, services or charges. */

import { accessSync, constants, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/server/config.js';

const cfg = loadConfig();
const failures: string[] = [];
const warnings: string[] = [];

const https = cfg.publicBaseUrl.startsWith('https://');
if (!https) failures.push(`PUBLIC_BASE_URL must be https for judges (currently ${cfg.publicBaseUrl}).`);

const dbDir = path.dirname(path.resolve(cfg.dbPath));
const ephemeral = /^\/(tmp|var\/tmp|private\/tmp)\b/.test(dbDir) || dbDir.includes('/tmp/');
if (ephemeral) failures.push(`GATHERREADY_DB is under an ephemeral temp directory (${dbDir}); mount a persistent disk.`);
try {
  mkdirSync(dbDir, { recursive: true });
  accessSync(dbDir, constants.W_OK);
} catch {
  failures.push(`GATHERREADY_DB directory is not writable (${dbDir}).`);
}

if (cfg.llm.provider === 'none') {
  failures.push('No cloud model key: set LLM_PROVIDER/LLM_MODEL/LLM_API_KEY (OpenAI-compatible or Gemini).');
} else if (cfg.llm.provider === 'ollama' && /localhost|127\.0\.0\.1/.test(cfg.llm.baseUrl)) {
  failures.push('Ollama points at localhost. A cloud host cannot reach the Mac; use a hosted model API, or run the app on the Mac behind a tunnel.');
}
if (cfg.llm.maxCallsPerDay <= 0) warnings.push('LLM_MAX_CALLS_PER_DAY is not positive; set a budget for a public demo.');

if (!cfg.hasSecrets) failures.push('PayPal sandbox keys are missing (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET).');
if (cfg.paypal.forceSimulated) failures.push('PAYPAL_FORCE_SIMULATED=1 is set; remove it on a public deployment.');
if (cfg.hasSecrets && !cfg.paypal.webhookId) warnings.push('PAYPAL_WEBHOOK_ID is missing; webhook signature verification is not configured.');
if (!/^https:\/\/api-m\.sandbox\.paypal\.com\/?$/.test(cfg.paypal.baseUrl)) {
  warnings.push('PAYPAL_BASE_URL is not the sandbox REST host; confirm this is intentional.');
}

if (!cfg.demo.isolatedTenants) failures.push('DEMO_ISOLATED_TENANTS must stay enabled so visitors get separate data.');

const mode = {
  publicBaseUrl: cfg.publicBaseUrl,
  dbPath: cfg.dbPath,
  persistentDbDir: dbDir,
  model: cfg.llm.provider === 'none' ? 'missing' : `${cfg.llm.provider}:${cfg.llm.model}`,
  modelCallCapPerDay: cfg.llm.maxCallsPerDay,
  paypal: cfg.hasSecrets ? (cfg.paypal.forceSimulated ? 'forced-simulated' : 'sandbox') : 'missing',
  webhookConfigured: Boolean(cfg.paypal.webhookId),
  isolatedTenants: cfg.demo.isolatedTenants,
};

console.log(JSON.stringify({ mode, warnings, failures, ready: failures.length === 0 }, null, 2));
if (failures.length > 0) {
  console.error('BLOCKED — a judge-accessible deployment is not ready. No paid service was created.');
  process.exitCode = 1;
} else {
  console.log('READY — configuration looks deployable. Still verify persistence, two visitors and real sandbox calls after deploy.');
}
