/* ==========================================================================
   Model client (CONTRACT §3.5)

   Safety decisions:
   - One HTTP attempt per `complete` call; callers own the single bounded retry.
     Every failure is a typed failure (`disabled|timeout|http|empty`), never text.
   - With no provider configured the client is disabled and says so; it never
     fabricates a "live" answer.
   - No logging of prompts, participant text, or API keys anywhere in this file.
   - A per-UTC-day call budget is attached to the client via an internal symbol
     (the public `LlmClient` shape in the contract is unchanged) so ai/extract.ts
     can bound spend without receiving `AppConfig`.
   ========================================================================== */

import type { AiMode } from '../../shared/api.js';
import type { AppConfig } from '../config.js';
import { nowIso } from '../../shared/time.js';

export type LlmResult =
  | { ok: true; text: string }
  | { ok: false; kind: 'disabled' | 'timeout' | 'http' | 'empty'; message: string };

export interface LlmClient {
  readonly enabled: boolean;
  readonly provider: string;
  readonly model: string;
  readonly mode: AiMode;
  complete(req: {
    system: string;
    user: string;
    maxTokens?: number;
    timeoutMs?: number;
  }): Promise<LlmResult>;
}

export interface LlmDailyBudget {
  readonly maxCallsPerDay: number;
  usedToday(): number;
  /** Consume one call slot. False when today's cap is reached. */
  tryConsume(): boolean;
}

/* ------------------------------ daily budget ----------------------------- */

const BUDGET_KEY = Symbol.for('gatherready.llm.budget');
type BudgetCarrier = { [BUDGET_KEY]?: LlmDailyBudget };

export function dailyBudgetOf(cfg: AppConfig, now: () => string = nowIso): LlmDailyBudget {
  const configured = cfg.llm.maxCallsPerDay;
  const maxCallsPerDay = Number.isInteger(configured) && configured > 0 ? configured : 0;
  let dayKey = '';
  let used = 0;
  const rollOver = (): void => {
    const today = now().slice(0, 10);
    if (today !== dayKey) {
      dayKey = today;
      used = 0;
    }
  };
  return {
    maxCallsPerDay,
    usedToday: (): number => {
      rollOver();
      return used;
    },
    tryConsume: (): boolean => {
      rollOver();
      if (used >= maxCallsPerDay) return false;
      used += 1;
      return true;
    },
  };
}

export function attachDailyBudget(client: LlmClient, budget: LlmDailyBudget): LlmClient {
  (client as BudgetCarrier)[BUDGET_KEY] = budget;
  return client;
}

export function budgetOf(client: LlmClient): LlmDailyBudget | null {
  return (client as BudgetCarrier)[BUDGET_KEY] ?? null;
}

/* ------------------------------ HTTP helpers ----------------------------- */

type JsonOutcome =
  | { ok: true; body: unknown }
  | { ok: false; kind: 'timeout' | 'http' | 'empty'; message: string };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function requestJson(url: string, init: RequestInit, timeoutMs: number): Promise<JsonOutcome> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(1, timeoutMs));
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const raw = await response.text();
    if (!response.ok) {
      return { ok: false, kind: 'http', message: `model provider returned HTTP ${response.status}` };
    }
    if (!raw.trim()) {
      return { ok: false, kind: 'empty', message: 'the model provider returned an empty response' };
    }
    try {
      return { ok: true, body: JSON.parse(raw) as unknown };
    } catch {
      return { ok: false, kind: 'empty', message: 'the model provider response was not valid JSON' };
    }
  } catch {
    if (timedOut) {
      return { ok: false, kind: 'timeout', message: `the model call timed out after ${timeoutMs}ms` };
    }
    // Network failures are typed as HTTP failures; never retried implicitly and
    // never converted into text.
    return { ok: false, kind: 'http', message: 'the model request could not be completed (network error)' };
  } finally {
    clearTimeout(timer);
  }
}

