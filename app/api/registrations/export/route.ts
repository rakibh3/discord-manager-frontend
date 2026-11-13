import { NextResponse } from "next/server";

import { ApiError, apiBaseUrlForDisplay } from "@/lib/api/client";
import { registrationsExportPath } from "@/lib/api/endpoints/registration";
import type {
  RegistrationStatusFilter,
  WelcomeEmailStatusFilter,
} from "@/lib/api/types";
import { requireSession } from "@/lib/auth/session";
import { dhakaToday } from "@/lib/dhaka-date";

const STATUSES = new Set<string>(["PENDING", "ENROLLED"]);
const EMAIL_STATUSES = new Set<string>(["PENDING", "SENT", "FAILED", "SKIPPED"]);

/** Streams the registrations CSV straight through from the backend, with the
 *  filters on screen travelling along so the file matches the list. A route
 *  handler rather than a Server Action because the browser has to receive a
 *  download, and the access token must stay on the server. */
export async function GET(request: Request) {
  const url = new URL(request.url);

  // Anything not a known value is dropped rather than forwarded: the backend
  // would answer 400, and a download link that 400s is a worse outcome than
  // an unfiltered file.
  const rawStatus = url.searchParams.get("status") ?? undefined;
  const status =
    rawStatus && STATUSES.has(rawStatus)
      ? (rawStatus as RegistrationStatusFilter)
      : undefined;

  const rawEmailStatus = url.searchParams.get("emailStatus") ?? undefined;
  const emailStatus =
    rawEmailStatus && EMAIL_STATUSES.has(rawEmailStatus)
      ? (rawEmailStatus as WelcomeEmailStatusFilter)
      : undefined;

  const search = url.searchParams.get("search")?.trim() || undefined;

  const { accessToken } = await requireSession();
  const path = registrationsExportPath({ status, emailStatus, search });

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
          upstream.headers.get("Content-Type") ?? "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="registrations-${dhakaToday()}.csv"`,
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
