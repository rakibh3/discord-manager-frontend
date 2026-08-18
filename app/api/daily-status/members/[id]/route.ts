import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/client";
import { getDailyStatusMember } from "@/lib/api/endpoints/daily-status";
import { parsePeriod } from "@/lib/period";

/** Same-origin target for the member detail dialog. The period travels through
 *  unchanged, so a dialog opened from a range view describes the same span the
 *  table row was computed over. */
export async function GET(
  request: Request,
  context: RouteContext<"/api/daily-status/members/[id]">,
) {
  const { id } = await context.params;
  const params = new URL(request.url).searchParams;

  const period = parsePeriod({
    date: params.get("date") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    daysOfWeek: params.get("daysOfWeek") ?? undefined,
  });

  try {
    const data = await getDailyStatusMember(id, period);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status || 502, headers: { "Cache-Control": "no-store" } },
      );
    }
    throw error;
  }
}
