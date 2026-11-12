/* ==========================================================================
   Checked-in recorded extractions for the six demo personas.

   When there is NO model configured, extraction is allowed to return
   `mode: 'recorded'` only for these exact sample sentences (normalised), using
   the same reviewed fixture the seed uses (`DIEGO_RECORDED_EXTRACT` for Diego,
   and the persona's own confirmed seed for the other five). Every other input
   goes to the structured form with empty constraints — never a fake success.

   The sentences come from src/shared/sample.ts so the fixtures cannot drift
   from the demo personas.
   ========================================================================== */

import { buildSample, DIEGO_RECORDED_EXTRACT } from '../../shared/sample.js';
import type { PreferenceExtract } from '../../shared/schemas.js';
import { normalizeMatch } from './guard.js';

/** Fixed reference date: only the persona sentences are used, which do not depend on `now`. */
const FIXED_NOW = '2026-11-12T04:00:00Z';

export interface RecordedSample {
  sourceId: string;
  extract: PreferenceExtract;
}

let cache: Map<string, RecordedSample> | null = null;

function buildRecordedSamples(): Map<string, RecordedSample> {
  const samples = new Map<string, RecordedSample>();
  const bundle = buildSample(FIXED_NOW, 9);
  for (const persona of bundle.personas) {
    const sourceId = `sample_${persona.key}`;
    if (persona.key === 'diego') {
      samples.set(normalizeMatch(persona.sourceText), {
        sourceId,
        extract: { ...DIEGO_RECORDED_EXTRACT, source_id: sourceId },
      });
      continue;
    }
    const seed = persona.preference;
    samples.set(normalizeMatch(persona.sourceText), {
      sourceId,
      extract: {
        schema_version: '1',
        source_id: sourceId,
        accepted_slot_ids: seed.acceptedSlotIds.slice(),
        preferred_slot_ids: seed.preferredSlotIds.slice(),
        conditional_slots: seed.conditions.map((condition) => ({
          slot_id: condition.slotId,
          condition: condition.condition,
          source_quote: condition.sourceQuote,
        })),
        uncertainties: [],
        requires_confirmation: true,
      },
    });
  }
  return samples;
}

/** The reviewed sample extraction for this exact sample sentence, or null. */
export function recordedSampleFor(sourceText: string): RecordedSample | null {
  if (!cache) cache = buildRecordedSamples();
  return cache.get(normalizeMatch(sourceText)) ?? null;
}

export function recordedSampleSourceIds(): string[] {
  if (!cache) cache = buildRecordedSamples();
  return [...new Set([...cache.values()].map((sample) => sample.sourceId))].sort();
}
