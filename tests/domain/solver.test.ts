import { describe, expect, it } from 'vitest';

import { computePlan, planInputsHash } from '../../src/server/domain/solver.js';
import type { PlanClarification, PlanInput, PlanPreference, PlanSlotInput } from '../../src/server/domain/solver.js';

const SLOTS: PlanSlotInput[] = [
  { id: 'slot_a', ordinal: 1, label: 'Saturday, November 21, 2026 · 10:00–12:00' },
  { id: 'slot_b', ordinal: 2, label: 'Saturday, November 21, 2026 · 13:00–15:00' },
  { id: 'slot_c', ordinal: 3, label: 'Sunday, November 22, 2026 · 10:00–12:00' },
];

function pref(participantId: string, overrides: Partial<PlanPreference> = {}): PlanPreference {
  return {
    participantId,
    displayName: participantId[0]?.toUpperCase() + participantId.slice(1),
    version: 1,
    status: 'CONFIRMED',
    acceptedSlotIds: [],
    preferredSlotIds: [],
    conditionalSlots: [],
    ...overrides,
  };
}

function clarification(
  id: string,
  participantId: string,
  slotId: string,
  overrides: Partial<PlanClarification> = {},
): PlanClarification {
  return { id, participantId, slotId, status: 'PROPOSED', answer: null, ...overrides };
}

function baseInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    minimum: 4,
    capacity: 6,
    slots: SLOTS,
    preferences: [],
    clarifications: [],
    ...overrides,
  };
}

function slotOf(plan: ReturnType<typeof computePlan>, slotId: string) {
  const found = plan.slots.find((slot) => slot.slotId === slotId);
  if (!found) throw new Error(`missing slot ${slotId}`);
  return found;
}

describe('computePlan — T01: a condition never counts until confirmed', () => {
  const input = baseInput({
    preferences: [
      pref('alice', { acceptedSlotIds: ['slot_a'] }),
      pref('ben', { acceptedSlotIds: ['slot_a'] }),
      pref('cara', { acceptedSlotIds: ['slot_a'] }),
      pref('diego', {
        conditionalSlots: [
          { slotId: 'slot_a', condition: 'materials are included', sourceQuote: 'if materials are included' },
        ],
      }),
    ],
    clarifications: [clarification('clr_diego', 'diego', 'slot_a')],
  });

  it('counts the conditional participant as reachable-only, never as a fit', () => {
    const plan = computePlan(input);
    const a = slotOf(plan, 'slot_a');
    expect(a.fitParticipantIds).toEqual(['alice', 'ben', 'cara']);
    expect(a.conditionalParticipantIds).toEqual(['diego']);
    expect(a.reachableMax).toBe(4);
    expect(a.meetsMinimum).toBe(false);
    expect(plan.workableSlotId).toBeNull();
  });

  it('offers exactly one clarification, the one whose YES closes the gap', () => {
    const plan = computePlan(input);
    expect(plan.suggestion).not.toBeNull();
    expect(plan.suggestion?.participantId).toBe('diego');
    expect(plan.suggestion?.clarificationId).toBe('clr_diego');
    expect(plan.suggestion?.slotId).toBe('slot_a');
    expect(plan.suggestion?.conditionText).toBe('materials are included');
    expect(plan.suggestion?.gapClosed).toBe(4);
    expect(plan.reason).toContain('minimum of 4');
  });

  it('treats a YES as an updated confirmed preference (no second-guessing)', () => {
    const plan = computePlan({
      ...input,
      preferences: input.preferences.map((entry) =>
        entry.participantId === 'diego'
          ? pref('diego', { version: 2, acceptedSlotIds: ['slot_a'] })
          : entry,
      ),
      clarifications: [clarification('clr_diego', 'diego', 'slot_a', { status: 'ANSWERED_YES', answer: 'YES' })],
    });
    const a = slotOf(plan, 'slot_a');
    expect(a.fitParticipantIds).toEqual(['alice', 'ben', 'cara', 'diego']);
    expect(a.meetsMinimum).toBe(true);
    expect(plan.workableSlotId).toBe('slot_a');
    expect(plan.suggestion).toBeNull();
  });
});

