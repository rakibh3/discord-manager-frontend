import { NextResponse } from "next/server";

import { ApiError, apiBaseUrlForDisplay } from "@/lib/api/client";
import { dailyStatusExportPath } from "@/lib/api/endpoints/daily-status";
import type { DailyStatus } from "@/lib/api/types";
import { requireSession } from "@/lib/auth/session";
import { dhakaToday } from "@/lib/dhaka-date";

const STATUSES = new Set<string>([
  "COMPLETE",
  "MISSING_UPDATE",
  "MISSING_ATTENDANCE",
  "MISSING_BOTH",
]);

/**
 * Streams the filtered export straight through to the browser.
 *
 * The file is piped rather than buffered — a full-guild export is large, and
 * holding it in memory on the Next server to hand it straight back would be
 * pure overhead. The date, status filter and search term all travel with it, so
 * the file matches what is on screen rather than being everything.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? dhakaToday();
  const rawStatus = url.searchParams.get("status") ?? undefined;
  const status =
    rawStatus && STATUSES.has(rawStatus) ? (rawStatus as DailyStatus) : undefined;
  const search = url.searchParams.get("search") ?? undefined;
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  const { accessToken } = await requireSession();
  const path = dailyStatusExportPath({ date, status, search, format });

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
        "Content-Disposition": `attachment; filename="daily-status-${date}.${format}"`,
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
