import { describe, expect, it } from 'vitest';

import {
  canTransitionPayment,
  canTransitionWorkshop,
  captureGuard,
} from '../../src/server/domain/state.js';
import type { PaymentStatus, WorkshopStatus } from '../../src/shared/types.js';

describe('canTransitionWorkshop', () => {
  it('allows the forward collection → offer → settle → confirmed path', () => {
    expect(canTransitionWorkshop('DRAFT', 'COLLECTING_INTEREST')).toBe(true);
    expect(canTransitionWorkshop('COLLECTING_INTEREST', 'CLARIFYING')).toBe(true);
    expect(canTransitionWorkshop('CLARIFYING', 'OFFER_OPEN')).toBe(true);
    expect(canTransitionWorkshop('OFFER_OPEN', 'SETTLING')).toBe(true);
    expect(canTransitionWorkshop('SETTLING', 'CONFIRMED')).toBe(true);
  });

  it('allows cancellation and compensation only from non-terminal states', () => {
    expect(canTransitionWorkshop('COLLECTING_INTEREST', 'CANCELLED')).toBe(true);
    expect(canTransitionWorkshop('OFFER_OPEN', 'CANCELLED')).toBe(true);
    expect(canTransitionWorkshop('SETTLING', 'COMPENSATING')).toBe(true);
    expect(canTransitionWorkshop('COMPENSATING', 'CANCELLED')).toBe(true);
    expect(canTransitionWorkshop('MANUAL_REVIEW', 'CANCELLED')).toBe(true);
    expect(canTransitionWorkshop('MANUAL_REVIEW', 'CONFIRMED')).toBe(true);
  });

  it('never lets a terminal workshop regress', () => {
    const terminal: WorkshopStatus[] = ['CONFIRMED', 'CANCELLED'];
    for (const from of terminal) {
      for (const to of [
        'DRAFT',
        'COLLECTING_INTEREST',
        'CLARIFYING',
        'OFFER_OPEN',
        'SETTLING',
        'CANCELLING',
        'COMPENSATING',
        'MANUAL_REVIEW',
      ] satisfies WorkshopStatus[]) {
        expect(canTransitionWorkshop(from, to)).toBe(false);
      }
    }
  });

  it('treats same-state as an allowed idempotent re-observation', () => {
    expect(canTransitionWorkshop('CONFIRMED', 'CONFIRMED')).toBe(true);
    expect(canTransitionWorkshop('CANCELLED', 'CANCELLED')).toBe(true);
  });

  it('does not allow skipping money-bearing states', () => {
    expect(canTransitionWorkshop('COLLECTING_INTEREST', 'SETTLING')).toBe(false);
    expect(canTransitionWorkshop('DRAFT', 'OFFER_OPEN')).toBe(false);
  });
});

describe('canTransitionPayment', () => {
  it('allows the happy order → auth → capture → refund path', () => {
    expect(canTransitionPayment('NONE', 'ORDER_CREATED')).toBe(true);
    expect(canTransitionPayment('ORDER_CREATED', 'APPROVED')).toBe(true);
    expect(canTransitionPayment('APPROVED', 'AUTHORIZING')).toBe(true);
    expect(canTransitionPayment('AUTHORIZING', 'AUTHORIZED')).toBe(true);
    expect(canTransitionPayment('AUTHORIZED', 'CAPTURING')).toBe(true);
    expect(canTransitionPayment('CAPTURING', 'CAPTURED')).toBe(true);
    expect(canTransitionPayment('CAPTURED', 'REFUNDING')).toBe(true);
    expect(canTransitionPayment('REFUNDING', 'REFUNDED')).toBe(true);
  });

  it('allows voiding an uncaptured authorization', () => {
    expect(canTransitionPayment('AUTHORIZED', 'VOIDING')).toBe(true);
    expect(canTransitionPayment('VOIDING', 'VOIDED')).toBe(true);
  });

  it('forbids terminal states from regressing into an earlier money state', () => {
    expect(canTransitionPayment('CAPTURED', 'AUTHORIZED')).toBe(false);
    expect(canTransitionPayment('CAPTURED', 'ORDER_CREATED')).toBe(false);
    expect(canTransitionPayment('REFUNDED', 'CAPTURED')).toBe(false);
    expect(canTransitionPayment('VOIDED', 'AUTHORIZED')).toBe(false);
    expect(canTransitionPayment('REFUNDED', 'REFUNDING')).toBe(false);
    expect(canTransitionPayment('FAILED', 'AUTHORIZED')).toBe(false);
  });

  it('never treats an UNKNOWN provider outcome as success', () => {
    expect(canTransitionPayment('UNKNOWN', 'CAPTURED')).toBe(false);
    expect(canTransitionPayment('UNKNOWN', 'AUTHORIZED')).toBe(false);
    expect(canTransitionPayment('UNKNOWN', 'REFUNDED')).toBe(false);
    expect(canTransitionPayment('UNKNOWN', 'MANUAL_REVIEW')).toBe(true);
  });
});

