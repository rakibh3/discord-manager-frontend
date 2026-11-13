/** Asia/Dhaka is the only date authority: `YYYY-MM-DD` civil days and `HH:mm`
 *  wall clock. `toISOString().slice(0,10)` is banned — it yields the UTC day. */

export const DHAKA_TIMEZONE = "Asia/Dhaka";

/** `en-CA` because it formats as `YYYY-MM-DD`, which is exactly the wire format. */
const civilDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: DHAKA_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's Dhaka civil date as `YYYY-MM-DD`, independent of the viewer's clock. */
export function dhakaToday(instant: Date = new Date()): string {
  return civilDateFormatter.format(instant);
}

/** The Dhaka civil day `days` before `from` — pure calendar maths on a
 *  `Date.UTC` value, so no zone conversion is involved. */
export function dhakaDaysAgo(days: number, from: string = dhakaToday()): string {
  const [year, month, day] = from.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day - days));
  return shifted.toISOString().slice(0, 10);
}

/** Yesterday in Dhaka — the default date for a reminder broadcast. */
export const dhakaYesterday = (): string => dhakaDaysAgo(1);

/** True when `date` (a `YYYY-MM-DD` civil date) is later than today in Dhaka. */
export function isFutureDhakaDate(date: string): boolean {
  return date > dhakaToday();
}

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: DHAKA_TIMEZONE,
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Today's Dhaka weekday (`0 = Sunday`), matching the backend's `daysOfWeek`.
 *  `Date.getDay()` would answer for the viewer's zone instead. */
export function dhakaWeekday(instant: Date = new Date()): number {
  return WEEKDAY_INDEX[weekdayFormatter.format(instant)] ?? 0;
}

const wallClockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: DHAKA_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** The current Dhaka wall clock as zero-padded `HH:mm`, comparable as a string. */
export function dhakaTimeNow(instant: Date = new Date()): string {
  // `en-GB` with hour12:false renders 24-hour and zero-pads, so the result
  // sorts correctly against a stored `openTime`/`closeTime`.
  return wallClockFormatter.format(instant);
}

/** Everything a human reads is 12-hour; 24-hour survives only in `dhakaTimeNow`
 *  and the wire format, where the string is compared rather than read. */
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: DHAKA_TIMEZONE,
  dateStyle: "medium",
  timeStyle: "short",
  hour12: true,
});

const timeOnlyFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: DHAKA_TIMEZONE,
  timeStyle: "short",
  hour12: true,
});

/** `en-GB` renders the meridiem lowercase; the UI uses `7:00 PM` throughout. */
const upperMeridiem = (formatted: string): string =>
  formatted.replace(/\b(am|pm)\b/i, (period) => period.toUpperCase());

const dateOnlyFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: DHAKA_TIMEZONE,
  dateStyle: "medium",
});

/** Renders a backend `DateTime` in Dhaka. Returns an em dash for `null`, which
 *  is a real value on most of these fields.
 *
 *  No "(Dhaka)" suffix: every time in this dashboard is Dhaka time, so a label
 *  on each one repeated the same word down every column. The zone is stated
 *  once where it matters (the period picker, exports' column headings). */
export function formatDhaka(
  value: string | Date | null | undefined,
  style: "datetime" | "date" | "time" = "datetime",
): string {
  if (!value) return "—";
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return "—";

  const formatter =
    style === "time"
      ? timeOnlyFormatter
      : style === "date"
        ? dateOnlyFormatter
        : dateTimeFormatter;

  return upperMeridiem(formatter.format(instant));
}

const WALL_CLOCK_PATTERN = /^(\d{1,2}):(\d{2})$/;

/** Renders a stored `HH:mm` as `7:00 PM`. Anything not well-formed passes
 *  through untouched rather than rendering as `NaN:00 PM`. */
export function formatWallClock(time: string): string {
  const match = WALL_CLOCK_PATTERN.exec(time);
  if (!match) return time;

  const hours = Number(match[1]);
  const minutes = match[2];
  if (hours > 23 || Number(minutes) > 59) return time;

  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}

/** Formats a `YYYY-MM-DD` civil date for display without inventing a time. */
export function formatCivilDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return dateOnlyFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}

/** `41290` → `41.3 s`. Used for sync durations, which are reported in ms. */
export function formatDuration(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/** Relative "3 minutes ago" phrasing for freshness, never for a stored date. */
export function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return "—";

  const seconds = Math.round((Date.now() - instant.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86_400)} d ago`;
}
