/* ==========================================================================
   Deterministic plan solver (CONTRACT §3.2)

   Safety decisions:
   - Only a CONFIRMED preference can make a slot fit. A conditional slot is
     "reachable" at best and is never counted as a fit; an unconfirmed
     preference is not counted at all. This is the rule that stops the product
     from selling a workshop nobody has actually agreed to.
   - No model scores, no randomness, no wall clock. The same input always
     produces byte-identical output, and planInputsHash changes whenever a
     preference version, a conditional, or a clarification changes — that is
     what invalidates stale plans and stale offer consent downstream.
   - The solver proposes at most one question, and only when a single YES would
     actually close the gap on the best-ranked slot. Otherwise it says why not
     instead of inventing a compromise.
   ========================================================================== */

import { createHash } from 'node:crypto';
import type {
  ClarificationSuggestion,
  ClarificationStatus,
  PlanResult,
  PreferenceStatus,
  SlotPlan,
} from '../../shared/types.js';

export interface PlanSlotInput {
  id: string;
  ordinal: 1 | 2 | 3;
  label: string;
}

export interface PlanPreference {
  participantId: string;
  displayName: string;
  version: number;
  status: PreferenceStatus;
  acceptedSlotIds: string[];
  preferredSlotIds: string[];
  conditionalSlots: Array<{ slotId: string; condition: string; sourceQuote: string }>;
}

export interface PlanClarification {
  id: string;
  participantId: string;
  slotId: string;
  status: ClarificationStatus;
  answer: 'YES' | 'NO' | null;
}

export interface PlanInput {
  minimum: number;
  capacity: number;
  slots: PlanSlotInput[];
  preferences: PlanPreference[];
  clarifications: PlanClarification[];
}

/* ----------------------------- canonical hash ---------------------------- */