describe('captureGuard', () => {
  const nowUtc = '2026-11-12T04:00:00Z';
  const deadlineUtc = '2026-11-13T00:00:00Z';

  function input(overrides: Partial<Parameters<typeof captureGuard>[0]> = {}): Parameters<typeof captureGuard>[0] {
    return {
      paymentStatus: 'AUTHORIZED',
      authorizedAt: '2026-11-12T03:00:00Z',
      nowUtc,
      offerOpen: true,
      deadlineUtc,
      withdrawn: false,
      ...overrides,
    };
  }

  it('allows a fresh authorization while the offer is open and the deadline has not passed', () => {
    const result = captureGuard(input());
    expect(result.allowed).toBe(true);
    expect(result.reason).toMatch(/hours old/);
  });

  it('allows an authorization that is just under 48 hours old', () => {
    expect(captureGuard(input({ authorizedAt: '2026-11-10T04:01:00Z' })).allowed).toBe(true);
  });

  it('refuses statuses other than AUTHORIZED', () => {
    for (const status of ['NONE', 'ORDER_CREATED', 'APPROVED', 'AUTHORIZING', 'CAPTURED', 'VOIDED'] satisfies PaymentStatus[]) {
      const result = captureGuard(input({ paymentStatus: status }));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('AUTHORIZED');
    }
  });

  it('refuses a missing or invalid authorization time', () => {
    expect(captureGuard(input({ authorizedAt: null })).allowed).toBe(false);
    expect(captureGuard(input({ authorizedAt: 'not a time' })).allowed).toBe(false);
    expect(captureGuard(input({ authorizedAt: '2026-11-12T05:00:00Z' })).allowed).toBe(false); // future
  });

  it('enforces the PayPal < 48 hour capture window exactly', () => {
    expect(captureGuard(input({ authorizedAt: '2026-11-10T04:00:00Z' })).allowed).toBe(false); // exactly 48h
    const older = captureGuard(input({ authorizedAt: '2026-11-09T04:00:00Z' }));
    expect(older.allowed).toBe(false);
    expect(older.reason).toContain('48');
  });

  it('refuses once the authorization deadline has passed', () => {
    expect(captureGuard(input({ nowUtc: deadlineUtc })).allowed).toBe(false);
    expect(captureGuard(input({ nowUtc: '2026-11-13T00:00:01Z' })).allowed).toBe(false);
  });

  it('refuses a closed offer or a withdrawn participant', () => {
    expect(captureGuard(input({ offerOpen: false })).allowed).toBe(false);
    expect(captureGuard(input({ withdrawn: true })).allowed).toBe(false);
  });

  it('returns a deterministic reason for every decision', () => {
    expect(captureGuard(input())).toEqual(captureGuard(input()));
    expect(captureGuard(input({ withdrawn: true })).reason.length).toBeGreaterThan(0);
  });
});
