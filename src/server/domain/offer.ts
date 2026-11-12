/* ==========================================================================
   Offer terms, immutable hash, display rows and consent copy (CONTRACT §3.3)

   Safety decisions:
   - The offer hash is sha256 over canonical JSON (sorted keys, no whitespace),
     so it is stable across restarts and independent of object key order. Every
     consent, payment and settlement batch stores this hash: if the terms change,
     the stored consent can no longer match and the participant has to see and
     accept the new terms before any money moves.
   - The consent sentence is fixed product copy (parameterless). It is the exact
     text the participant authorises: a temporary hold, capture only after enough
     people authorise this exact plan, release when it is not confirmed, and
     refunds if collection fails. It deliberately contains no data the merchant
     could vary after consent.
   - Terms validation rejects anything that would let a participant be shown or
     charged a different plan than the one that was priced.
   ========================================================================== */

import { createHash } from 'node:crypto';
import { formatDayLabel, formatInstantLabel, formatTimeRange, isValidTimezone } from '../../shared/time.js';
import type { FieldError, OfferTerms, ValidationResult } from '../../shared/types.js';

/* ------------------------------ canonical JSON --------------------------- */

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Deterministic JSON: object keys sorted, no insignificant whitespace.
 * Array order is preserved (the order of `inclusions` is meaningful display
 * order and is part of what the participant accepts).
 */
export function canonicalOfferJson(terms: OfferTerms): string {
  return canonicalize(terms);
}

function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort(compare);
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('cannot canonicalise a non-finite number');
    return JSON.stringify(value);
  }
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  throw new Error(`cannot canonicalise value of type ${typeof value}`);
}

/** sha256 hex of the canonical JSON. Stable regardless of key insertion order. */
export function hashOfferTerms(terms: OfferTerms): string {
  return createHash('sha256').update(canonicalOfferJson(terms), 'utf8').digest('hex');
}

/* ------------------------------- validation ------------------------------ */

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function normalizeInstant(value: unknown): string | null {
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

export function validateOfferTerms(terms: OfferTerms): ValidationResult<OfferTerms> {
  const errors: FieldError[] = [];
  const add = (field: string, message: string): void => {
    errors.push({ field, message });
  };

  if (terms?.schemaVersion !== 1) add('schemaVersion', 'offer terms schema version must be 1');
  const workshopId = text(terms?.workshopId);
  const slotId = text(terms?.slotId);
  const merchantName = text(terms?.merchantName);
  const workshopTitle = text(terms?.workshopTitle);
  const workshopDescription = text(terms?.workshopDescription);
  const venue = text(terms?.venue);
  const timezone = text(terms?.timezone);
  const cancellationPolicyVersion = text(terms?.cancellationPolicyVersion);
  const cancellationSummary = text(terms?.cancellationSummary);
  const failureHandlingSummary = text(terms?.failureHandlingSummary);

  if (!workshopId) add('workshopId', 'workshop id is required');
  if (!slotId) add('slotId', 'slot id is required');
  if (!merchantName) add('merchantName', 'merchant name is required');
  if (!workshopTitle) add('workshopTitle', 'workshop title is required');
  if (!workshopDescription) add('workshopDescription', 'workshop description is required');
  if (!venue) add('venue', 'venue is required');
  if (!cancellationPolicyVersion) add('cancellationPolicyVersion', 'cancellation policy version is required');
  if (!cancellationSummary) add('cancellationSummary', 'cancellation summary is required');
  if (!failureHandlingSummary) add('failureHandlingSummary', 'failure handling summary is required');

  if (!timezone) {
    add('timezone', 'timezone is required');
  } else if (!isValidTimezone(timezone)) {
    add('timezone', `"${timezone}" is not a valid IANA timezone`);
  }

  if (!isPositiveInteger(terms?.offerVersion)) add('offerVersion', 'offer version must be a positive whole number');
  if (!isPositiveInteger(terms?.durationMinutes)) add('durationMinutes', 'duration must be a positive whole number');

  const priceCents = terms?.priceCents;
  if (!isPositiveInteger(priceCents)) {
    add('priceCents', 'price must be a positive integer number of cents');
  }
  if (terms?.currency !== 'USD') add('currency', 'only USD offers are supported');

  const inclusions: string[] = [];
  if (!Array.isArray(terms?.inclusions) || terms.inclusions.length === 0) {
    add('inclusions', 'at least one inclusion is required');
  } else {
    terms.inclusions.forEach((raw, index) => {
      const value = text(raw);
      if (!value) add(`inclusions.${index}`, 'inclusion text cannot be blank');
      else inclusions.push(value);
    });
  }

  const minParticipants = terms?.minParticipants;
  const capacity = terms?.capacity;
  if (!isPositiveInteger(minParticipants)) add('minParticipants', 'minimum participants must be a positive whole number');
  if (!isPositiveInteger(capacity)) add('capacity', 'capacity must be a positive whole number');
  if (isPositiveInteger(minParticipants) && isPositiveInteger(capacity) && minParticipants > capacity) {
    add('minParticipants', 'minimum participants cannot exceed capacity');
  }

  const startUtc = normalizeInstant(terms?.startUtc);
  const endUtc = normalizeInstant(terms?.endUtc);
  const authDeadlineUtc = normalizeInstant(terms?.authDeadlineUtc);
  if (!startUtc) add('startUtc', 'start must be a UTC instant ending in Z');
  if (!endUtc) add('endUtc', 'end must be a UTC instant ending in Z');
  if (!authDeadlineUtc) add('authDeadlineUtc', 'authorization deadline must be a UTC instant ending in Z');
  if (startUtc && endUtc && Date.parse(endUtc) <= Date.parse(startUtc)) {
    add('endUtc', 'the session must end after it starts');
  }
  if (startUtc && authDeadlineUtc && Date.parse(startUtc) <= Date.parse(authDeadlineUtc)) {
    add('authDeadlineUtc', 'the session must start after the authorization deadline');
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      ...terms,
      workshopId,
      slotId,
      merchantName,
      workshopTitle,
      workshopDescription,
      venue,
      timezone,
      startUtc: startUtc!,
      endUtc: endUtc!,
      authDeadlineUtc: authDeadlineUtc!,
      inclusions,
      cancellationPolicyVersion,
      cancellationSummary,
      failureHandlingSummary,
    },
  };
}

