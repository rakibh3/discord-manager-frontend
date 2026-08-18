/**
 * Asia/Dhaka is the only date authority in this app.
 *
 * `attendanceDate`, `messageDate` and `reminderDate` are `YYYY-MM-DD` strings
 * naming an Asia/Dhaka *calendar day*, and `openTime`/`closeTime` are `HH:mm`
 * wall-clock strings in the same zone. There is no timezone field to send.
 *
 * `new Date().toISOString().slice(0, 10)` is banned repo-wide: it yields the
 * **UTC** day, so an admin in Dhaka at 00:30 would be shown yesterday's
 * dashboard while the backend files rows under today. Everything here goes
 * through an `Intl.DateTimeFormat` pinned to the zone instead.
 *
 * This module is intentionally not `server-only` — the attendance form and the
 * reminder composer both need it in the browser, and it touches no secrets.
 */

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

/**
 * The Dhaka civil day `days` before `from`.
 *
 * The arithmetic runs on a `Date` built with `Date.UTC` from an already-civil
 * date, so it is pure calendar maths with no zone conversion — which is the one
 * case where reading `toISOString()` back out is safe.
 */
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

/**
 * Today's Dhaka weekday as `0 = Sunday … 6 = Saturday`, matching the backend's
 * `daysOfWeek`.
 *
 * `Date.getDay()` would answer for the *viewer's* zone, so an admin in London
 * at 20:00 on a Friday would be told it is Friday in Dhaka when it is already
 * Saturday there — and the schedule would read as active on the wrong day.
 */
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

/**
 * Everything a human *reads* is 12-hour, because that is how the students and
 * admins say these times out loud ("সন্ধ্যা ৭টা", not "nineteen hundred").
 *
 * The 24-hour rendering survives only in `dhakaTimeNow` above and in the wire
 * format itself, where the string is compared rather than read.
 */
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

/**
 * Renders a backend `DateTime` (`submittedAt`, `nextOpenAt`, `ranAt`, …) in
 * Dhaka, so a travelling admin reads the same clock as the schedule does.
 *
 * Returns an em dash for `null`, which is a real value on most of these fields
 * and should read as "nothing recorded" rather than "Invalid Date".
 */
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

  return `${upperMeridiem(formatter.format(instant))} (Dhaka)`;
}

const WALL_CLOCK_PATTERN = /^(\d{1,2}):(\d{2})$/;

/**
 * Renders a stored `HH:mm` wall-clock string as `7:00 PM`.
 *
 * `openTime` and `closeTime` arrive as 24-hour strings because that is what
 * sorts correctly against `dhakaTimeNow()` — but nobody reads a schedule that
 * way, so every *display* of one goes through here. Anything that is not a
 * well-formed `HH:mm` is passed through untouched rather than mangled: a
 * surprising backend value should read as itself, not as `NaN:00 PM`.
 */
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
