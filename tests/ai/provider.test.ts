import { afterEach, describe, expect, it, vi } from 'vitest';

import { budgetOf, createLlm, dailyBudgetOf } from '../../src/server/ai/provider.js';
import { makeCfg } from './helpers.js';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('createLlm — no provider', () => {
  it('is disabled, reports structured mode and never fabricates text or calls the network', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const llm = createLlm(makeCfg());

    expect(llm.enabled).toBe(false);
    expect(llm.provider).toBe('none');
    expect(llm.mode).toBe('structured');
    expect(llm.model).toBe('');

    const result = await llm.complete({ system: 'sys', user: 'usr' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe('disabled');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('attaches the configured daily call budget', () => {
    const cfg = makeCfg({ llm: { maxCallsPerDay: 12 } });
    const budget = budgetOf(createLlm(cfg));
    expect(budget).not.toBeNull();
    expect(budget?.maxCallsPerDay).toBe(12);
  });
});

describe('createLlm — OpenAI-compatible', () => {
  it('posts to /chat/completions with the model, system/user messages and a server-selected temperature', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({ choices: [{ message: { content: '  {"ok":true}  ' } }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const cfg = makeCfg({
      llm: {
        provider: 'openai',
        apiKey: 'test-key',
        baseUrl: 'https://llm.example/v1/',
        model: 'gpt-4o-mini',
      },
    });
    const llm = createLlm(cfg);
    expect(llm.enabled).toBe(true);
    expect(llm.provider).toBe('openai');
    expect(llm.mode).toBe('live');

    const result = await llm.complete({ system: 'sys', user: 'usr', maxTokens: 123 });
    expect(result).toEqual({ ok: true, text: '{"ok":true}' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://llm.example/v1/chat/completions');
    const request = init as RequestInit;
    expect(request.method).toBe('POST');
    expect((request.headers as Record<string, string>).authorization).toBe('Bearer test-key');
    const body = JSON.parse(String(request.body)) as {
      model: string;
      temperature: number;
      max_tokens: number;
      stream: boolean;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.temperature).toBe(0);
    expect(body.max_tokens).toBe(123);
    expect(body.stream).toBe(false);
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ]);
    // The key is never in the URL.
    expect(String(url)).not.toContain('test-key');
  });

  it('turns non-2xx responses into typed http failures without text', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      ({
        ok: false,
        status: 500,
        text: async () => '{"error":"boom"}',
      }) as unknown as Response,
    );
    vi.stubGlobal('fetch', fetchMock);
    const llm = createLlm(makeCfg({ llm: { provider: 'openai', apiKey: 'k' } }));
    const result = await llm.complete({ system: 's', user: 'u' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('http');
      expect(result.message).toContain('500');
      expect('text' in result).toBe(false);
    }
  });

  it('turns network errors into typed http failures', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });
    vi.stubGlobal('fetch', fetchMock);
    const llm = createLlm(makeCfg({ llm: { provider: 'openai', apiKey: 'k' } }));
    const result = await llm.complete({ system: 's', user: 'u' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('http');
      expect(result.message).toContain('network');
    }
  });

  it('reports empty model text as empty, never as success', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ choices: [{ message: { content: '   ' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const llm = createLlm(makeCfg({ llm: { provider: 'openai', apiKey: 'k' } }));
    const result = await llm.complete({ system: 's', user: 'u' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe('empty');
  });

  it('times out with a typed timeout failure and respects req.timeoutMs', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) throw new Error('expected an abort signal');
          signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const llm = createLlm(makeCfg({ llm: { provider: 'openai', apiKey: 'k', timeoutMs: 5000 } }));
    const started = Date.now();
    const result = await llm.complete({ system: 's', user: 'u', timeoutMs: 25 });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('timeout');
      expect(result.message).toContain('25ms');
    }
  });
});

describe('createLlm — Gemini', () => {
  it('posts generateContent with systemInstruction and reads candidate parts', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({ candidates: [{ content: { parts: [{ text: 'hello ' }, { text: 'gemini' }] } }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const llm = createLlm(
      makeCfg({
        llm: {
          provider: 'gemini',
          apiKey: 'g-key',
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
          model: 'gemini-2.5-flash',
        },
      }),
    );
    expect(llm.enabled).toBe(true);
    const result = await llm.complete({ system: 'sys', user: 'usr', maxTokens: 99 });
    expect(result).toEqual({ ok: true, text: 'hello gemini' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=g-key',
    );
    const body = JSON.parse(String((init as RequestInit).body)) as {
      systemInstruction: { parts: Array<{ text: string }> };
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
      generationConfig: { temperature: number; maxOutputTokens: number };
    };
    expect(body.systemInstruction.parts[0]?.text).toBe('sys');
    expect(body.contents[0]?.parts[0]?.text).toBe('usr');
    expect(body.generationConfig).toEqual({ temperature: 0, maxOutputTokens: 99 });
  });
});

describe('createLlm — local Ollama', () => {
  it('is enabled without an API key and posts to /api/chat', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({ message: { role: 'assistant', content: 'hola' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const llm = createLlm(
      makeCfg({ llm: { provider: 'ollama', apiKey: '', baseUrl: 'http://localhost:11434', model: 'qwen2.5:3b' } }),
    );
    expect(llm.enabled).toBe(true);
    expect(llm.mode).toBe('live');
    const result = await llm.complete({ system: 'sys', user: 'usr' });
    expect(result).toEqual({ ok: true, text: 'hola' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://localhost:11434/api/chat');
    const body = JSON.parse(String((init as RequestInit).body)) as {
      model: string;
      stream: boolean;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe('qwen2.5:3b');
    expect(body.stream).toBe(false);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
  });
});

describe('dailyBudgetOf', () => {
  it('bounds calls per UTC day and resets on the next day', () => {
    const cfg = makeCfg({ llm: { maxCallsPerDay: 2 } });
    let day = '2026-11-12';
    const budget = dailyBudgetOf(cfg, () => `${day}T10:00:00Z`);
    expect(budget.maxCallsPerDay).toBe(2);
    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(true);
    expect(budget.usedToday()).toBe(2);
    expect(budget.tryConsume()).toBe(false);
    expect(budget.usedToday()).toBe(2);

    day = '2026-11-13';
    expect(budget.usedToday()).toBe(0);
    expect(budget.tryConsume()).toBe(true);
    expect(budget.usedToday()).toBe(1);
  });

  it('treats a zero or invalid cap as no calls allowed', () => {
    expect(dailyBudgetOf(makeCfg({ llm: { maxCallsPerDay: 0 } })).tryConsume()).toBe(false);
    expect(dailyBudgetOf(makeCfg({ llm: { maxCallsPerDay: Number.NaN } })).tryConsume()).toBe(false);
  });
});
