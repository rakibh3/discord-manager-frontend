import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/client";
import { getQueueStatus } from "@/lib/api/endpoints/reminders";

/** Same-origin poll target for queue and worker health, polled every 10 seconds.
 *  Declared before `/:id` on the backend, so the path does not collide. */
export async function GET() {
  try {
    const data = await getQueueStatus();
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