describe('computePlan — confirmed-only counting', () => {
  it('ignores unconfirmed preferences even when they list accepted slots', () => {
    const plan = computePlan(
      baseInput({
        minimum: 1,
        preferences: [
          pref('draft', { status: 'DRAFT', acceptedSlotIds: ['slot_a'] }),
          pref('clarify', { status: 'NEEDS_CLARIFICATION', acceptedSlotIds: ['slot_a'] }),
          pref('gone', { status: 'WITHDRAWN', acceptedSlotIds: ['slot_a'] }),
        ],
      }),
    );
    expect(slotOf(plan, 'slot_a').fitParticipantIds).toEqual([]);
    expect(slotOf(plan, 'slot_a').reachableMax).toBe(0);
    expect(plan.workableSlotId).toBeNull();
  });

  it('does not count a conditional slot as a fit even for the same preference (T02: Saturdays but not mornings)', () => {
    const plan = computePlan(
      baseInput({
        minimum: 1,
        slots: SLOTS,
        preferences: [
          pref('morning-sceptic', {
            acceptedSlotIds: ['slot_b'],
            conditionalSlots: [{ slotId: 'slot_a', condition: 'only if coffee is provided', sourceQuote: 'only if' }],
          }),
        ],
      }),
    );
    expect(slotOf(plan, 'slot_a').fitParticipantIds).toEqual([]);
    expect(slotOf(plan, 'slot_a').conditionalParticipantIds).toEqual(['morning-sceptic']);
    expect(slotOf(plan, 'slot_b').fitParticipantIds).toEqual(['morning-sceptic']);
  });

  it('honours a recorded NO answer by removing the condition from reachable', () => {
    const plan = computePlan(
      baseInput({
        preferences: [
          pref('alice', { acceptedSlotIds: ['slot_a'] }),
          pref('diego', {
            conditionalSlots: [{ slotId: 'slot_a', condition: 'materials included', sourceQuote: 'if materials included' }],
          }),
        ],
        clarifications: [clarification('clr_diego', 'diego', 'slot_a', { status: 'ANSWERED_NO', answer: 'NO' })],
      }),
    );
    const a = slotOf(plan, 'slot_a');
    expect(a.conditionalParticipantIds).toEqual([]);
    expect(a.reachableMax).toBe(1);
    expect(plan.suggestion).toBeNull();
    expect(plan.reason).toContain('no open condition');
  });
});