/** Locale-independent string ordering so hashes never depend on the machine. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort(compare)) {
      if (source[key] !== undefined) out[key] = stable(source[key]);
    }
    return out;
  }
  return value;
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort(compare);
}

function normalizedInput(input: PlanInput): unknown {
  const slots = input.slots
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal || compare(a.id, b.id))
    .map((slot) => ({ id: slot.id, ordinal: slot.ordinal }));
  const preferences = input.preferences
    .slice()
    .sort((a, b) => compare(a.participantId, b.participantId))
    .map((pref) => ({
      participantId: pref.participantId,
      version: pref.version,
      status: pref.status,
      acceptedSlotIds: sortedUnique(pref.acceptedSlotIds),
      preferredSlotIds: sortedUnique(pref.preferredSlotIds),
      conditionalSlots: pref.conditionalSlots
        .map((condition) => ({
          slotId: condition.slotId,
          condition: condition.condition,
          sourceQuote: condition.sourceQuote,
        }))
        .sort(
          (a, b) =>
            compare(a.slotId, b.slotId) || compare(a.condition, b.condition) || compare(a.sourceQuote, b.sourceQuote),
        ),
    }));
  const clarifications = input.clarifications
    .slice()
    .sort((a, b) => compare(a.id, b.id))
    .map((clarification) => ({
      id: clarification.id,
      participantId: clarification.participantId,
      slotId: clarification.slotId,
      status: clarification.status,
      answer: clarification.answer,
    }));
  return {
    minimum: input.minimum,
    capacity: input.capacity,
    slots,
    preferences,
    clarifications,
  };
}

/** sha256 over a canonicalised view of everything that can change the plan. */
export function planInputsHash(input: PlanInput): string {
  const canonical = JSON.stringify(stable(normalizedInput(input)));
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/* -------------------------------- helpers -------------------------------- */

function trimLabel(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

interface SlotRow {
  input: PlanSlotInput;
  fitParticipantIds: string[];
  conditionalParticipantIds: string[];
  preferredSatisfiedCount: number;
  meetsMinimum: boolean;
  reachableMax: number;
}

function rank(a: SlotRow, b: SlotRow): number {
  // 1. A slot that already meets the minimum outranks one that does not.
  if (a.meetsMinimum !== b.meetsMinimum) return a.meetsMinimum ? -1 : 1;
  // 2. Fewer unresolved conditions is better.
  const conditions = a.conditionalParticipantIds.length - b.conditionalParticipantIds.length;
  if (conditions !== 0) return conditions;
  // 3. More satisfied preferences is better.
  if (a.preferredSatisfiedCount !== b.preferredSatisfiedCount) {
    return b.preferredSatisfiedCount - a.preferredSatisfiedCount;
  }
  // 4. Deterministic positional tie-break.
  if (a.input.ordinal !== b.input.ordinal) return a.input.ordinal - b.input.ordinal;
  return compare(a.input.id, b.input.id);
}

function formatCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/* --------------------------------- solver -------------------------------- */

export function computePlan(input: PlanInput): PlanResult {
  const hash = planInputsHash(input);
  const minimum = Number.isInteger(input.minimum) ? Math.max(1, input.minimum) : 1;
  const capacity = Number.isInteger(input.capacity) ? Math.max(minimum, input.capacity) : minimum;

  const confirmed = input.preferences.filter((pref) => pref.status === 'CONFIRMED');

  // A recorded NO answer is honoured even if the preference was not re-saved:
  // a refusal we already received must never keep a slot "reachable".
  const refused = new Set(
    input.clarifications
      .filter((clarification) => clarification.answer === 'NO' || clarification.status === 'ANSWERED_NO')
      .map((clarification) => `${clarification.participantId}\u0000${clarification.slotId}`),
  );

  const rows: SlotRow[] = input.slots.map((slot) => {
    const fitParticipantIds = confirmed
      .filter((pref) => pref.acceptedSlotIds.includes(slot.id))
      .map((pref) => pref.participantId)
      .sort(compare);
    const conditionalParticipantIds = confirmed
      .filter(
        (pref) =>
          !pref.acceptedSlotIds.includes(slot.id) &&
          pref.conditionalSlots.some((condition) => condition.slotId === slot.id) &&
          !refused.has(`${pref.participantId}\u0000${slot.id}`),
      )
      .map((pref) => pref.participantId)
      .sort(compare);
    const preferredSatisfiedCount = confirmed.filter(
      (pref) => pref.acceptedSlotIds.includes(slot.id) && pref.preferredSlotIds.includes(slot.id),
    ).length;
    return {
      input: slot,
      fitParticipantIds,
      conditionalParticipantIds,
      preferredSatisfiedCount,
      meetsMinimum: fitParticipantIds.length >= minimum,
      reachableMax: fitParticipantIds.length + conditionalParticipantIds.length,
    };
  });

  const ranked = rows.slice().sort(rank);
  const workable = ranked.find((row) => row.meetsMinimum) ?? null;

  const slotPlans: SlotPlan[] = ranked.map((row) => ({
    slotId: row.input.id,
    fitParticipantIds: row.fitParticipantIds,
    conditionalParticipantIds: row.conditionalParticipantIds,
    planInputsHash: hash,
    meetsMinimum: row.meetsMinimum,
    reachableMax: row.reachableMax,
    preferredSatisfiedCount: row.preferredSatisfiedCount,
  }));

  let suggestion: ClarificationSuggestion | null = null;
  let reason: string;

  if (rows.length === 0) {
    reason = 'No workshop times were provided, so no plan can be computed.';
  } else if (workable) {
    reason = `"${trimLabel(workable.input.label)}" works: ${formatCount(
      workable.fitParticipantIds.length,
      'confirmed participant',
    )} for a minimum of ${minimum} (capacity ${capacity}).`;
  } else {
    // Suggestion candidates come from CONFIRMED conditional slots ALONE: the
    // organizer sees the suggested question before any clarification row exists.
    // A recorded ANSWERED_YES/ANSWERED_NO/CANCELLED row means that condition was
    // already resolved or refused (never re-ask); an unanswered PROPOSED/SENT row
    // is linked as the clarification id, otherwise clarificationId is null.
    const resolved = new Set(
      input.clarifications
        .filter(
          (clarification) =>
            clarification.answer !== null ||
            clarification.status === 'ANSWERED_YES' ||
            clarification.status === 'ANSWERED_NO' ||
            clarification.status === 'CANCELLED',
        )
        .map((clarification) => `${clarification.participantId}\u0000${clarification.slotId}`),
    );

    interface SuggestionCandidate {
      row: SlotRow;
      pref: PlanPreference;
      condition: { slotId: string; condition: string; sourceQuote: string };
      clarificationId: string | null;
    }

    const candidates: SuggestionCandidate[] = [];
    for (const row of ranked) {
      if (row.meetsMinimum) continue;
      if (row.fitParticipantIds.length + 1 < minimum) continue;
      for (const pref of confirmed) {
        if (pref.acceptedSlotIds.includes(row.input.id)) continue;
        const condition = pref.conditionalSlots.find((entry) => entry.slotId === row.input.id);
        if (!condition) continue;
        if (resolved.has(`${pref.participantId}\u0000${row.input.id}`)) continue;
        const pending = input.clarifications.find(
          (clarification) =>
            clarification.participantId === pref.participantId &&
            clarification.slotId === row.input.id &&
            clarification.answer === null &&
            (clarification.status === 'PROPOSED' || clarification.status === 'SENT'),
        );
        candidates.push({ row, pref, condition, clarificationId: pending?.id ?? null });
      }
    }
    // Slot rank first (contract §3.2 rule 4), then participant id, then ordinal.
    const slotRank = new Map<SlotRow, number>();
    ranked.forEach((row, index) => slotRank.set(row, index));
    candidates.sort(
      (a, b) =>
        (slotRank.get(a.row) ?? 0) - (slotRank.get(b.row) ?? 0) ||
        compare(a.pref.participantId, b.pref.participantId) ||
        a.row.input.ordinal - b.row.input.ordinal ||
        compare(a.condition.condition, b.condition.condition),
    );
    const chosen = candidates[0] ?? null;

    // For the honest "nothing works" reason, point at the slot with the most
    // confirmed interest rather than an arbitrary lowest-ordinal one.
    const mostFits =
      rows
        .slice()
        .sort(
          (a, b) =>
            b.fitParticipantIds.length - a.fitParticipantIds.length ||
            b.reachableMax - a.reachableMax ||
            a.input.ordinal - b.input.ordinal ||
            compare(a.input.id, b.input.id),
        )[0] ?? null;

    if (chosen) {
      const confirmedCount = chosen.row.fitParticipantIds.length;
      const conditionalCount = chosen.row.conditionalParticipantIds.length;
      const targetLabel = trimLabel(chosen.row.input.label);
      suggestion = {
        participantId: chosen.pref.participantId,
        clarificationId: chosen.clarificationId,
        slotId: chosen.row.input.id,
        conditionText: chosen.condition.condition,
        // format.ts hydrates the display question from the confirmed fact and slot.
        questionText: '',
        // The solver is not given merchant facts; clarify.ts owns the real
        // question and format.ts hydrates the fact. Never invent a fact here.
        factLabel: '',
        factValue: '',
        gapClosed: confirmedCount + 1,
        sourceQuote: chosen.condition.sourceQuote,
      };
      reason =
        `No slot reaches the minimum of ${minimum} yet. The best candidate, "${targetLabel}", has ` +
        `${formatCount(confirmedCount, 'confirmed participant')} and ${formatCount(conditionalCount, 'open condition')}. ` +
        `One open question can bring it to ${confirmedCount + 1} confirmed.`;
    } else if (!mostFits) {
      reason = 'No workshop times were provided, so no plan can be computed.';
    } else {
      const label = trimLabel(mostFits.input.label);
      const confirmedCount = mostFits.fitParticipantIds.length;
      const conditionalCount = mostFits.conditionalParticipantIds.length;
      if (conditionalCount === 0) {
        reason =
          `No slot reaches the minimum of ${minimum}. The closest is "${label}" with ` +
          `${formatCount(confirmedCount, 'confirmed participant')} and no open condition to resolve.`;
      } else if (confirmedCount + 1 < minimum) {
        reason =
          `No slot reaches the minimum of ${minimum}. "${label}" has ` +
          `${formatCount(confirmedCount, 'confirmed participant')} and ${formatCount(
            conditionalCount,
            'open condition',
          )}; even answering one question would bring it to ${confirmedCount + 1}, short of the minimum.`;
      } else {
        reason =
          `No slot reaches the minimum of ${minimum}. "${label}" has ` +
          `${formatCount(conditionalCount, 'open condition')} that were already answered or withdrawn, ` +
          'so no new question is asked.';
      }
    }
  }

  return {
    slots: slotPlans,
    minimum,
    capacity,
    workableSlotId: workable?.input.id ?? null,
    suggestion,
    reason,
    planInputsHash: hash,
  };
}
