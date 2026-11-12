/* Shared no-network fixtures for AI tests: app config, fake LLM clients, budgets. */

import type { AiMode } from '../../src/shared/api.js';
import type { AppConfig } from '../../src/server/config.js';
import { attachDailyBudget, dailyBudgetOf } from '../../src/server/ai/provider.js';
import type { LlmClient, LlmDailyBudget, LlmResult } from '../../src/server/ai/provider.js';

export function makeCfg(overrides: { llm?: Partial<AppConfig['llm']> } = {}): AppConfig {
  return {
    rootDir: '/tmp/gatherready',
    port: 5180,
    publicBaseUrl: 'http://127.0.0.1:5180',
    dbPath: '/tmp/gatherready.db',
    secretsPath: '/tmp/gatherready-secrets/access.json',
    hasSecrets: false,
    paypal: {
      environment: 'missing',
      live: false,
      forceSimulated: true,
      baseUrl: 'https://api-m.sandbox.paypal.com',
      clientId: '',
      clientSecret: '',
      jsClientId: null,
      webhookId: '',
      merchantEmail: '',
      buyerEmail: '',
      buyerPassword: '',
    },
    llm: {
      provider: 'none',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      apiKey: '',
      maxCallsPerDay: 400,
      timeoutMs: 12000,
      ...overrides.llm,
    },
    demo: { isolatedTenants: true, workshopOffsetDays: 9 },
    webDist: '/tmp/gatherready/dist/web',
  };
}

export interface FakeLlmOptions {
  enabled?: boolean;
  provider?: string;
  model?: string;
  mode?: AiMode;
  /** Returned in order, one per `complete` call; when exhausted the call fails `empty`. */
  results?: LlmResult[];
  /** Convenience: successful text answers, one per call. */
  texts?: string[];
}

export interface FakeLlm extends LlmClient {
  calls: Array<{ system: string; user: string; maxTokens?: number; timeoutMs?: number }>;
}

export function fakeLlm(options: FakeLlmOptions = {}): FakeLlm {
  const calls: FakeLlm['calls'] = [];
  const results = options.results ? options.results.slice() : null;
  const texts = options.texts ? options.texts.slice() : [];
  const client: LlmClient = {
    enabled: options.enabled ?? true,
    provider: options.provider ?? 'fake',
    model: options.model ?? 'fake-model',
    mode: options.mode ?? 'live',
    async complete(req): Promise<LlmResult> {
      calls.push({ system: req.system, user: req.user, maxTokens: req.maxTokens, timeoutMs: req.timeoutMs });
      if (results) {
        const next = results.shift();
        return next ?? { ok: false, kind: 'empty', message: 'no more fake responses' };
      }
      const text = texts.shift();
      if (text === undefined) return { ok: false, kind: 'empty', message: 'no more fake responses' };
      return { ok: true, text };
    },
  };
  return Object.assign(client, { calls });
}

/** Attach a shared daily budget, mirroring what createLlm does for real clients. */
export function withBudget<T extends LlmClient>(client: T, budget: LlmDailyBudget): T {
  return attachDailyBudget(client, budget) as T;
}

export function fixedDayBudget(cfg: AppConfig, day = '2026-11-12'): LlmDailyBudget {
  return dailyBudgetOf(cfg, () => `${day}T10:00:00Z`);
}

export const SLOT_DEFS = [
  { id: 'slot_a', label: 'Saturday, November 21, 2026 · 10:00–12:00 (America/Los_Angeles)' },
  { id: 'slot_b', label: 'Saturday, November 21, 2026 · 13:00–15:00 (America/Los_Angeles)' },
  { id: 'slot_c', label: 'Sunday, November 22, 2026 · 10:00–12:00 (America/Los_Angeles)' },
];

export const MERCHANT_FACT_DEFS = [
  { label: 'Materials', value: 'All clay, tools and firing are included in the $45 price.' },
  {
    label: 'Cancellation',
    value: 'If fewer than 4 people authorize, no one is charged and any temporary hold is released.',
  },
];

/** A schema-valid extraction answer for `sourceId`. */
export function extractJson(
  sourceId: string,
  overrides: {
    accepted?: string[];
    preferred?: string[];
    conditional?: Array<{ slotId: string; condition: string; quote: string }>;
    uncertainties?: Array<{ field: 'time' | 'date' | 'timezone' | 'condition' | 'other'; question: string; quote: string }>;
  } = {},
): string {
  return JSON.stringify({
    schema_version: '1',
    source_id: sourceId,
    accepted_slot_ids: overrides.accepted ?? [],
    preferred_slot_ids: overrides.preferred ?? [],
    conditional_slots: (overrides.conditional ?? []).map((condition) => ({
      slot_id: condition.slotId,
      condition: condition.condition,
      source_quote: condition.quote,
    })),
    uncertainties: (overrides.uncertainties ?? []).map((uncertainty) => ({
      field: uncertainty.field,
      question: uncertainty.question,
      source_quote: uncertainty.quote,
    })),
    requires_confirmation: true,
  });
}
