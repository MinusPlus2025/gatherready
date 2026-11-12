/* ==========================================================================
   GatherReady AI evaluation (scripts/ai-eval.ts)

   Runs every case in fixtures/ai/cases.ts through the real extraction pipeline.

   - If a model is configured (LLM_PROVIDER / LLM_API_KEY / LLM_OLLAMA), it calls
     the live model and measures what actually happened.
   - Otherwise it uses the checked-in recorded model answers ("recorded
     expectation path") and labels the evidence as recorded.
   - It writes ONLY fixtures/ai/last-run.json with measured numbers. It never
     writes docs and never invents a metric: every number below is counted from
     actual runs. The Lead writes docs from this JSON.

   Safety assertions (exit code 1 when broken):
   - prompt injection never reaches the model and never changes constraints,
   - conditional slots are never accepted,
   - empty text never calls a model,
   - the two flawed recorded fixtures really do fail verification.

   Usage:
     npx tsx scripts/ai-eval.ts            # live when configured, else recorded
     npx tsx scripts/ai-eval.ts --recorded # force the recorded expectation path
   ========================================================================== */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { attachDailyBudget, budgetOf, createLlm, dailyBudgetOf } from '../src/server/ai/provider.js';
import type { LlmClient, LlmResult } from '../src/server/ai/provider.js';
import { extractPreferences } from '../src/server/ai/extract.js';
import { loadConfig } from '../src/server/config.js';
import { MAX_SOURCE_TEXT, PreferenceExtractSchema, verifyExtract } from '../src/shared/schemas.js';
import type { PreferenceExtract } from '../src/shared/schemas.js';
import { nowIso } from '../src/shared/time.js';
import { EVAL_CASES, PERSONA_CASE_COUNT, SYNTHETIC_CASE_COUNT } from '../fixtures/ai/cases.js';
import type { EvalCase } from '../fixtures/ai/cases.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = path.join(ROOT, 'fixtures', 'ai', 'last-run.json');

/* ------------------------------ small helpers ---------------------------- */

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function symmetricDiff(left: string[], right: string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  let count = 0;
  for (const value of a) if (!b.has(value)) count += 1;
  for (const value of b) if (!a.has(value)) count += 1;
  return count;
}

function identical(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const a = new Set(left);
  return right.every((value) => a.has(value));
}

function parseJsonLoose(text: string): unknown {
  let candidate = text.trim();
  if (candidate.startsWith('```')) {
    candidate = candidate
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return undefined;
  }
}

type Verdict = 'ok' | 'schema' | 'quote';

/** Classify one raw model answer the same way the runtime verifier would. */
function classifyAnswer(c: EvalCase, raw: string): Verdict {
  const parsed = parseJsonLoose(raw);
  if (parsed === undefined) return 'schema';
  if (!PreferenceExtractSchema.safeParse(parsed).success) return 'schema';
  const verified = verifyExtract(parsed, {
    allowedSlotIds: c.slots.map((slot) => slot.id),
    sourceText: c.sourceText.slice(0, MAX_SOURCE_TEXT),
  });
  if (verified.ok) return 'ok';
  return verified.errors.some((error) => error.includes('not verbatim')) ? 'quote' : 'schema';
}

/* ------------------------------- model stubs ----------------------------- */

function recordedClient(recordedOutput: string): LlmClient {
  return {
    enabled: true,
    provider: 'recorded',
    model: 'recorded-fixture',
    mode: 'recorded',
    async complete(): Promise<LlmResult> {
      // A recorded "answer" is returned on every attempt so an intentionally
      // flawed fixture fails verification twice and exercises the fallback.
      return { ok: true, text: recordedOutput };
    },
  };
}

interface RecordingClient extends LlmClient {
  rawTexts: string[];
}

function recordingClient(base: LlmClient): RecordingClient {
  const rawTexts: string[] = [];
  const client: LlmClient = {
    enabled: base.enabled,
    provider: base.provider,
    model: base.model,
    mode: base.mode,
    async complete(req): Promise<LlmResult> {
      const result = await base.complete(req);
      if (result.ok) rawTexts.push(result.text);
      return result;
    },
  };
  const budget = budgetOf(base);
  if (budget) attachDailyBudget(client, budget);
  return Object.assign(client, { rawTexts });
}

/* -------------------------------- one case ------------------------------- */

interface CaseResult {
  id: string;
  category: string;
  mode: string;
  attempts: number;
  fallback: boolean;
  acceptedCount: number;
  preferredCount: number;
  conditionalCount: number;
  uncertaintyCount: number;
  modelCalls: number;
  acceptedSlotIds: string[];
  preferredSlotIds: string[];
  verifier: { ok: number; schemaFailures: number; quoteFailures: number };
  manualEditsFormPath: number;
  manualEditsAiPath: number;
  matchesExpected: boolean;
}

