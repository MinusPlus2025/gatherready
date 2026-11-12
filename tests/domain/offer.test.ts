import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  canonicalOfferJson,
  CONSENT_CHECKBOX_LABEL,
  CONSENT_TEXT_VERSION,
  consentText,
  hashOfferTerms,
  offerTermsRows,
  validateOfferTerms,
} from '../../src/server/domain/offer.js';
import { formatInstantLabel } from '../../src/shared/time.js';
import { AUTH_DEADLINE, makeTerms, SLOT_A_END, SLOT_A_START, TZ } from './helpers.js';

type Result = ReturnType<typeof validateOfferTerms>;

function expectError(result: Result, field: string): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.errors.map((error) => error.field)).toContain(field);
}

describe('canonicalOfferJson / hashOfferTerms', () => {
  it('serialises sorted keys without insignificant whitespace', () => {
    const canonical = canonicalOfferJson(makeTerms());
    expect(canonical.startsWith('{"authDeadlineUtc":"2026-11-13T00:00:00Z","cancellationPolicyVersion"')).toBe(true);
    expect(canonical.endsWith('"workshopTitle":"Two-hour pottery wheel workshop"}')).toBe(true);
    expect(canonical).not.toContain('\n');
    expect(canonical).toBe(JSON.stringify(JSON.parse(canonical), Object.keys(makeTerms()).sort()));
  });

  it('hashes the canonical JSON with sha256 hex', () => {
    const terms = makeTerms();
    const expected = createHash('sha256').update(canonicalOfferJson(terms), 'utf8').digest('hex');
    expect(hashOfferTerms(terms)).toBe(expected);
    expect(hashOfferTerms(terms)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is independent of object key insertion order', () => {
    const terms = makeTerms();
    const reversed = Object.fromEntries(Object.entries(terms).reverse()) as typeof terms;
    expect(canonicalOfferJson(reversed)).toBe(canonicalOfferJson(terms));
    expect(hashOfferTerms(reversed)).toBe(hashOfferTerms(terms));
  });

  it('changes whenever any frozen term changes (immutability)', () => {
    const base = hashOfferTerms(makeTerms());
    const variants = [
      makeTerms({ priceCents: 4600 }),
      makeTerms({ startUtc: '2026-11-21T19:00:00Z' }),
      makeTerms({ endUtc: '2026-11-21T21:00:00Z' }),
      makeTerms({ inclusions: ['All clay and tools'] }),
      makeTerms({ minParticipants: 5 }),
      makeTerms({ capacity: 8 }),
      makeTerms({ merchantName: 'Other Studio' }),
      makeTerms({ authDeadlineUtc: '2026-11-13T01:00:00Z' }),
      makeTerms({ offerVersion: 2 }),
    ];
    for (const variant of variants) expect(hashOfferTerms(variant)).not.toBe(base);
  });

  it('T14: a consent recorded against old terms cannot match changed terms', () => {
    const published = makeTerms();
    const storedConsent = { offerHash: hashOfferTerms(published), textVersion: CONSENT_TEXT_VERSION };
    const priceChanged = makeTerms({ priceCents: 4600 });
    expect(storedConsent.offerHash).toBe(hashOfferTerms(published));
    expect(storedConsent.offerHash).not.toBe(hashOfferTerms(priceChanged));
    // Re-confirming the same terms is the only way the old consent stays valid.
    expect(hashOfferTerms(makeTerms())).toBe(storedConsent.offerHash);
  });
});

describe('validateOfferTerms', () => {
  it('accepts valid terms and returns normalised values', () => {
    const result = validateOfferTerms(makeTerms({ merchantName: '  Clay & Co  ' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.merchantName).toBe('Clay & Co');
    expect(result.value.startUtc).toBe(SLOT_A_START);
    expect(result.value.endUtc).toBe(SLOT_A_END);
    expect(result.value.authDeadlineUtc).toBe(AUTH_DEADLINE);
  });

  it('rejects non-integer or non-positive prices', () => {
    expectError(validateOfferTerms(makeTerms({ priceCents: 4500.5 })), 'priceCents');
    expectError(validateOfferTerms(makeTerms({ priceCents: 0 })), 'priceCents');
    expectError(validateOfferTerms(makeTerms({ priceCents: -1 })), 'priceCents');
  });

  it('rejects any currency other than USD', () => {
    expectError(validateOfferTerms(makeTerms({ currency: 'EUR' as never })), 'currency');
  });

  it('rejects missing or blank inclusions', () => {
    expectError(validateOfferTerms(makeTerms({ inclusions: [] })), 'inclusions');
    expectError(validateOfferTerms(makeTerms({ inclusions: ['clay', ' '] })), 'inclusions.1');
  });

  it('rejects a minimum larger than the capacity', () => {
    expectError(validateOfferTerms(makeTerms({ minParticipants: 7, capacity: 6 })), 'minParticipants');
  });

  it('rejects a session that does not start after the authorization deadline', () => {
    expectError(
      validateOfferTerms(makeTerms({ startUtc: '2026-11-13T00:00:00Z', endUtc: '2026-11-13T02:00:00Z' })),
      'authDeadlineUtc',
    );
    expectError(
      validateOfferTerms(makeTerms({ startUtc: '2026-11-12T22:00:00Z', endUtc: '2026-11-13T00:30:00Z' })),
      'authDeadlineUtc',
    );
  });

  it('rejects unsupported timezones and malformed instants', () => {
    expectError(validateOfferTerms(makeTerms({ timezone: 'Not/AZone' })), 'timezone');
    expectError(validateOfferTerms(makeTerms({ startUtc: 'Saturday 10am' })), 'startUtc');
    expectError(validateOfferTerms(makeTerms({ endUtc: '2026-11-21T17:00:00Z' })), 'endUtc');
  });

  it('rejects missing display-critical text', () => {
    expectError(validateOfferTerms(makeTerms({ workshopDescription: '  ' })), 'workshopDescription');
    expectError(validateOfferTerms(makeTerms({ cancellationSummary: '' })), 'cancellationSummary');
    expectError(validateOfferTerms(makeTerms({ failureHandlingSummary: '' })), 'failureHandlingSummary');
  });
});

describe('offerTermsRows', () => {
  it('returns the brief §4.6 rows in order', () => {
    const rows = offerTermsRows(makeTerms());
    expect(rows.map((row) => row.label)).toEqual([
      'Merchant',
      'Workshop',
      'Date & time',
      'Timezone',
      'Venue',
      'Includes',
      'Total',
      'Minimum',
      'Authorization deadline',
      'Cancellation',
      'If collection fails',
    ]);
  });

  it('formats money in integer cents and dates in the workshop timezone', () => {
    const rows = new Map(offerTermsRows(makeTerms()).map((row) => [row.label, row.value]));
    expect(rows.get('Total')).toBe('$45.00 USD');
    expect(rows.get('Date & time')).toBe('Saturday, November 21, 2026 · 10:00–12:00');
    expect(rows.get('Timezone')).toBe(TZ);
    expect(rows.get('Minimum')).toBe('4 participants minimum (capacity 6)');
    expect(rows.get('Authorization deadline')).toBe(formatInstantLabel(AUTH_DEADLINE, TZ));
    expect(rows.get('Includes')).toBe('All clay and tools · Firing and glazing · Apron and towels');
    expect(rows.get('Merchant')).toBe('Clay & Co Studio (fictional)');
  });
});

describe('consent copy', () => {
  it('is fixed, versioned product copy about a hold, capture only after enough authorizations, and refunds', () => {
    const text = consentText();
    expect(CONSENT_TEXT_VERSION).toBe('gr-consent-1');
    expect(text).toContain('temporary hold');
    expect(text).toContain('$45.00 USD');
    expect(text).toContain('only charged after enough people authorize this exact plan');
    expect(text).toContain('released and I am not charged');
    expect(text).toContain('refunded in full');
    expect(text).toBe(consentText());
    expect(CONSENT_CHECKBOX_LABEL).toContain('temporary hold');
    expect(CONSENT_CHECKBOX_LABEL).toContain('authorize this exact plan');
  });
});
