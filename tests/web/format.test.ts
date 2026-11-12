/* ==========================================================================
   Pure display-logic tests for the web layer. They run without a DOM so they
   stay fast and deterministic: money stays integer cents, the countdown reads
   UTC, and status words never collapse "refund requested" into "refunded".
   ========================================================================== */

import { describe, expect, it } from 'vitest';
import {
  countdownFor,
  formatCents,
  formatRemaining,
  fundingStage,
  isoFromZoneInput,
  parseDollarsToCents,
  paymentStatusWord,
  preferenceStatusWord,
  zoneInputFromIso,
} from '../../src/web/lib/format.js';

describe('formatCents', () => {
  it('renders integer cents as USD without ever parsing display strings', () => {
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(5)).toBe('$0.05');
    expect(formatCents(4500)).toBe('$45.00');
    expect(formatCents(18000)).toBe('$180.00');
    expect(formatCents(123456789)).toBe('$1,234,567.89');
  });

  it('never shows a fraction for a non-integer value', () => {
    expect(formatCents(45.6)).toBe('$0.00');
  });
});

describe('parseDollarsToCents', () => {
  it('accepts whole and decimal dollar amounts as integer cents', () => {
    expect(parseDollarsToCents('45')).toBe(4500);
    expect(parseDollarsToCents('45.5')).toBe(4550);
    expect(parseDollarsToCents('45.50')).toBe(4550);
    expect(parseDollarsToCents(' 0.99 ')).toBe(99);
  });

  it('rejects anything that is not a plain positive amount', () => {
    expect(parseDollarsToCents('')).toBeNull();
    expect(parseDollarsToCents('0')).toBeNull();
    expect(parseDollarsToCents('-5')).toBeNull();
    expect(parseDollarsToCents('45.555')).toBeNull();
    expect(parseDollarsToCents('1,045')).toBeNull();
    expect(parseDollarsToCents('45abc')).toBeNull();
    expect(parseDollarsToCents('4 5')).toBeNull();
  });
});

describe('formatRemaining + countdownFor', () => {
  it('formats remaining time without going negative', () => {
    expect(formatRemaining(0)).toBe('0m');
    expect(formatRemaining(-1000)).toBe('0m');
    expect(formatRemaining(90 * 60_000)).toBe('1h 30m');
    expect(formatRemaining(25 * 3_600_000)).toBe('1d 1h');
  });

  it('derives remaining time from the server UTC instant, not the device clock', () => {
    const fetchedAt = Date.parse('2026-11-12T12:00:00Z');
    const view = countdownFor(
      '2026-11-13T08:00:00Z',
      '2026-11-12T12:00:00Z',
      fetchedAt,
      fetchedAt + 2 * 3_600_000,
    );
    expect(view.expired).toBe(false);
    expect(view.label).toBe('18h 0m');
    expect(view.detail).toContain('authorization window');
  });

  it('reports an expired window', () => {
    const fetchedAt = Date.parse('2026-11-13T09:00:00Z');
    const view = countdownFor('2026-11-13T08:00:00Z', '2026-11-13T09:00:00Z', fetchedAt, fetchedAt);
    expect(view.expired).toBe(true);
    expect(view.label).toBe('0m');
  });

  it('handles a missing deadline without inventing one', () => {
    const view = countdownFor(null, null, Date.now());
    expect(view.expired).toBe(false);
    expect(view.label).toBe('—');
  });
});

describe('timezone input helpers', () => {
  it('renders a datetime-local value in the workshop zone and converts it back', () => {
    expect(zoneInputFromIso('2026-11-21T18:00:00Z', 'America/Los_Angeles')).toBe('2026-11-21T10:00');
    expect(isoFromZoneInput('2026-11-21T10:00', 'America/Los_Angeles')).toBe('2026-11-21T18:00:00Z');
    expect(isoFromZoneInput('not a time', 'America/Los_Angeles')).toBeNull();
  });
});

describe('status words pair with colours and never merge distinct money states', () => {
  it('keeps a refund request distinct from a confirmed refund', () => {
    expect(paymentStatusWord.REFUNDING).not.toBe(paymentStatusWord.REFUNDED);
    expect(paymentStatusWord.REFUNDING.toLowerCase()).toContain('waiting');
    expect(paymentStatusWord.REFUNDING.toLowerCase()).toContain('refund requested');
    expect(paymentStatusWord.REFUNDED).toBe('Refunded');
  });

  it('never calls an authorization "paid" or "captured"', () => {
    expect(paymentStatusWord.AUTHORIZED.toLowerCase()).toContain('not charged');
    expect(paymentStatusWord.AUTHORIZED.toLowerCase()).not.toContain('captured');
  });

  it('labels every preference state with a word', () => {
    for (const [status, word] of Object.entries(preferenceStatusWord)) {
      expect(word.length).toBeGreaterThan(0);
      expect(status.length).toBeGreaterThan(0);
    }
  });
});

describe('fundingStage', () => {
  it('maps the four-step timeline', () => {
    expect(fundingStage('AUTHORIZED').step).toBe(1);
    expect(fundingStage('CAPTURING').step).toBe(2);
    expect(fundingStage('CAPTURED').step).toBe(3);
    expect(fundingStage('CAPTURED').ended).toBeNull();
  });

  it('shows voiding, refunding and attention outcomes explicitly', () => {
    expect(fundingStage('VOIDING').ended).toBe('voided');
    expect(fundingStage('VOIDED').ended).toBe('voided');
    expect(fundingStage('REFUNDING').ended).toBe('refunding');
    expect(fundingStage('REFUNDED').ended).toBe('refunding');
    expect(fundingStage('MANUAL_REVIEW').ended).toBe('attention');
    expect(fundingStage('UNKNOWN').ended).toBe('attention');
  });
});