function readText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function joinParts(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const parts = value
    .map((part) => readText(record(part)?.['text']))
    .filter((part): part is string => typeof part === 'string');
  return parts.length > 0 ? parts.join('') : null;
}

function openAiText(body: unknown): string | null {
  const choices = record(body)?.['choices'];
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = record(record(choices[0])?.['message']);
  if (!message) return null;
  return readText(message['content']) ?? joinParts(message['content']);
}

function geminiText(body: unknown): string | null {
  const candidates = record(body)?.['candidates'];
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const content = record(record(candidates[0])?.['content']);
  if (!content) return null;
  return joinParts(content['parts']);
}

function ollamaText(body: unknown): string | null {
  const message = record(record(body)?.['message']);
  return message ? readText(message['content']) : null;
}

/* -------------------------------- factory -------------------------------- */

export function createLlm(cfg: AppConfig): LlmClient {
  const provider = cfg.llm.provider;
  const enabled = provider !== 'none' && (provider === 'ollama' || cfg.llm.apiKey.length > 0);
  const baseUrl = cfg.llm.baseUrl.replace(/\/+$/, '');

  const client: LlmClient = {
    enabled,
    provider: enabled ? provider : 'none',
    model: enabled ? cfg.llm.model : '',
    mode: enabled ? 'live' : 'structured',
    async complete(req): Promise<LlmResult> {
      if (!enabled) {
        return {
          ok: false,
          kind: 'disabled',
          message: 'no model is configured; the structured form path is used instead',
        };
      }
      const timeoutMs = req.timeoutMs ?? cfg.llm.timeoutMs;
      const maxTokens = req.maxTokens ?? 700;

      if (provider === 'openai') {
        const outcome = await requestJson(
          `${baseUrl}/chat/completions`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${cfg.llm.apiKey}`,
            },
            body: JSON.stringify({
              model: cfg.llm.model,
              messages: [
                { role: 'system', content: req.system },
                { role: 'user', content: req.user },
              ],
              temperature: 0,
              max_tokens: maxTokens,
              stream: false,
            }),
          },
          timeoutMs,
        );
        if (!outcome.ok) return outcome;
        const text = openAiText(outcome.body);
        return text && text.trim()
          ? { ok: true, text: text.trim() }
          : { ok: false, kind: 'empty', message: 'the model returned no text' };
      }

      if (provider === 'gemini') {
        const outcome = await requestJson(
          `${baseUrl}/models/${encodeURIComponent(cfg.llm.model)}:generateContent?key=${encodeURIComponent(
            cfg.llm.apiKey,
          )}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: req.system }] },
              contents: [{ role: 'user', parts: [{ text: req.user }] }],
              generationConfig: { temperature: 0, maxOutputTokens: maxTokens },
            }),
          },
          timeoutMs,
        );
        if (!outcome.ok) return outcome;
        const text = geminiText(outcome.body);
        return text && text.trim()
          ? { ok: true, text: text.trim() }
          : { ok: false, kind: 'empty', message: 'the model returned no text' };
      }

      if (provider === 'ollama') {
        const outcome = await requestJson(
          `${baseUrl}/api/chat`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              model: cfg.llm.model,
              messages: [
                { role: 'system', content: req.system },
                { role: 'user', content: req.user },
              ],
              stream: false,
              // Ollama can constrain decoding to valid JSON. This is a decoding
              // constraint, not a schema guarantee: verifier still runs.
              format: 'json',
              options: { temperature: 0, num_predict: maxTokens },
            }),
          },
          timeoutMs,
        );
        if (!outcome.ok) return outcome;
        const text = ollamaText(outcome.body);
        return text && text.trim()
          ? { ok: true, text: text.trim() }
          : { ok: false, kind: 'empty', message: 'the model returned no text' };
      }

      return { ok: false, kind: 'disabled', message: 'no supported model provider is configured' };
    },
  };

  return attachDailyBudget(client, dailyBudgetOf(cfg));
}
