/* ==========================================================================
   Time helpers — one place that turns UTC instants into the workshop's own
   timezone for display, and back again for the synthetic demo data.

   The product stores UTC; every label a human sees comes from these functions.
   That is deliberate: no screen is allowed to render a raw ISO string.
   ========================================================================== */

const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number;
  minute: number;
  weekdayIndex: number; // 0 = Sunday
}

function formatter(timezone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, ...options });
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function assertTimezone(timezone: string): void {
  if (!isValidTimezone(timezone)) throw new Error(`invalid IANA timezone: ${timezone}`);
}

/** Wall-clock parts of an instant, in the given zone. */
export function partsInZone(utcIso: string, timezone: string): ZonedParts {
  assertTimezone(timezone);
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) throw new Error(`invalid instant: ${utcIso}`);
  const parts = formatter(timezone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const pick = (type: string): number => {
    const found = parts.find((p) => p.type === type);
    if (!found) throw new Error(`could not read ${type} in ${timezone}`);
    return Number(found.value);
  };
  const weekdayIndex = WEEKDAYS_LONG.indexOf(
    formatter(timezone, { weekday: 'long' }).format(date),
  );
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour') % 24,
    minute: pick('minute'),
    weekdayIndex,
  };
}

/** Offset (ms) of the zone at that instant: local wall time minus UTC. */
function zoneOffsetMs(instantMs: number, timezone: string): number {
  const p = partsInZone(new Date(instantMs).toISOString(), timezone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - instantMs;
}

/**
 * Turn a wall-clock time in a zone into a UTC instant. Two passes handle DST
 * transitions: the offset is recomputed at the guessed instant.
 */
export function zonedTimeToUtc(input: {
  timezone: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): string {
  assertTimezone(input.timezone);
  const naive = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute);
  let guess = naive - zoneOffsetMs(naive, input.timezone);
  guess = naive - zoneOffsetMs(guess, input.timezone);
  return new Date(guess).toISOString().replace('.000Z', 'Z');
}

export function weekdayName(index: number): string {
  return WEEKDAYS_LONG[index] ?? 'Sunday';
}

export function formatDayLabel(utcIso: string, timezone: string): string {
  const p = partsInZone(utcIso, timezone);
  return `${WEEKDAYS_LONG[p.weekdayIndex]}, ${MONTHS_LONG[p.month - 1]} ${p.day}, ${p.year}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatClock(utcIso: string, timezone: string): string {
  const p = partsInZone(utcIso, timezone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatTimeRange(startUtc: string, endUtc: string, timezone: string): string {
  return `${formatClock(startUtc, timezone)}–${formatClock(endUtc, timezone)}`;
}

/** "Saturday, November 21, 2026 · 10:00–12:00 (America/Los_Angeles)" */
export function formatRangeLabel(startUtc: string, endUtc: string, timezone: string): string {
  return `${formatDayLabel(startUtc, timezone)} · ${formatTimeRange(startUtc, endUtc, timezone)} (${timezone})`;
}

/** "November 13, 2026, 08:00 (America/Los_Angeles)" — used for deadlines. */
export function formatInstantLabel(utcIso: string, timezone: string): string {
  const p = partsInZone(utcIso, timezone);
  return `${MONTHS_LONG[p.month - 1]} ${p.day}, ${p.year}, ${pad(p.hour)}:${pad(p.minute)} (${timezone})`;
}

export function addHours(utcIso: string, hours: number): string {
  return new Date(new Date(utcIso).getTime() + hours * 3_600_000).toISOString().replace('.000Z', 'Z');
}

export function addDays(utcIso: string, days: number): string {
  return new Date(new Date(utcIso).getTime() + days * 86_400_000).toISOString().replace('.000Z', 'Z');
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function hoursBetween(fromUtc: string, toUtc: string): number {
  return (new Date(toUtc).getTime() - new Date(fromUtc).getTime()) / 3_600_000;
}

/** Next date (in the zone) whose weekday matches, at least `minDaysAhead` days out. */
export function nextWeekdayInZone(
  fromUtc: string,
  timezone: string,
  weekdayIndex: number,
  minDaysAhead = 0,
): { year: number; month: number; day: number } {
  const start = new Date(Date.parse(fromUtc) + minDaysAhead * 86_400_000);
  const parts = partsInZone(start.toISOString(), timezone);
  let delta = (weekdayIndex - parts.weekdayIndex + 7) % 7;
  if (delta === 0 && minDaysAhead > 0) delta = 7;
  const target = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) + delta * 86_400_000);
  return { year: target.getUTCFullYear(), month: target.getUTCMonth() + 1, day: target.getUTCDate() };
}
