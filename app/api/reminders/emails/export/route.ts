import { NextResponse } from "next/server";

import { ApiError, apiBaseUrlForDisplay } from "@/lib/api/client";
import { reminderEmailsExportPath } from "@/lib/api/endpoints/reminders";
import type { EmailLogState } from "@/lib/api/types";
import { requireSession } from "@/lib/auth/session";
import { dhakaToday } from "@/lib/dhaka-date";
import { EMAIL_LOG_STATES } from "@/lib/reminder-labels";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

/** Streams the reminder email log as .xlsx straight through from the backend,
 *  with the on-screen filters travelling along so the file matches the list.
 *  A route handler rather than a Server Action because the browser has to
 *  receive a download, and the access token must stay on the server. */
export async function GET(request: Request) {
  const url = new URL(request.url);

  // Anything not a known value is dropped rather than forwarded: the backend
  // would answer 400, and a download link that 400s is a worse outcome than a
  // less-filtered file.
  const reminder = url.searchParams.get("reminder") ?? undefined;
  const states = (url.searchParams.get("state") ?? "")
    .split(",")
    .filter((state): state is EmailLogState =>
      (EMAIL_LOG_STATES as string[]).includes(state),
    );
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const search = url.searchParams.get("search")?.trim() || undefined;

  const { accessToken } = await requireSession();
  const path = reminderEmailsExportPath({
    reminderId: reminder && UUID.test(reminder) ? reminder : undefined,
    states,
    from: from && DATE.test(from) ? from : undefined,
    to: to && DATE.test(to) ? to : undefined,
    search,
  });

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
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="reminder-emails-${dhakaToday()}.xlsx"`,
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
