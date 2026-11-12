/* Shared fixed-clock fixtures for domain tests. No wall clock, no network. */

import type { OfferTerms, WorkshopDraftInput } from '../../src/shared/types.js';

export const NOW = '2026-11-12T04:00:00Z';
export const AUTH_DEADLINE = '2026-11-13T00:00:00Z';
export const TZ = 'America/Los_Angeles';

/** Saturday Nov 21 2026 (10:00–12:00 / 13:00–15:00 PST) and Sunday Nov 22 (10:00–12:00 PST). */
export const SLOT_A_START = '2026-11-21T18:00:00Z';
export const SLOT_A_END = '2026-11-21T20:00:00Z';
export const SLOT_B_START = '2026-11-21T21:00:00Z';
export const SLOT_B_END = '2026-11-21T23:00:00Z';
export const SLOT_C_START = '2026-11-22T18:00:00Z';
export const SLOT_C_END = '2026-11-22T20:00:00Z';

export function makeDraft(overrides: Partial<WorkshopDraftInput> = {}): WorkshopDraftInput {
  return {
    merchantName: 'Clay & Co Studio (fictional)',
    title: 'Two-hour pottery wheel workshop',
    description: 'A small, hands-on wheel-throwing session for adults.',
    venue: 'Clay & Co Studio, 428 SE Ash Street, Portland, OR (fictional address)',
    timezone: TZ,
    durationMinutes: 120,
    priceCents: 4500,
    inclusions: ['All clay and tools', 'Firing and glazing', 'Apron and towels'],
    minParticipants: 4,
    capacity: 6,
    authDeadlineUtc: AUTH_DEADLINE,
    slots: [
      { startUtc: SLOT_A_START, endUtc: SLOT_A_END },
      { startUtc: SLOT_B_START, endUtc: SLOT_B_END },
      { startUtc: SLOT_C_START, endUtc: SLOT_C_END },
    ],
    ...overrides,
  };
}

export function makeTerms(overrides: Partial<OfferTerms> = {}): OfferTerms {
  return {
    schemaVersion: 1,
    workshopId: 'wsh_1',
    offerVersion: 1,
    merchantName: 'Clay & Co Studio (fictional)',
    workshopTitle: 'Two-hour pottery wheel workshop',
    workshopDescription: 'A small, hands-on wheel-throwing session for adults.',
    venue: 'Clay & Co Studio, 428 SE Ash Street, Portland, OR (fictional address)',
    timezone: TZ,
    slotId: 'slot_a',
    startUtc: SLOT_A_START,
    endUtc: SLOT_A_END,
    durationMinutes: 120,
    priceCents: 4500,
    currency: 'USD',
    inclusions: ['All clay and tools', 'Firing and glazing', 'Apron and towels'],
    minParticipants: 4,
    capacity: 6,
    authDeadlineUtc: AUTH_DEADLINE,
    cancellationPolicyVersion: 'v1',
    cancellationSummary: 'If fewer than the minimum authorize, no one is charged and holds are released.',
    failureHandlingSummary: 'If any payment cannot be collected the workshop is not confirmed; holds are released and captured amounts refunded.',
    ...overrides,
  };
}