describe('computePlan — T20: no workable plan is reported honestly', () => {
  it('returns no workable slot, no suggestion and a reason when nothing can close the gap', () => {
    const plan = computePlan(
      baseInput({
        minimum: 4,
        preferences: [pref('alice', { acceptedSlotIds: ['slot_a'] }), pref('ben', { acceptedSlotIds: ['slot_b'] })],
      }),
    );
    expect(plan.workableSlotId).toBeNull();
    expect(plan.suggestion).toBeNull();
    expect(plan.reason).toContain('minimum of 4');
    expect(plan.reason).toContain('no open condition');
    expect(plan.slots.every((slot) => slot.meetsMinimum === false)).toBe(true);
  });

  it('refuses to suggest a question when one YES still leaves the slot short', () => {
    const plan = computePlan(
      baseInput({
        minimum: 4,
        preferences: [
          pref('alice', { acceptedSlotIds: ['slot_a'] }),
          pref('diego', {
            conditionalSlots: [{ slotId: 'slot_a', condition: 'materials included', sourceQuote: 'if materials included' }],
          }),
        ],
        clarifications: [clarification('clr_diego', 'diego', 'slot_a')],
      }),
    );
    expect(plan.suggestion).toBeNull();
    expect(plan.reason).toContain('short of the minimum');
  });

  it('suggests a question from confirmed conditions even before a clarification row exists', () => {
    const sourceQuote = 'if all the materials are included';
    const plan = computePlan(
      baseInput({
        preferences: [
          pref('alice', { acceptedSlotIds: ['slot_a'] }),
          pref('ben', { acceptedSlotIds: ['slot_a'] }),
          pref('cara', { acceptedSlotIds: ['slot_a'] }),
          pref('diego', {
            conditionalSlots: [
              { slotId: 'slot_a', condition: 'all the materials are included', sourceQuote },
            ],
          }),
        ],
      }),
    );
    expect(plan.workableSlotId).toBeNull();
    expect(plan.suggestion).not.toBeNull();
    expect(plan.suggestion?.clarificationId).toBeNull();
    expect(plan.suggestion?.participantId).toBe('diego');
    expect(plan.suggestion?.slotId).toBe('slot_a');
    expect(plan.suggestion?.conditionText).toBe('all the materials are included');
    expect(plan.suggestion?.sourceQuote).toBe(sourceQuote);
    expect(plan.suggestion?.gapClosed).toBe(4);
    expect(plan.suggestion?.questionText).toBe(''); // format.ts hydrates the display question
    expect(plan.reason).toContain('One open question can bring it to 4 confirmed');
  });

  it('links an existing unanswered clarification row and still only suggests once', () => {
    const plan = computePlan(
      baseInput({
        preferences: [
          pref('alice', { acceptedSlotIds: ['slot_a'] }),
          pref('ben', { acceptedSlotIds: ['slot_a'] }),
          pref('cara', { acceptedSlotIds: ['slot_a'] }),
          pref('diego', {
            conditionalSlots: [{ slotId: 'slot_a', condition: 'materials included', sourceQuote: 'if materials included' }],
          }),
        ],
        clarifications: [clarification('clr_diego', 'diego', 'slot_a', { status: 'SENT' })],
      }),
    );
    expect(plan.suggestion?.clarificationId).toBe('clr_diego');
    expect(plan.slots).toHaveLength(3);
  });

  it('picks the deterministic candidate: slot rank first, then participant id', () => {
    const plan = computePlan(
      baseInput({
        preferences: [
          pref('zed', {
            conditionalSlots: [{ slotId: 'slot_a', condition: 'materials included', sourceQuote: 'if materials included' }],
          }),
          pref('amy', {
            conditionalSlots: [{ slotId: 'slot_a', condition: 'materials included', sourceQuote: 'if materials included' }],
          }),
          pref('bob', {
            conditionalSlots: [{ slotId: 'slot_b', condition: 'materials included', sourceQuote: 'if materials included' }],
          }),
          pref('p1', { acceptedSlotIds: ['slot_a'] }),
          pref('p2', { acceptedSlotIds: ['slot_a'] }),
          pref('p3', { acceptedSlotIds: ['slot_a'] }),
        ],
      }),
    );
    // slot_a is the only slot where one YES reaches the minimum of 4.
    expect(plan.suggestion?.slotId).toBe('slot_a');
    expect(plan.suggestion?.participantId).toBe('amy');
  });

  it('never re-suggests a condition whose clarification was already answered or cancelled', () => {
    const withCondition = (status: 'ANSWERED_NO' | 'ANSWERED_YES' | 'CANCELLED', answer: 'YES' | 'NO' | null) =>
      baseInput({
        preferences: [
          pref('alice', { acceptedSlotIds: ['slot_a'] }),
          pref('ben', { acceptedSlotIds: ['slot_a'] }),
          pref('cara', { acceptedSlotIds: ['slot_a'] }),
          pref('diego', {
            conditionalSlots: [{ slotId: 'slot_a', condition: 'materials included', sourceQuote: 'if materials included' }],
          }),
        ],
        clarifications: [clarification('clr_diego', 'diego', 'slot_a', { status, answer })],
      });
    expect(computePlan(withCondition('ANSWERED_NO', 'NO')).suggestion).toBeNull();
    expect(computePlan(withCondition('ANSWERED_YES', 'YES')).suggestion).toBeNull();
    expect(computePlan(withCondition('CANCELLED', null)).suggestion).toBeNull();
  });

  it('never suggests a question for a participant whose condition was already answered NO', () => {
    const plan = computePlan(
      baseInput({
        preferences: [
          pref('alice', { acceptedSlotIds: ['slot_a'] }),
          pref('ben', { acceptedSlotIds: ['slot_a'] }),
          pref('cara', { acceptedSlotIds: ['slot_a'] }),
          pref('diego', {
            conditionalSlots: [{ slotId: 'slot_a', condition: 'materials included', sourceQuote: 'if materials included' }],
          }),
        ],
        clarifications: [clarification('clr_diego', 'diego', 'slot_a', { status: 'ANSWERED_NO', answer: 'NO' })],
      }),
    );
    expect(plan.suggestion).toBeNull();
  });
});

