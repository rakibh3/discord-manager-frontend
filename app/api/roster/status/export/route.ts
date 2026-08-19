import { NextResponse } from "next/server";

import { ApiError, apiBaseUrlForDisplay } from "@/lib/api/client";
import { rosterStatusExportPath } from "@/lib/api/endpoints/roster";
import type { RosterStatus } from "@/lib/api/types";
import { requireSession } from "@/lib/auth/session";
import { parsePeriod } from "@/lib/period";

const STATUSES = new Set<string>([
  "COMPLETE",
  "MISSING_UPDATE",
  "MISSING_ATTENDANCE",
  "MISSING_BOTH",
  "NEVER_LINKED",
]);

const PAIRING_STATES = new Set<string>(["all", "paired", "unpaired"]);

/** Streams the filtered roster engagement export straight through, with the
 *  period and filters travelling along so the file matches the screen. Range
 *  mode gains the count columns and a different filename. `format=xlsx` is a
 *  501 Not Implemented on the backend. */
export async function GET(request: Request) {
  const url = new URL(request.url);

  const period = parsePeriod({
    date: url.searchParams.get("date") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    daysOfWeek: url.searchParams.get("daysOfWeek") ?? undefined,
  });

  const rawPairing = url.searchParams.get("pairingState") ?? undefined;
  const pairingState =
    rawPairing && PAIRING_STATES.has(rawPairing)
      ? (rawPairing as "all" | "paired" | "unpaired")
      : undefined;

  const rawStatus = url.searchParams.get("status") ?? undefined;
  const status =
    rawStatus && STATUSES.has(rawStatus) ? (rawStatus as RosterStatus) : undefined;

  const search = url.searchParams.get("search") ?? undefined;
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  const { accessToken } = await requireSession();
  const path = rosterStatusExportPath(period, {
    pairingState,
    status,
    search,
    format,
  });

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
        "Content-Disposition": `attachment; filename="roster-status-${periodSlug}.${format}"`,
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