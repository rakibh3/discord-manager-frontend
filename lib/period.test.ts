import { describe, expect, test } from "bun:test";

import {
  countedDays,
  daysBetween,
  MAX_RANGE_DAYS,
  parseDaysOfWeek,
  parsePeriod,
  periodProblem,
  periodQuery,
  periodSearchParams,
  type Period,
} from "@/lib/period";

const range = (from: string, to: string, daysOfWeek: number[] = []): Period => ({
  mode: "range",
  from,
  to,
  daysOfWeek,
});

describe("parsePeriod", () => {
  test("reads a single date", () => {
    expect(parsePeriod({ date: "2026-08-18" })).toEqual({
      mode: "date",
      date: "2026-08-18",
    });
  });

  test("reads a range with weekday narrowing", () => {
    expect(
      parsePeriod({ from: "2026-08-15", to: "2026-08-17", daysOfWeek: "0,1,2" }),
    ).toEqual(range("2026-08-15", "2026-08-17", [0, 1, 2]));
  });

  test("swaps a reversed range rather than passing on a 400", () => {
    expect(parsePeriod({ from: "2026-08-18", to: "2026-08-16" })).toEqual(
      range("2026-08-16", "2026-08-18"),
    );
  });

  test("half a range is not a range — the pair is required", () => {
    const parsed = parsePeriod({ from: "2026-08-15" });
    expect(parsed.mode).toBe("date");
  });

  test("clamps a span wider than the cap", () => {
    const parsed = parsePeriod({ from: "2020-01-01", to: "2026-08-18" });
    expect(parsed.mode).toBe("range");
    if (parsed.mode !== "range") return;
    expect(daysBetween(parsed.from, parsed.to)).toBe(MAX_RANGE_DAYS);
  });

  test("a malformed date falls back to a real day rather than erroring", () => {
    expect(parsePeriod({ date: "not-a-date" }).mode).toBe("date");
  });
});

describe("parseDaysOfWeek", () => {
  test("drops anything outside 0-6 and de-duplicates", () => {
    expect(parseDaysOfWeek("0,1,1,9,-2,6")).toEqual([0, 1, 6]);
  });

  test("empty means every day", () => {
    expect(parseDaysOfWeek(undefined)).toEqual([]);
  });
});

describe("periodQuery", () => {
  test("date mode never sends from/to", () => {
    expect(periodQuery({ mode: "date", date: "2026-08-18" })).toEqual({
      date: "2026-08-18",
    });
  });

  // Sending both is a 400 naming the conflict, so the two can never be built
  // into one query object.
  test("range mode never sends date", () => {
    const query = periodQuery(range("2026-08-15", "2026-08-17", [0, 1]));
    expect(query.date).toBeUndefined();
    expect(query).toEqual({
      from: "2026-08-15",
      to: "2026-08-17",
      daysOfWeek: [0, 1],
    });
  });

  test("every-day narrowing is omitted rather than sent empty", () => {
    expect(periodQuery(range("2026-08-15", "2026-08-17")).daysOfWeek).toBeUndefined();
  });

  test("search params mirror the query", () => {
    expect(periodSearchParams(range("2026-08-15", "2026-08-17", [3]))).toEqual({
      from: "2026-08-15",
      to: "2026-08-17",
      daysOfWeek: "3",
    });
  });
});

describe("countedDays", () => {
  test("a single date counts one day", () => {
    expect(countedDays({ mode: "date", date: "2026-08-18" })).toBe(1);
  });

  test("an unnarrowed range counts every day inclusively", () => {
    expect(countedDays(range("2026-08-15", "2026-08-17"))).toBe(3);
  });

  test("weekday narrowing shrinks the denominator", () => {
    // 2026-08-15 is a Saturday, so Sat/Sun over three days is Sat 15 + Sun 16.
    expect(countedDays(range("2026-08-15", "2026-08-17", [0, 6]))).toBe(2);
  });

  test("a narrowing that never occurs counts nothing", () => {
    expect(countedDays(range("2026-08-17", "2026-08-17", [0]))).toBe(0);
  });
});

describe("periodProblem", () => {
  test("a future single date is refused", () => {
    expect(periodProblem({ mode: "date", date: "2999-01-01" })).toContain(
      "future",
    );
  });

  test("a range ending in the future is refused", () => {
    expect(periodProblem(range("2026-08-15", "2999-01-01"))).toContain("future");
  });

  // The cap is a blast-radius control: `from`/`to` reach an irreversible mass
  // DM, so a mistyped year has to fail here rather than broadcast.
  test("a span wider than the cap is refused with its own figure", () => {
    const problem = periodProblem(range("2020-01-01", "2020-12-31"));
    expect(problem).toContain(String(MAX_RANGE_DAYS));
  });

  test("a valid past range has no problem", () => {
    expect(periodProblem(range("2026-08-15", "2026-08-17"))).toBeNull();
  });
});
