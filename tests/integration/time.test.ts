import { describe, expect, it } from 'vitest';
import {
  addHours,
  formatRangeLabel,
  formatInstantLabel,
  hoursBetween,
  isValidTimezone,
  nextWeekdayInZone,
  partsInZone,
  zonedTimeToUtc,
} from '../../src/shared/time.js';

describe('time helpers (UTC stored, workshop zone displayed)', () => {
  it('converts a Los Angeles wall-clock time to the right UTC instant (PST)', () => {
    // November 21, 2026 is after the DST change, so PST = UTC-8.
    const utc = zonedTimeToUtc({ timezone: 'America/Los_Angeles', year: 2026, month: 11, day: 21, hour: 10, minute: 0 });
    expect(utc).toBe('2026-11-21T18:00:00Z');
    expect(partsInZone(utc, 'America/Los_Angeles').hour).toBe(10);
  });

  it('handles the DST transition without shipping a wrong wall clock', () => {
    // March 8, 2026: 02:00 PST becomes 03:00 PDT. 10:00 local is still 10:00.
    const before = zonedTimeToUtc({ timezone: 'America/Los_Angeles', year: 2026, month: 3, day: 7, hour: 10, minute: 0 });
    const after = zonedTimeToUtc({ timezone: 'America/Los_Angeles', year: 2026, month: 3, day: 9, hour: 10, minute: 0 });
    expect(partsInZone(before, 'America/Los_Angeles').hour).toBe(10);
    expect(partsInZone(after, 'America/Los_Angeles').hour).toBe(10);
    expect(before).toBe('2026-03-07T18:00:00Z'); // PST
    expect(after).toBe('2026-03-09T17:00:00Z'); // PDT
  });

  it('renders dates with a month, day, year and IANA zone (brief §10)', () => {
    const label = formatRangeLabel('2026-11-21T18:00:00Z', '2026-11-21T20:00:00Z', 'America/Los_Angeles');
    expect(label).toBe('Saturday, November 21, 2026 · 10:00–12:00 (America/Los_Angeles)');
  });

  it('renders deadlines in the workshop zone, not UTC', () => {
    const label = formatInstantLabel('2026-11-13T20:00:00Z', 'America/Los_Angeles');
    expect(label).toBe('November 13, 2026, 12:00 (America/Los_Angeles)');
  });

  it('finds the next Saturday in the local zone', () => {
    // 2026-11-12 is a Thursday in Los Angeles.
    const sat = nextWeekdayInZone('2026-11-12T20:14:00Z', 'America/Los_Angeles', 6, 0);
    expect(sat).toEqual({ year: 2026, month: 11, day: 14 });
  });

  it('rejects an invalid IANA zone instead of guessing', () => {
    expect(isValidTimezone('Mars/Olympus')).toBe(false);
    expect(() => partsInZone('2026-11-21T18:00:00Z', 'Mars/Olympus')).toThrow(/invalid IANA timezone/);
  });

  it('does exact hour arithmetic on instant strings', () => {
    expect(addHours('2026-11-12T12:00:00Z', 20)).toBe('2026-11-13T08:00:00Z');
    expect(hoursBetween('2026-11-12T12:00:00Z', '2026-11-13T08:00:00Z')).toBe(20);
  });
});
