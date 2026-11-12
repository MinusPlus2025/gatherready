import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

/* ==========================================================================
   Configuration. One place that decides what is real and what is simulated.

   Safety decisions:
   - Credentials are read from a git-ignored `secrets/access.json` or from the
     environment. They are never logged, never returned by the API, never passed
     to the model.
   - The PayPal base URL must be a sandbox host or the process refuses to start.
   - When PayPal credentials are missing we do not pretend: the adapter runs in
     `simulated` mode and every response says so. Tests can force that mode.
   - The language model is optional. Without a key the app runs in structured
     baseline mode instead of faking AI output.
   ========================================================================== */

export type PaypalEnvironment = 'sandbox' | 'missing';
export type LlmProvider = 'openai' | 'gemini' | 'ollama' | 'none';

export interface AppConfig {
  rootDir: string;
  port: number;
  publicBaseUrl: string;
  dbPath: string;
  secretsPath: string;
  hasSecrets: boolean;
  paypal: {
    environment: PaypalEnvironment;
    /** `true` when real sandbox REST calls are possible. */
    live: boolean;
    /** `true` when the simulated adapter should be used even if keys exist. */
    forceSimulated: boolean;
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    /** Public id for the browser SDK (same app id); safe to expose. */
    jsClientId: string | null;
    webhookId: string;
    merchantEmail: string;
    buyerEmail: string;
    buyerPassword: string;
  };
  llm: {
    provider: LlmProvider;
    baseUrl: string;
    model: string;
    apiKey: string;
    maxCallsPerDay: number;
    timeoutMs: number;
  };
  demo: {
    /** Reset-on-visit synthetic tenants (public demo isolation). */
    isolatedTenants: boolean;
    /** Days until the synthetic demo workshop starts (relative to now). */
    workshopOffsetDays: number;
    /** Synthetic tenant text is deleted after this many days (brief §9). */
    retentionDays: number;
  };
  /** Extensions used by the UI build. */
  webDist: string;
}

const ROOT = process.cwd();

function env(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

function envBool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return /^(1|true|yes|on)$/i.test(v);
}

function readSecrets(file: string): Record<string, unknown> {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  } catch (err) {
    console.error(`[config] could not parse ${file}: ${(err as Error).message}`);
    return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/** Locate `secrets/access.json` at the repo root, or one level up (keeps it out of a clone). */
export function findSecretsPath(root: string = ROOT): string {
  const candidates = [path.join(root, 'secrets', 'access.json'), path.join(root, '..', 'secrets', 'access.json')];
  return candidates.find((p) => existsSync(p)) ?? candidates[0]!;
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const secretsPath = findSecretsPath();
  const secrets = readSecrets(secretsPath);
  const pp = asRecord(secrets.paypal);
  const llmSecrets = asRecord(secrets.llm);

  const clientId = str(pp.clientId, env('PAYPAL_CLIENT_ID'));
  const clientSecret = str(pp.clientSecret, env('PAYPAL_CLIENT_SECRET'));
  const baseUrl = env('PAYPAL_BASE_URL', 'https://api-m.sandbox.paypal.com');
  const forceSimulated = envBool('PAYPAL_FORCE_SIMULATED', false);

  // A model key may come from the secrets file (never printed) or the environment.
  const apiKey = str(llmSecrets.apiKey, env('LLM_API_KEY'));
  const rawProvider = str(llmSecrets.provider, env('LLM_PROVIDER')).toLowerCase();
  const rawBase = str(llmSecrets.baseUrl, env('LLM_BASE_URL'));
  const rawModel = str(llmSecrets.model, env('LLM_MODEL'));
  let provider: LlmProvider = 'none';
  let llmBase = rawBase;
  let model = rawModel;
  if (apiKey) {
    if (rawProvider === 'gemini' || /googleapis\.com|generativelanguage/.test(rawBase) || /^gemini/i.test(rawModel)) {
      provider = 'gemini';
      llmBase = rawBase || 'https://generativelanguage.googleapis.com/v1beta';
      model = rawModel || 'gemini-2.5-flash';
    } else {
      provider = 'openai';
      llmBase = rawBase || 'https://api.openai.com/v1';
      model = rawModel || 'gpt-4o-mini';
    }
  } else if (rawProvider === 'ollama' || envBool('LLM_OLLAMA', false)) {
    provider = 'ollama';
    llmBase = rawBase || 'http://localhost:11434';
    model = rawModel || 'qwen2.5:3b';
  }

  const port = Number(env('PORT', '5180'));

  return {
    rootDir: ROOT,
    port,
    publicBaseUrl: env('PUBLIC_BASE_URL', `http://localhost:${port}`),
    dbPath: env('GATHERREADY_DB', path.join(ROOT, 'data', 'gatherready.db')),
    secretsPath,
    hasSecrets: Boolean(clientId && clientSecret),
    paypal: {
      environment: clientId && clientSecret ? 'sandbox' : 'missing',
      live: Boolean(clientId && clientSecret) && !forceSimulated,
      forceSimulated,
      baseUrl,
      clientId,
      clientSecret,
      jsClientId: str(pp.jsClientId, env('VITE_PAYPAL_CLIENT_ID')) || (clientId || null),
      webhookId: str(pp.webhookId, env('PAYPAL_WEBHOOK_ID')),
      merchantEmail: str(pp.merchantEmail),
      buyerEmail: str(pp.buyerEmail),
      buyerPassword: str(pp.buyerPassword),
    },
    llm: {
      provider,
      baseUrl: llmBase,
      model,
      apiKey,
      maxCallsPerDay: Number(env('LLM_MAX_CALLS_PER_DAY', '400')),
      timeoutMs: Number(env('LLM_TIMEOUT_MS', '12000')),
    },
    demo: {
      isolatedTenants: envBool('DEMO_ISOLATED_TENANTS', true),
      workshopOffsetDays: Number(env('DEMO_WORKSHOP_OFFSET_DAYS', '9')),
      retentionDays: Number(env('DEMO_RETENTION_DAYS', '7')),
    },
    webDist: path.join(ROOT, 'dist', 'web'),
    ...overrides,
  };
}

/**
 * Hard guard: this project must never point at production PayPal. Called on boot
 * and again before every mutating call, so a misconfigured env cannot move money.
 */
export function assertSandbox(cfg: AppConfig): void {
  const url = cfg.paypal.baseUrl;
  if (cfg.paypal.live && !/sandbox/i.test(url)) {
    throw new Error(`refusing to run: PAYPAL_BASE_URL is not a sandbox host (${url})`);
  }
  if (url !== 'https://api-m.sandbox.paypal.com' && !/sandbox/i.test(url)) {
    throw new Error(`refusing to run: only sandbox PayPal hosts are allowed (${url})`);
  }
}
