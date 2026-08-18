import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/client";
import { getDailyStatusMember } from "@/lib/api/endpoints/daily-status";
import { dhakaToday } from "@/lib/dhaka-date";

/**
 * Same-origin target for the member detail dialog.
 */
export async function GET(
  request: Request,
  context: RouteContext<"/api/daily-status/members/[id]">,
) {

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
