import { describe, expect, it } from 'vitest';

import { MAX_SOURCE_TEXT, verifyExtract } from '../../src/shared/schemas.js';
import { EVAL_CASES, PERSONA_CASE_COUNT, SYNTHETIC_CASE_COUNT } from '../../fixtures/ai/cases.js';
import type { EvalCategory } from '../../fixtures/ai/cases.js';

const REQUIRED_SYNTHETIC_CATEGORIES: EvalCategory[] = [
  'negation',
  'conditional',
  'contradictory',
  'ambiguous',
  'injection',
  'empty',
  'multi-slot',
  'quoted-refusal',
];

describe('AI evaluation fixtures', () => {
  it('has at least 20 synthetic cases plus the six sample personas', () => {
    expect(SYNTHETIC_CASE_COUNT).toBeGreaterThanOrEqual(20);
    expect(PERSONA_CASE_COUNT).toBe(6);
    expect(EVAL_CASES.length).toBe(SYNTHETIC_CASE_COUNT + PERSONA_CASE_COUNT);
  });

  it('covers every required synthetic category', () => {
    const categories = new Set(EVAL_CASES.map((testCase) => testCase.category));
    for (const required of REQUIRED_SYNTHETIC_CATEGORIES) expect(categories.has(required)).toBe(true);
  });

  it('has unique ids and well-formed slots/facts for every case', () => {
    const ids = new Set(EVAL_CASES.map((testCase) => testCase.id));
    expect(ids.size).toBe(EVAL_CASES.length);
    for (const testCase of EVAL_CASES) {
      expect(testCase.slots.length).toBeGreaterThan(0);
      expect(testCase.merchantFacts.length).toBeGreaterThan(0);
      expect(testCase.sourceText.length).toBeLessThanOrEqual(MAX_SOURCE_TEXT);
      expect(testCase.recordedOutput.length).toBeGreaterThan(0);
    }
  });

  it('records each answer with its own case id as source_id', () => {
    for (const testCase of EVAL_CASES) {
      const parsed = JSON.parse(testCase.recordedOutput) as { source_id: string };
      expect(parsed.source_id).toBe(testCase.id);
    }
  });

  it('has valid checked-in recorded answers for every non-flawed, model-eligible case', () => {
    const eligible = EVAL_CASES.filter(
      (testCase) => !testCase.expected.recordedInvalid && !testCase.safety.mustNotCallModel,
    );
    expect(eligible.length).toBeGreaterThan(15);
    for (const testCase of eligible) {
      const verified = verifyExtract(JSON.parse(testCase.recordedOutput) as unknown, {
        allowedSlotIds: testCase.slots.map((slot) => slot.id),
        sourceText: testCase.sourceText,
      });
      expect(verified.ok, `recorded answer for ${testCase.id} should verify`).toBe(true);
    }
  });

  it('flags the two deliberately flawed recorded answers', () => {
    const flawed = EVAL_CASES.filter((testCase) => testCase.expected.recordedInvalid);
    expect(flawed).toHaveLength(2);
    for (const testCase of flawed) {
      const verified = verifyExtract(JSON.parse(testCase.recordedOutput) as unknown, {
        allowedSlotIds: testCase.slots.map((slot) => slot.id),
        sourceText: testCase.sourceText,
      });
      expect(verified.ok).toBe(false);
      expect(testCase.safety.mustBeFallback).toBe(true);
    }
  });

  it('asserts that injection and ambiguous/empty cases cannot silently accept or call the model', () => {
    const injection = EVAL_CASES.filter((testCase) => testCase.category === 'injection');
    expect(injection.length).toBeGreaterThanOrEqual(3);
    for (const testCase of injection) {
      expect(testCase.safety.mustNotCallModel).toBe(true);
      expect(testCase.expected.acceptedSlotIds).toEqual([]);
      expect(testCase.safety.mustNotAcceptSlotIds?.length).toBeGreaterThan(0);
    }
    for (const testCase of EVAL_CASES.filter((entry) => entry.category === 'empty')) {
      expect(testCase.safety.mustNotCallModel).toBe(true);
      expect(testCase.expected.acceptedSlotIds).toEqual([]);
    }
  });

  it('keeps conditional cases from ever being expected as accepted slots', () => {
    for (const testCase of EVAL_CASES.filter((entry) => entry.category === 'conditional')) {
      expect(testCase.expected.conditionalSlotIds.length).toBeGreaterThan(0);
      expect(testCase.expected.acceptedSlotIds).toEqual([]);
      for (const slotId of testCase.expected.conditionalSlotIds) {
        expect(testCase.expected.acceptedSlotIds).not.toContain(slotId);
        expect(testCase.safety.mustNotAcceptSlotIds ?? []).toContain(slotId);
      }
    }
  });
});
