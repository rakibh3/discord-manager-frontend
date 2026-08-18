import type { DailyStatusQuery, PeriodMode } from "@/lib/api/types";
import { dhakaDaysAgo, dhakaToday, formatCivilDate } from "@/lib/dhaka-date";

/** A selected reporting period: one Asia/Dhaka civil day, or an inclusive span
 *  of them. Every daily-status and reminder read is answered in one of these two
 *  modes, and the mode decides the whole payload shape — so it is modelled once
 *  here rather than inferred from which fields happen to be present.
 *  (`API_INTEGRATION.md` §5A.) */

/** The span cap is a blast-radius control, not a performance limit: `from`/`to`
 *  reach an irreversible mass DM, so a mistyped year has to fail validation
 *  rather than broadcast. The dashboard shares the backend's cap so any range
 *  that can be previewed is a range that can be acted on. */
export const MAX_RANGE_DAYS = 92;

export type DatePeriod = { mode: "date"; date: string };

export type RangePeriod = {
  mode: "range";
  from: string;
  to: string;
  /** Which weekdays inside the span count; `0` is Sunday. Empty means every
   *  day, which is also what omitting the parameter means. */
  daysOfWeek: number[];
};

export type Period = DatePeriod | RangePeriod;

export const datePeriod = (date: string): DatePeriod => ({ mode: "date", date });

/** Inclusive day count between two civil dates, both ends counted. */
export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isCivilDate = (value: string | undefined): value is string =>
  value !== undefined && CIVIL_DATE.test(value) && !Number.isNaN(Date.parse(value));

/** Parses `daysOfWeek=0,1,2` into unique weekday numbers, dropping anything
 *  outside 0–6 rather than passing it on for the backend to reject. */
export function parseDaysOfWeek(raw: string | undefined): number[] {
  if (!raw) return [];
  const parsed = raw
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  return [...new Set(parsed)].sort((a, b) => a - b);
}

/** Reads a period out of URL search params. Anything malformed falls back to
 *  today in Dhaka: a broken link must land on a real day, not an error page. */
export function parsePeriod(params: {
  date?: string;
  from?: string;
  to?: string;
  daysOfWeek?: string;
}): Period {
  const { from, to } = params;

  if (isCivilDate(from) && isCivilDate(to)) {
    // A reversed range is a 400 upstream; swapping is what the admin meant.
    const [start, end] = from <= to ? [from, to] : [to, from];
    const span = daysBetween(start, end);
    return {
      mode: "range",
      from: span > MAX_RANGE_DAYS ? dhakaDaysAgo(MAX_RANGE_DAYS - 1, end) : start,
      to: end,
      daysOfWeek: parseDaysOfWeek(params.daysOfWeek),
    };
  }

  return datePeriod(isCivilDate(params.date) ? params.date : dhakaToday());
}

/** Validation the UI runs before a request, so an impossible range is refused
 *  next to the input rather than as an opaque 400. */
export function periodProblem(period: Period): string | null {
  const today = dhakaToday();

  if (period.mode === "date") {
    return period.date > today
      ? "That date is in the future in Dhaka. Pick today or earlier."
      : null;
  }

  if (period.from > period.to) {
    return "The start date is after the end date.";
  }
  if (period.to > today) {
    return "The range ends in the future in Dhaka. Pick today or earlier.";
  }
  const span = daysBetween(period.from, period.to);
  if (span > MAX_RANGE_DAYS) {
    return `That is ${span.toLocaleString()} days. The cap is ${MAX_RANGE_DAYS} — a mistyped year has to be refused rather than broadcast.`;
  }
  return null;
}

/** How many days the period actually counts, after `daysOfWeek` narrowing. */
export function countedDays(period: Period): number {
  if (period.mode === "date") return 1;

  const span = daysBetween(period.from, period.to);
  if (period.daysOfWeek.length === 0) return span;

  const wanted = new Set(period.daysOfWeek);
  let counted = 0;
  for (let offset = 0; offset < span; offset += 1) {
    const day = new Date(Date.parse(`${period.from}T00:00:00Z`) + offset * 86_400_000);
    if (wanted.has(day.getUTCDay())) counted += 1;
  }
  return counted;
}

/** The period as query parameters — the one place `date` and `from`/`to` are
 *  turned into wire values, so the two can never be sent together. */
export function periodQuery(period: Period): Pick<
  DailyStatusQuery,
  "date" | "from" | "to" | "daysOfWeek"
> {
  return period.mode === "date"
    ? { date: period.date }
    : {
        from: period.from,
        to: period.to,
        ...(period.daysOfWeek.length > 0
          ? { daysOfWeek: period.daysOfWeek }
          : {}),
      };
}

/** The same values as URL search params, for links and export hrefs. */
export function periodSearchParams(period: Period): Record<string, string> {
  return period.mode === "date"
    ? { date: period.date }
    : {
        from: period.from,
        to: period.to,
        ...(period.daysOfWeek.length > 0
          ? { daysOfWeek: period.daysOfWeek.join(",") }
          : {}),
      };
}

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "18 Aug 2026" or "15–17 Aug 2026", with the weekday narrowing named. */
export function formatPeriod(period: Period): string {
  if (period.mode === "date") return formatCivilDate(period.date);

  const span = `${formatCivilDate(period.from)} – ${formatCivilDate(period.to)}`;
  if (period.daysOfWeek.length === 0) return span;
  return `${span} (${period.daysOfWeek.map((day) => WEEKDAY_SHORT[day]).join(", ")} only)`;
}

export const periodMode = (period: Period): PeriodMode => period.mode;
