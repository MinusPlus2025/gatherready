import { describe, expect, it } from 'vitest';

import { slotLabels, validateWorkshopDraft } from '../../src/server/domain/validation.js';
import { AUTH_DEADLINE, makeDraft, NOW, SLOT_A_END, SLOT_A_START, TZ } from './helpers.js';

type Result = ReturnType<typeof validateWorkshopDraft>;

function expectError(result: Result, field: string): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.errors.map((error) => error.field)).toContain(field);
}

describe('slotLabels', () => {
  it('renders both labels in the workshop timezone', () => {
    expect(slotLabels(SLOT_A_START, SLOT_A_END, TZ)).toEqual({
      dayLabel: 'Saturday, November 21, 2026',
      timeLabel: '10:00–12:00',
    });
  });
});

describe('validateWorkshopDraft', () => {
  it('accepts a valid draft and assigns stable positional slot ids in input order', () => {
    const result = validateWorkshopDraft(makeDraft(), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slots.map((slot) => slot.id)).toEqual(['slot_a', 'slot_b', 'slot_c']);
    expect(result.value.slots.map((slot) => slot.ordinal)).toEqual([1, 2, 3]);
    expect(result.value.slots[0]).toMatchObject({
      dayLabel: 'Saturday, November 21, 2026',
      timeLabel: '10:00–12:00',
    });
    expect(result.value.slots[2]).toMatchObject({
      dayLabel: 'Sunday, November 22, 2026',
      timeLabel: '10:00–12:00',
    });
    expect(result.value.priceCents).toBe(4500);
    expect(result.value.timezone).toBe(TZ);
    expect(result.value.authDeadlineUtc).toBe(AUTH_DEADLINE);
  });

  it('trims text fields, inclusions and canonicalises instants', () => {
    const result = validateWorkshopDraft(
      makeDraft({
        merchantName: '  Clay & Co  ',
        title: ' Pottery ',
        inclusions: [' clay ', ' firing '],
        slots: [{ startUtc: '2026-11-21T18:00:00.000Z', endUtc: '2026-11-21T20:00:00.000Z' }],
        authDeadlineUtc: '2026-11-13T00:00:00.000Z',
      }),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.merchantName).toBe('Clay & Co');
    expect(result.value.title).toBe('Pottery');
    expect(result.value.inclusions).toEqual(['clay', 'firing']);
    expect(result.value.slots[0]?.startUtc).toBe('2026-11-21T18:00:00Z');
    expect(result.value.authDeadlineUtc).toBe('2026-11-13T00:00:00Z');
  });

  it('rejects zero slots and more than three slots', () => {
    expectError(validateWorkshopDraft(makeDraft({ slots: [] }), NOW), 'slots');
    expectError(
      validateWorkshopDraft(
        makeDraft({
          slots: [
            { startUtc: '2026-11-21T18:00:00Z', endUtc: '2026-11-21T20:00:00Z' },
            { startUtc: '2026-11-21T21:00:00Z', endUtc: '2026-11-21T23:00:00Z' },
            { startUtc: '2026-11-22T18:00:00Z', endUtc: '2026-11-22T20:00:00Z' },
            { startUtc: '2026-11-22T21:00:00Z', endUtc: '2026-11-22T23:00:00Z' },
          ],
        }),
        NOW,
      ),
      'slots',
    );
  });

  it('rejects overlapping slots, including touching-only start times', () => {
    expectError(
      validateWorkshopDraft(
        makeDraft({
          slots: [
            { startUtc: '2026-11-21T18:00:00Z', endUtc: '2026-11-21T21:00:00Z' },
            { startUtc: '2026-11-21T20:00:00Z', endUtc: '2026-11-21T22:00:00Z' },
          ],
        }),
        NOW,
      ),
      'slots.1.startUtc',
    );
  });

  it('rejects a slot that ends before it starts', () => {
    expectError(
      validateWorkshopDraft(
        makeDraft({ slots: [{ startUtc: '2026-11-21T20:00:00Z', endUtc: '2026-11-21T18:00:00Z' }] }),
        NOW,
      ),
      'slots.0.endUtc',
    );
  });

  it('rejects a session that starts before the authorization deadline', () => {
    expectError(
      validateWorkshopDraft(
        makeDraft({ slots: [{ startUtc: '2026-11-12T23:00:00Z', endUtc: '2026-11-13T01:00:00Z' }] }),
        NOW,
      ),
      'slots',
    );
  });

  it('rejects an authorization deadline that is not in the future', () => {
    expectError(validateWorkshopDraft(makeDraft({ authDeadlineUtc: NOW }), NOW), 'authDeadlineUtc');
    expectError(validateWorkshopDraft(makeDraft({ authDeadlineUtc: '2026-11-11T00:00:00Z' }), NOW), 'authDeadlineUtc');
  });

  it('requires integer, positive money in cents', () => {
    expectError(validateWorkshopDraft(makeDraft({ priceCents: 0 }), NOW), 'priceCents');
    expectError(validateWorkshopDraft(makeDraft({ priceCents: 4500.5 }), NOW), 'priceCents');
    expectError(validateWorkshopDraft(makeDraft({ priceCents: -4500 }), NOW), 'priceCents');
  });

  it('rejects a minimum larger than the capacity', () => {
    expectError(validateWorkshopDraft(makeDraft({ minParticipants: 7, capacity: 6 }), NOW), 'minParticipants');
  });

  it('rejects an unsupported timezone', () => {
    expectError(validateWorkshopDraft(makeDraft({ timezone: 'Mars/Olympus_Mons' }), NOW), 'timezone');
    expectError(validateWorkshopDraft(makeDraft({ timezone: '' }), NOW), 'timezone');
  });

  it('rejects blank text fields and blank inclusions', () => {
    expectError(validateWorkshopDraft(makeDraft({ merchantName: '   ' }), NOW), 'merchantName');
    expectError(validateWorkshopDraft(makeDraft({ title: '' }), NOW), 'title');
    expectError(validateWorkshopDraft(makeDraft({ description: '  ' }), NOW), 'description');
    expectError(validateWorkshopDraft(makeDraft({ venue: '' }), NOW), 'venue');
    expectError(validateWorkshopDraft(makeDraft({ inclusions: ['All clay', '   '] }), NOW), 'inclusions.1');
  });

  it('rejects instants that are not UTC ISO with a Z suffix', () => {
    expectError(
      validateWorkshopDraft(
        makeDraft({ slots: [{ startUtc: '2026-11-21T10:00:00-08:00', endUtc: SLOT_A_END }] }),
        NOW,
      ),
      'slots.0.startUtc',
    );
    expectError(
      validateWorkshopDraft(makeDraft({ slots: [{ startUtc: 'not a date', endUtc: SLOT_A_END }] }), NOW),
      'slots.0.startUtc',
    );
  });

  it('rejects an invalid duration', () => {
    expectError(validateWorkshopDraft(makeDraft({ durationMinutes: 0 }), NOW), 'durationMinutes');
    expectError(validateWorkshopDraft(makeDraft({ durationMinutes: 120.5 }), NOW), 'durationMinutes');
  });
});
