import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/client";
import { getQueueStatus } from "@/lib/api/endpoints/reminders";

/**
 * Same-origin poll target for queue and worker health, polled every 10 seconds
 * on the reminders page.
 *
 * On the backend `/reminders/status` is declared *before* `/:id`, so this path
 * does not collide with a broadcast id.
 */
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
