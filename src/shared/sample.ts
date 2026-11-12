/* ==========================================================================
   Sample data: a studio, a venue, six participants. It exists so a reviewer can run
   the whole loop without creating accounts or typing private material.

   The workshop dates are computed relative to "now" at seed time so the demo
   keeps working through the whole judging window (the brief requires accessible
   testing until 2026-12-15 Pacific).
   ========================================================================== */

import type { WorkshopDraftInput } from './types.js';
import { addHours, nextWeekdayInZone, zonedTimeToUtc } from './time.js';

export const SAMPLE_TIMEZONE = 'America/Los_Angeles';

export interface MerchantFact {
  label: string;
  value: string;
}

export interface SamplePreferenceSeed {
  status: 'CONFIRMED' | 'DRAFT';
  acceptedSlotIds: string[];
  preferredSlotIds: string[];
  conditions: Array<{ slotId: string; condition: string; sourceQuote: string }>;
}

export interface SamplePersona {
  key: string;
  displayName: string;
  sourceText: string;
  preference: SamplePreferenceSeed;
}

export const MERCHANT_FACTS: MerchantFact[] = [
  { label: 'Materials', value: 'All clay, tools and firing are included in the $45 price.' },
  { label: 'Cancellation', value: 'If fewer than 4 people authorize, no one is charged and any temporary hold is released.' },
  { label: 'Schedule', value: 'Each session runs two hours; the three times below are the only times the studio can offer.' },
];

/** Slot ids are stable across restarts and are what the model must reference. */
export const SLOT_IDS = { a: 'slot_a', b: 'slot_b', c: 'slot_c' } as const;

export interface SampleBundle {
  draft: WorkshopDraftInput;
  personas: SamplePersona[];
  slotLabels: { a: string; b: string; c: string };
}

export function buildSample(nowUtc: string, offsetDays = 9): SampleBundle {
  // Two consecutive weekend days, in the workshop's own timezone.
  const sat = nextWeekdayInZone(nowUtc, SAMPLE_TIMEZONE, 6, offsetDays);
  const satMidnightUtc = Date.UTC(sat.year, sat.month - 1, sat.day);
  const sunDate = new Date(satMidnightUtc + 86_400_000);
  const sun = {
    year: sunDate.getUTCFullYear(),
    month: sunDate.getUTCMonth() + 1,
    day: sunDate.getUTCDate(),
  };

  const satA = zonedTimeToUtc({ timezone: SAMPLE_TIMEZONE, ...sat, hour: 10, minute: 0 });
  const satB = zonedTimeToUtc({ timezone: SAMPLE_TIMEZONE, ...sat, hour: 13, minute: 0 });
  const sunC = zonedTimeToUtc({ timezone: SAMPLE_TIMEZONE, ...sun, hour: 10, minute: 0 });

  // The authorization window is 20 hours and always closes before the first session.
  const authDeadlineUtc = addHours(nowUtc, 20);
  const firstStart = [satA, satB, sunC].sort()[0]!;
  if (authDeadlineUtc >= firstStart) {
    throw new Error('sample data invalid: authorization deadline is after the first session');
  }

  const draft: WorkshopDraftInput = {
    merchantName: 'Clay & Co Studio',
    title: 'Two-hour pottery wheel workshop',
    description:
      'A small, hands-on wheel-throwing session for adults. You will centre, throw and trim one piece; the studio fires and glazes it after the class.',
    venue: 'Clay & Co Studio, 428 SE Ash Street, Portland, OR',
    timezone: SAMPLE_TIMEZONE,
    durationMinutes: 120,
    priceCents: 4500,
    inclusions: ['All clay and tools', 'Firing and glazing', 'Apron and towels'],
    minParticipants: 4,
    capacity: 6,
    authDeadlineUtc,
    slots: [
      { startUtc: satA, endUtc: zonedTimeToUtc({ timezone: SAMPLE_TIMEZONE, ...sat, hour: 12, minute: 0 }) },
      { startUtc: satB, endUtc: zonedTimeToUtc({ timezone: SAMPLE_TIMEZONE, ...sat, hour: 15, minute: 0 }) },
      { startUtc: sunC, endUtc: zonedTimeToUtc({ timezone: SAMPLE_TIMEZONE, ...sun, hour: 12, minute: 0 }) },
    ],
  };

  const personas: SamplePersona[] = [
    {
      key: 'alice',
      displayName: 'Alice',
      sourceText: 'Saturday morning is the only time that works for me — I have a class in the afternoon.',
      preference: { status: 'CONFIRMED', acceptedSlotIds: [SLOT_IDS.a], preferredSlotIds: [], conditions: [] },
    },
    {
      key: 'ben',
      displayName: 'Ben',
      sourceText: 'I can only do Saturday 10–12. Mornings are best for me.',
      preference: { status: 'CONFIRMED', acceptedSlotIds: [SLOT_IDS.a], preferredSlotIds: [], conditions: [] },
    },
    {
      key: 'cara',
      displayName: 'Cara',
      sourceText: 'Either Saturday morning or Saturday early afternoon works for me, I am flexible.',
      preference: { status: 'CONFIRMED', acceptedSlotIds: [SLOT_IDS.a, SLOT_IDS.b], preferredSlotIds: [], conditions: [] },
    },
    {
      key: 'diego',
      displayName: 'Diego',
      sourceText:
        "I'd prefer the afternoon session on Saturday. If all the materials are included I could maybe do Saturday morning too.",
      // Left as a draft on purpose: the demo shows Diego's own review and confirmation
      // before any plan counts him. The conditional slot never counts until he answers.
      preference: { status: 'DRAFT', acceptedSlotIds: [], preferredSlotIds: [], conditions: [] },
    },
    {
      key: 'elise',
      displayName: 'Elise',
      sourceText: 'Saturday afternoon at 1pm is the only slot I can make.',
      preference: { status: 'CONFIRMED', acceptedSlotIds: [SLOT_IDS.b], preferredSlotIds: [], conditions: [] },
    },
    {
      key: 'finn',
      displayName: 'Finn',
      sourceText: 'Sunday morning please — Saturday is impossible for me.',
      preference: { status: 'CONFIRMED', acceptedSlotIds: [SLOT_IDS.c], preferredSlotIds: [], conditions: [] },
    },
  ];

  return {
    draft,
    personas,
    slotLabels: { a: 'slot_a', b: 'slot_b', c: 'slot_c' },
  };
}

/**
 * The recorded extraction for Diego's sentence, used only when no model key is
 * configured. It is checked in, quoted verbatim, and the UI labels it
 * "Recorded sample" so nobody mistakes it for a live model answer.
 */
export const DIEGO_RECORDED_EXTRACT = {
  schema_version: '1' as const,
  source_id: 'sample_diego',
  accepted_slot_ids: [SLOT_IDS.b],
  preferred_slot_ids: [SLOT_IDS.b],
  conditional_slots: [
    {
      slot_id: SLOT_IDS.a,
      condition: 'all the materials are included',
      source_quote: 'If all the materials are included I could maybe do Saturday morning too.',
    },
  ],
  uncertainties: [],
  requires_confirmation: true as const,
};