function formPathEdits(c: EvalCase): number {
  // One form interaction per accepted slot and preference, two per condition
  // (condition text + verbatim quote), one per ambiguity to answer, one confirm.
  return (
    c.expected.acceptedSlotIds.length +
    c.expected.preferredSlotIds.length +
    c.expected.conditionalSlotIds.length * 2 +
    c.expected.uncertaintyFields.length +
    1
  );
}

async function runCase(c: EvalCase, client: LlmClient): Promise<CaseResult> {
  const outcome = await extractPreferences(client, {
    sourceId: c.id,
    sourceText: c.sourceText,
    slots: c.slots,
    merchantFacts: c.merchantFacts,
  });
  const result: PreferenceExtract = outcome.result;
  const modelCalls = (client as Partial<RecordingClient>).rawTexts?.length ?? 0;

  // Verifier metrics come from the material this run actually used.
  const materials =
    client.mode === 'recorded' ? [c.recordedOutput] : ((client as Partial<RecordingClient>).rawTexts ?? []);
  const verifier = { ok: 0, schemaFailures: 0, quoteFailures: 0 };
  for (const raw of materials) {
    const verdict = classifyAnswer(c, raw);
    if (verdict === 'ok') verifier.ok += 1;
    else if (verdict === 'schema') verifier.schemaFailures += 1;
    else verifier.quoteFailures += 1;
  }

  const fallback = outcome.note !== null;
  const formEdits = formPathEdits(c);
  const aiEdits = fallback
    ? formEdits
    : symmetricDiff(result.accepted_slot_ids, c.expected.acceptedSlotIds) +
      symmetricDiff(result.preferred_slot_ids, c.expected.preferredSlotIds) +
      symmetricDiff(
        result.conditional_slots.map((condition) => condition.slot_id),
        c.expected.conditionalSlotIds,
      ) *
        2 +
      result.uncertainties.length;

  const matchesExpected =
    identical(result.accepted_slot_ids, c.expected.acceptedSlotIds) &&
    identical(result.preferred_slot_ids, c.expected.preferredSlotIds) &&
    identical(
      result.conditional_slots.map((condition) => condition.slot_id),
      c.expected.conditionalSlotIds,
    ) &&
    identical(
      result.uncertainties.map((uncertainty) => uncertainty.field),
      c.expected.uncertaintyFields,
    );

  return {
    id: c.id,
    category: c.category,
    mode: outcome.mode,
    attempts: outcome.attempts,
    fallback,
    acceptedCount: result.accepted_slot_ids.length,
    preferredCount: result.preferred_slot_ids.length,
    conditionalCount: result.conditional_slots.length,
    uncertaintyCount: result.uncertainties.length,
    modelCalls,
    acceptedSlotIds: result.accepted_slot_ids.slice(),
    preferredSlotIds: result.preferred_slot_ids.slice(),
    verifier,
    manualEditsFormPath: formEdits,
    manualEditsAiPath: aiEdits,
    matchesExpected,
  };
}

/* --------------------------------- safety -------------------------------- */

function safetyViolations(c: EvalCase, result: CaseResult, acceptedIds: string[]): string[] {
  const violations: string[] = [];
  const accepted = new Set(acceptedIds);
  for (const forbidden of c.safety.mustNotAcceptSlotIds ?? []) {
    if (accepted.has(forbidden)) {
      violations.push(`${c.id}: accepted ${forbidden} although the sentence does not confirm it`);
    }
  }
  if (c.safety.mustNotCallModel && result.modelCalls > 0) {
    violations.push(`${c.id}: sent untrusted input to the model`);
  }
  if (c.safety.mustBeFallback && !result.fallback) {
    violations.push(`${c.id}: claimed a successful extraction instead of falling back`);
  }
  return violations;
}

/* ---------------------------------- main --------------------------------- */

