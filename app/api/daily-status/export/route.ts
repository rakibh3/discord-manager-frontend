import { NextResponse } from "next/server";

import { ApiError, apiBaseUrlForDisplay } from "@/lib/api/client";
import { dailyStatusExportPath } from "@/lib/api/endpoints/daily-status";
import type { DailyStatus, RangeStatus } from "@/lib/api/types";
import { requireSession } from "@/lib/auth/session";
import { parsePeriod } from "@/lib/period";

const STATUSES = new Set<string>([
  "COMPLETE",
  "MISSING_UPDATE",
  "MISSING_ATTENDANCE",
  "MISSING_BOTH",
]);

const RANGE_STATUSES = new Set<string>(["ALL_COMPLETE", "PARTIAL", "NONE"]);

/** Streams the filtered export straight through rather than buffering it, with
 *  the period, server and filters travelling along so the file matches the
 *  screen. Range mode gains the count columns and a different filename, and the
 *  export carries a leading `servers` column naming every server a person is in. */
export async function GET(request: Request) {
  const url = new URL(request.url);

  const period = parsePeriod({
    date: url.searchParams.get("date") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    daysOfWeek: url.searchParams.get("daysOfWeek") ?? undefined,
  });

  const guildId = url.searchParams.get("guildId") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  // Each filter belongs to exactly one mode; sending the wrong one is a 400.
  const rawStatus = url.searchParams.get("status") ?? undefined;
  const status =
    period.mode === "date" && rawStatus && STATUSES.has(rawStatus)
      ? (rawStatus as DailyStatus)
      : undefined;

  const rawRangeStatus = url.searchParams.get("rangeStatus") ?? undefined;
  const rangeStatus =
    period.mode === "range" && rawRangeStatus && RANGE_STATUSES.has(rawRangeStatus)
      ? (rawRangeStatus as RangeStatus)
      : undefined;

  const rawThreshold = Number.parseInt(
    url.searchParams.get("minMissedBothDays") ?? "",
    10,
  );
  const minMissedBothDays =
    period.mode === "range" && Number.isInteger(rawThreshold) && rawThreshold >= 1
      ? rawThreshold
      : undefined;

  const { accessToken } = await requireSession();
  const path = dailyStatusExportPath(period, {
    guildId,
    status,
    rangeStatus,
    minMissedBothDays,
    search,
    format,
  });

  // The filename names the period, so two downloads never overwrite each other
  // in the browser's downloads folder.
  const periodSlug =
    period.mode === "date" ? period.date : `${period.from}_to_${period.to}`;

  try {
    const upstream = await fetch(
      `${apiBaseUrlForDisplay().replace(/\/$/, "")}${path}`,
      {
        // ⚠️ Bare token — no "Bearer " prefix.
        headers: { Authorization: accessToken },
        cache: "no-store",
      },
    );

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { message: `The export failed with status ${upstream.status}.` },
        { status: upstream.status || 502 },
      );
    }

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") ??
          (format === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "text/csv; charset=utf-8"),
        "Content-Disposition": `attachment; filename="daily-status-${periodSlug}.${format}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status || 502 },
      );
    }
    throw error;
  }
}
