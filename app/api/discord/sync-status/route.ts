import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/client";
import { getSyncStatus } from "@/lib/api/endpoints/discord";

/** Same-origin poll target for the sync control: reuses the server client, so
 *  the access token stays in its httpOnly cookie. */
export async function GET() {
  try {
    const data = await getSyncStatus();
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
