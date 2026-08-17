import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/client";
import { getProgress } from "@/lib/api/endpoints/reminders";

/**
 * Same-origin poll target for a broadcast's live progress.
 *
 * A broadcast runs for roughly 40 minutes, so the client polls this every 3
 * seconds while the status is `PENDING`/`PROCESSING`. Going through this
 * handler rather than calling the backend directly keeps the access token in
 * its httpOnly cookie on the server.
 */
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