/* ------------------------------ display rows ----------------------------- */

function moneyLabel(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const fraction = Math.abs(cents % 100);
  return `$${whole}.${String(fraction).padStart(2, '0')} USD`;
}

/**
 * Rows the participant must see before the PayPal button, in the brief's
 * §4.6 order. Every value is derived from the frozen terms served here.
 */
export function offerTermsRows(terms: OfferTerms): Array<{ label: string; value: string }> {
  const dateTime = `${formatDayLabel(terms.startUtc, terms.timezone)} · ${formatTimeRange(
    terms.startUtc,
    terms.endUtc,
    terms.timezone,
  )}`;
  return [
    { label: 'Merchant', value: terms.merchantName },
    { label: 'Workshop', value: terms.workshopTitle },
    { label: 'Date & time', value: dateTime },
    { label: 'Timezone', value: terms.timezone },
    { label: 'Venue', value: terms.venue },
    { label: 'Includes', value: terms.inclusions.join(' · ') },
    { label: 'Total', value: moneyLabel(terms.priceCents) },
    { label: 'Minimum', value: `${terms.minParticipants} participants minimum (capacity ${terms.capacity})` },
    { label: 'Authorization deadline', value: formatInstantLabel(terms.authDeadlineUtc, terms.timezone) },
    { label: 'Cancellation', value: terms.cancellationSummary },
    { label: 'If collection fails', value: terms.failureHandlingSummary },
  ];
}

/* -------------------------------- consent -------------------------------- */

/** Bump only when the fixed consent sentence below changes. */
export const CONSENT_TEXT_VERSION = 'gr-consent-1';

export const CONSENT_CHECKBOX_LABEL =
  'I understand this authorizes a temporary hold of $45.00, and that I will be charged only if enough people authorize this exact plan.';

/**
 * The exact fixed English consent paragraph. Parameterless on purpose: it is
 * product copy, not merchant-editable data, and it is the same sentence whose
 * version is stored on every consent row.
 */
export function consentText(): string {
  return (
    'I authorize a temporary hold of $45.00 USD on my payment method for this exact plan. ' +
    'My payment method is only charged after enough people authorize this exact plan, and only before the authorization deadline. ' +
    'If not enough people authorize, the temporary hold is released and I am not charged. ' +
    'If collection fails after charges begin, my payment is refunded in full.'
  );
}
