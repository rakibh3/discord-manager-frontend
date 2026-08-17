import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/client";
import { getDailyStatusMember } from "@/lib/api/endpoints/daily-status";
import { dhakaToday } from "@/lib/dhaka-date";
import { DAILY_STATUS_ENABLED } from "@/lib/flags";

/**
 * Same-origin target for the member detail dialog.
 *
 * Short-circuits on the flag before touching the API client, so the request
 * cannot reach a backend route that does not exist. 501 rather than 404: the
 * feature is unimplemented upstream, which is a different thing from this
 * member not existing.
 */
export async function GET(
  request: Request,
  context: RouteContext<"/api/daily-status/members/[id]">,
) {
  if (!DAILY_STATUS_ENABLED) {
    return NextResponse.json(
      {
        message:
          "The daily-status endpoints are not available on the backend yet.",
      },
      { status: 501 },
    );
  }

  const { id } = await context.params;
  const date =
    new URL(request.url).searchParams.get("date") ?? dhakaToday();

  try {
    const data = await getDailyStatusMember(id, date);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
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
