import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/client";
import { previewAnnouncement } from "@/lib/api/endpoints/announcement";
import type { AnnouncementPreviewRequest } from "@/lib/api/types";

/** Same-origin preview target: a route handler rather than a Server Action, so a
 *  keystroke can abort it. Debounce ≥ 500 ms; the admin token stays server-side. */
export async function POST(request: Request) {
  let body: AnnouncementPreviewRequest = {};

  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object") {
      const { body: text, terminationDays } = parsed as AnnouncementPreviewRequest;
      // Only the two fields the endpoint accepts are forwarded; anything else
      // an editor might send along is dropped here rather than upstream.
      if (typeof text === "string") body.body = text;
      if (typeof terminationDays === "number") {
        body.terminationDays = terminationDays;
      }
    }
  } catch {
    // An empty or unparseable body means "preview what is stored", which is
    // exactly what `{}` asks the backend for.
    body = {};
  }

  try {
    const data = await previewAnnouncement(body);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      // A 400 here is the unknown-placeholder rejection, and its message names
      // the exact token to fix — the editor shows it verbatim.
      return NextResponse.json(
        { message: error.message },
        {
          status: error.status || 502,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
    throw error;
  }
}
