import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/client";
import { getSyncStatus } from "@/lib/api/endpoints/discord";

/**
 * Same-origin poll target for the sync control.
 *
 * The admin API is server-only, so a client component cannot call it directly.
 * This handler reuses the server client, which means the access token stays in
 * its httpOnly cookie and never reaches the browser or a serialized payload.
 */
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
