/* ==========================================================================
   Workshop draft validation (CONTRACT §3.1)

   Safety decisions:
   - The workshop what/when/price is validated here once, before it can reach a
     participant or an offer. Every later money path uses these normalised
     values, never a client round-trip.
   - Instants are canonical UTC (`…Z`). The workshop timezone is used only for
     display labels through src/shared/time.ts — no hand-rolled zone math here.
   - Slot ids are positional (`slot_a`/`slot_b`/`slot_c`) so the model, the
     offer hash and the participant screens all reference the same stable ids.
   ========================================================================== */

import { formatDayLabel, formatTimeRange, isValidTimezone } from '../../shared/time.js';
import type { FieldError, IsoUtc, ValidationResult, WorkshopDraftInput } from '../../shared/types.js';

export interface ValidatedSlot {
  id: string;
  ordinal: 1 | 2 | 3;
  startUtc: IsoUtc;
  endUtc: IsoUtc;
  dayLabel: string;
  timeLabel: string;
}

export interface ValidatedWorkshop {
  merchantName: string;
  title: string;
  description: string;
  venue: string;
  timezone: string;
  durationMinutes: number;
  priceCents: number;
  inclusions: string[];
  minParticipants: number;
  capacity: number;
  authDeadlineUtc: IsoUtc;
  slots: ValidatedSlot[];
}

/** Stable positional ids; the input order is the offer's order. */
export const SLOT_IDS = ['slot_a', 'slot_b', 'slot_c'] as const;

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MAX_SLOTS = 3;

function normalizeInstant(value: unknown): IsoUtc | null {
  if (typeof value !== 'string' || !ISO_UTC.test(value)) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().replace(/\.000Z$/, 'Z');
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** Human label pair for one slot, always rendered in the workshop timezone. */
export function slotLabels(
  startUtc: string,
  endUtc: string,
  timezone: string,
): { dayLabel: string; timeLabel: string } {
  return {
    dayLabel: formatDayLabel(startUtc, timezone),
    timeLabel: formatTimeRange(startUtc, endUtc, timezone),
  };
}

export function validateWorkshopDraft(
  input: WorkshopDraftInput,
  nowUtc: string,
): ValidationResult<ValidatedWorkshop> {
  const errors: FieldError[] = [];
  const add = (field: string, message: string): void => {
    errors.push({ field, message });
  };

  const merchantName = text(input?.merchantName);
  const title = text(input?.title);
  const description = text(input?.description);
  const venue = text(input?.venue);
  const timezone = text(input?.timezone);

  if (!merchantName) add('merchantName', 'merchant name is required');
  if (!title) add('title', 'workshop title is required');
  if (!description) add('description', 'workshop description is required');
  if (!venue) add('venue', 'venue is required');
  if (!timezone) {
    add('timezone', 'timezone is required');
  } else if (!isValidTimezone(timezone)) {
    add('timezone', `"${timezone}" is not a valid IANA timezone`);
  }

  const durationMinutes = input?.durationMinutes;
  if (!isPositiveInteger(durationMinutes)) add('durationMinutes', 'duration must be a positive whole number of minutes');

  const priceCents = input?.priceCents;
  if (!isPositiveInteger(priceCents)) add('priceCents', 'price must be a positive integer number of cents');

  const minParticipants = input?.minParticipants;
  const capacity = input?.capacity;
  if (!isPositiveInteger(minParticipants)) add('minParticipants', 'minimum participants must be a positive whole number');
  if (!isPositiveInteger(capacity)) add('capacity', 'capacity must be a positive whole number');
  if (isPositiveInteger(minParticipants) && isPositiveInteger(capacity) && minParticipants > capacity) {
    add('minParticipants', 'minimum participants cannot exceed capacity');
  }

  const inclusions: string[] = [];
  if (!Array.isArray(input?.inclusions)) {
    add('inclusions', 'inclusions must be a list');
  } else {
    input.inclusions.forEach((raw, index) => {
      const value = text(raw);
      if (!value) add(`inclusions.${index}`, 'inclusion text cannot be blank');
      else inclusions.push(value);
    });
  }

  const authDeadlineUtc = normalizeInstant(input?.authDeadlineUtc);
  const nowMs = Date.parse(nowUtc);
  if (!authDeadlineUtc) {
    add('authDeadlineUtc', 'authorization deadline must be a UTC instant ending in Z');
  } else if (Number.isNaN(nowMs)) {
    add('authDeadlineUtc', 'the current time is not a valid instant');
  } else if (Date.parse(authDeadlineUtc) <= nowMs) {
    add('authDeadlineUtc', 'authorization deadline must be in the future');
  }

  const rawSlots = Array.isArray(input?.slots) ? input.slots : [];
  if (rawSlots.length < 1) add('slots', 'at least one time slot is required');
  if (rawSlots.length > MAX_SLOTS) add('slots', `at most ${MAX_SLOTS} time slots are allowed`);

  interface ParsedSlot {
    startUtc: IsoUtc;
    endUtc: IsoUtc;
    startMs: number;
    endMs: number;
    index: number;
  }
  const parsed: ParsedSlot[] = [];
  rawSlots.slice(0, MAX_SLOTS).forEach((raw, index) => {
    const startUtc = normalizeInstant(raw?.startUtc);
    const endUtc = normalizeInstant(raw?.endUtc);
    if (!startUtc) add(`slots.${index}.startUtc`, 'start must be a UTC instant ending in Z');
    if (!endUtc) add(`slots.${index}.endUtc`, 'end must be a UTC instant ending in Z');
    if (!startUtc || !endUtc) return;
    const startMs = Date.parse(startUtc);
    const endMs = Date.parse(endUtc);
    if (endMs <= startMs) {
      add(`slots.${index}.endUtc`, 'each slot must end after it starts');
      return;
    }
    parsed.push({ startUtc, endUtc, startMs, endMs, index });
  });

  const ordered = parsed.slice().sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1]!;
    const current = ordered[i]!;
    if (current.startMs < previous.endMs) {
      add(`slots.${current.index}.startUtc`, 'time slots must not overlap');
    }
  }

  if (authDeadlineUtc && parsed.length > 0) {
    const earliestStart = Math.min(...parsed.map((slot) => slot.startMs));
    if (earliestStart <= Date.parse(authDeadlineUtc)) {
      add('slots', 'the first session must start after the authorization deadline');
    } else {
      parsed.forEach((slot) => {
        if (slot.startMs <= Date.parse(authDeadlineUtc)) {
          add(`slots.${slot.index}.startUtc`, 'every session must start after the authorization deadline');
        }
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const slots: ValidatedSlot[] = parsed
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((slot, position) => {
      const labels = slotLabels(slot.startUtc, slot.endUtc, timezone);
      return {
        id: SLOT_IDS[position]!,
        ordinal: (position + 1) as 1 | 2 | 3,
        startUtc: slot.startUtc,
        endUtc: slot.endUtc,
        dayLabel: labels.dayLabel,
        timeLabel: labels.timeLabel,
      };
    });

  return {
    ok: true,
    value: {
      merchantName,
      title,
      description,
      venue,
      timezone,
      durationMinutes,
      priceCents,
      inclusions,
      minParticipants,
      capacity,
      authDeadlineUtc: authDeadlineUtc!,
      slots,
    },
  };
}