describe('computePlan — ranking rules', () => {
  it('ranks a slot that meets the minimum ahead of one that does not', () => {
    const plan = computePlan(
      baseInput({
        minimum: 3,
        preferences: [
          pref('p1', { acceptedSlotIds: ['slot_a'], status: 'CONFIRMED' }),
          pref('p2', { acceptedSlotIds: ['slot_a'] }),
          pref('p3', { acceptedSlotIds: ['slot_b'] }),
          pref('p4', { acceptedSlotIds: ['slot_b'] }),
          pref('p5', { acceptedSlotIds: ['slot_b'] }),
        ],
      }),
    );
    expect(plan.workableSlotId).toBe('slot_b');
    expect(plan.slots[0]?.slotId).toBe('slot_b');
  });

  it('prefers fewer unresolved conditions, then more preferred matches, then ordinal', () => {
    const withConditions = computePlan(
      baseInput({
        minimum: 2,
        preferences: [
          pref('p1', { acceptedSlotIds: ['slot_a'] }),
          pref('p2', { acceptedSlotIds: ['slot_a'] }),
          pref('p3', { conditionalSlots: [{ slotId: 'slot_a', condition: 'kit included', sourceQuote: 'if kit included' }] }),
          pref('p4', { conditionalSlots: [{ slotId: 'slot_a', condition: 'apron included', sourceQuote: 'if apron included' }] }),
          pref('p5', { acceptedSlotIds: ['slot_b'] }),
          pref('p6', { acceptedSlotIds: ['slot_b'] }),
        ],
      }),
    );
    // Both meet the minimum, slot_b has no open conditions.
    expect(withConditions.slots[0]?.slotId).toBe('slot_b');
    expect(withConditions.workableSlotId).toBe('slot_b');

    const preferred = computePlan(
      baseInput({
        minimum: 2,
        preferences: [
          pref('p1', { acceptedSlotIds: ['slot_a', 'slot_b'], preferredSlotIds: ['slot_a'] }),
          pref('p2', { acceptedSlotIds: ['slot_a', 'slot_b'], preferredSlotIds: ['slot_a'] }),
        ],
      }),
    );
    expect(preferred.slots[0]?.slotId).toBe('slot_a');
    expect(preferred.slots[0]?.preferredSatisfiedCount).toBe(2);
    expect(preferred.slots[1]?.preferredSatisfiedCount).toBe(0);

    const ordinalTie = computePlan(
      baseInput({
        minimum: 1,
        preferences: [pref('p1', { acceptedSlotIds: ['slot_b', 'slot_a'] })],
      }),
    );
    expect(ordinalTie.slots.map((slot) => slot.slotId)).toEqual(['slot_a', 'slot_b', 'slot_c']);
  });
});

describe('computePlan — determinism and planInputsHash', () => {
  const input = baseInput({
    preferences: [
      pref('alice', { acceptedSlotIds: ['slot_a', 'slot_b'], preferredSlotIds: ['slot_a'] }),
      pref('ben', { acceptedSlotIds: ['slot_b'] }),
      pref('diego', {
        conditionalSlots: [{ slotId: 'slot_a', condition: 'materials included', sourceQuote: 'if materials included' }],
      }),
    ],
    clarifications: [clarification('clr_diego', 'diego', 'slot_a', { status: 'SENT' })],
  });

  it('produces byte-identical output for the same input', () => {
    const first = computePlan(input);
    const second = computePlan(JSON.parse(JSON.stringify(input)) as PlanInput);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(planInputsHash(input)).toBe(planInputsHash(JSON.parse(JSON.stringify(input)) as PlanInput));
  });

  it('returns the hash on the result and on every slot plan', () => {
    const plan = computePlan(input);
    const hash = planInputsHash(input);
    expect(plan.planInputsHash).toMatch(/^[0-9a-f]{64}$/);
    expect(plan.planInputsHash).toBe(hash);
    for (const slot of plan.slots) expect(slot.planInputsHash).toBe(hash);
  });

  it('is insensitive to preference/clarification ordering and display labels', () => {
    const reordered = baseInput({
      slots: SLOTS.slice().reverse().map((slot) => ({ ...slot })),
      preferences: input.preferences.slice().reverse().map((entry) => ({ ...entry })),
      clarifications: input.clarifications.slice().reverse().map((entry) => ({ ...entry })),
    });
    expect(planInputsHash(reordered)).toBe(planInputsHash(input));

    const relabelled = baseInput({
      ...input,
      slots: SLOTS.map((slot) => ({ ...slot, label: 'Renamed display label' })),
      preferences: input.preferences.map((entry) => ({ ...entry, displayName: 'Renamed' })),
    });
    expect(planInputsHash(relabelled)).toBe(planInputsHash(input));
  });

  it('changes whenever a confirmed preference version changes (T14/T09 dependency)', () => {
    const before = planInputsHash(input);
    const after = planInputsHash({
      ...input,
      preferences: input.preferences.map((entry) =>
        entry.participantId === 'alice' ? { ...entry, version: 2 } : entry,
      ),
    });
    expect(after).not.toBe(before);
  });

  it('changes when accepted slots, conditions or clarification answers change', () => {
    const base = planInputsHash(input);
    expect(
      planInputsHash({
        ...input,
        preferences: input.preferences.map((entry) =>
          entry.participantId === 'ben' ? { ...entry, acceptedSlotIds: [] } : entry,
        ),
      }),
    ).not.toBe(base);
    expect(
      planInputsHash({
        ...input,
        clarifications: [clarification('clr_diego', 'diego', 'slot_a', { status: 'ANSWERED_NO', answer: 'NO' })],
      }),
    ).not.toBe(base);
  });
});
