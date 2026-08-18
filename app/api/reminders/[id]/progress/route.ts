import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/client";
import { getProgress } from "@/lib/api/endpoints/reminders";

/** Same-origin poll target for a broadcast's live progress, polled every 3
 *  seconds while `PENDING`/`PROCESSING`. Keeps the token on the server. */
export async function GET(
  _request: Request,
  // `params` is a Promise in Next 16.
  context: RouteContext<"/api/reminders/[id]/progress">,
) {
  const { id } = await context.params;

  try {
    const data = await getProgress(id);
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