async function main(): Promise<void> {
  const forceRecorded = process.argv.includes('--recorded');
  const cfg = loadConfig();
  const base = createLlm(cfg);
  const live = base.enabled && !forceRecorded;

  const results: CaseResult[] = [];
  const violations: string[] = [];
  const fixtureFailures: string[] = [];

  for (const c of EVAL_CASES) {
    const client = live ? recordingClient(base) : recordedClient(c.recordedOutput);
    const result = await runCase(c, client);
    results.push(result);
    violations.push(...safetyViolations(c, result, [...result.acceptedSlotIds, ...result.preferredSlotIds]));

    if (!live && !c.expected.recordedInvalid && !c.safety.mustNotCallModel) {
      if (result.mode !== 'recorded' || result.fallback) {
        fixtureFailures.push(`${c.id}: valid recorded fixture did not verify`);
      } else if (result.verifier.schemaFailures + result.verifier.quoteFailures > 0) {
        fixtureFailures.push(`${c.id}: recorded fixture failed verification`);
      }
    }
    if (!live && c.expected.recordedInvalid && !result.fallback) {
      fixtureFailures.push(`${c.id}: flawed recorded fixture was accepted instead of falling back`);
    }
  }

  const totals = {
    cases: results.length,
    syntheticCases: SYNTHETIC_CASE_COUNT,
    personaCases: PERSONA_CASE_COUNT,
    liveSuccesses: results.filter((result) => result.mode === 'live').length,
    recordedSuccesses: results.filter((result) => result.mode === 'recorded' && !result.fallback).length,
    structuredModes: results.filter((result) => result.mode === 'structured').length,
    /** Fallbacks caused by the safety pre-screen (empty text, prompt injection, no slots). */
    guardFallbacks: results.filter((result) => result.fallback && result.mode === 'structured').length,
    /** Fallbacks caused by two failed live verifications or a call/transport failure. */
    modelFallbacks: results.filter((result) => result.fallback && result.mode === 'recorded').length,
    fallbacks: results.filter((result) => result.fallback).length,
    fallbackRate: round(results.filter((result) => result.fallback).length / results.length),
    attempts: results.reduce((sum, result) => sum + result.attempts, 0),
    modelCalls: results.reduce((sum, result) => sum + result.modelCalls, 0),
    schemaFailures: results.reduce((sum, result) => sum + result.verifier.schemaFailures, 0),
    quoteFailures: results.reduce((sum, result) => sum + result.verifier.quoteFailures, 0),
    manualEditsFormPath: results.reduce((sum, result) => sum + result.manualEditsFormPath, 0),
    manualEditsAiPath: results.reduce((sum, result) => sum + result.manualEditsAiPath, 0),
    matchesExpected: results.filter((result) => result.matchesExpected).length,
    safetyViolations: violations.length,
    fixtureFailures: fixtureFailures.length,
  };

  const report = {
    generatedAt: nowIso(),
    evidence: live ? 'live' : 'recorded',
    live,
    provider: cfg.llm.provider,
    model: cfg.llm.provider === 'none' ? null : cfg.llm.model,
    callBudget: { maxCallsPerDay: dailyBudgetOf(cfg).maxCallsPerDay },
    cases: results,
    totals,
    baseline: {
      description:
        'Manual edits compare the form path (toggles/condition text/quote/ambiguity answers/confirm) ' +
        'with the reviewed extraction path (corrections to the reviewed constraints, or the full form ' +
        'when the pipeline falls back).',
      manualEditsFormPath: totals.manualEditsFormPath,
      manualEditsAiPath: totals.manualEditsAiPath,
      editReduction: totals.manualEditsFormPath - totals.manualEditsAiPath,
      editReductionPct:
        totals.manualEditsFormPath > 0
          ? round((totals.manualEditsFormPath - totals.manualEditsAiPath) / totals.manualEditsFormPath * 100, 1)
          : 0,
    },
    safety: { violations, fixtureFailures },
    limitations: [
      live
        ? 'Live model evidence: every number was measured from real model calls made by this run.'
        : 'Recorded evidence only: no model is configured, so these numbers come from the checked-in recorded ' +
          'model answers in fixtures/ai/cases.ts, NOT from a live model. Configure LLM_PROVIDER/LLM_API_KEY ' +
          '(or LLM_OLLAMA=1) and re-run to measure live behaviour.',
      'Manual-edit counts are a documented heuristic, not a user study.',
      'Cases are synthetic; the six demo personas are fictional sample data.',
    ],
  };

  mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`GatherReady AI eval — ${totals.cases} cases (${live ? 'live model' : 'recorded fixtures'})`);
  console.log(
    `live=${totals.liveSuccesses} recorded=${totals.recordedSuccesses} structured=${totals.structuredModes} ` +
      `fallbacks=${totals.fallbacks} fallbackRate=${totals.fallbackRate}`,
  );
  console.log(
    `attempts=${totals.attempts} modelCalls=${totals.modelCalls} schemaFailures=${totals.schemaFailures} ` +
      `quoteFailures=${totals.quoteFailures} matchesExpected=${totals.matchesExpected}/${totals.cases}`,
  );
  console.log(
    `manualEdits form=${totals.manualEditsFormPath} ai=${totals.manualEditsAiPath} ` +
      `reduction=${report.baseline.editReduction} (${report.baseline.editReductionPct}%)`,
  );
  console.log(`safetyViolations=${totals.safetyViolations} fixtureFailures=${totals.fixtureFailures}`);
  console.log(`wrote ${path.relative(ROOT, OUT_PATH)}`);
  if (violations.length > 0 || fixtureFailures.length > 0) {
    for (const violation of violations) console.log(`SAFETY: ${violation}`);
    for (const failure of fixtureFailures) console.log(`FIXTURE: ${failure}`);
    process.exitCode = 1;
  }
}

await main();
