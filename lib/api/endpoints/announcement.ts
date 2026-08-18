import "server-only";

import { api } from "@/lib/api/client";
import type {
  AnnouncementPatch,
  AnnouncementPayload,
  AnnouncementPreview,
  AnnouncementPreviewRequest,
  AnnouncementSendResult,
} from "@/lib/api/types";

/** `GET /api/announcement/attendance` — the evening `#attendance` message. Never
 *  cached: `preview.content` embeds today's date and `today.posted` goes stale. */
export function getAnnouncement(): Promise<AnnouncementPayload> {
  return api<AnnouncementPayload>("/announcement/attendance");
}

/** `PATCH /api/announcement/attendance`. An empty object is a 400 and `timezone`
 *  must never be sent; the two service-level 400s are safe to show verbatim. */
export function patchAnnouncement(
  patch: AnnouncementPatch,
): Promise<AnnouncementPayload> {
  return api<AnnouncementPayload>("/announcement/attendance", {
    method: "PATCH",
    body: patch,
  });
}

/** `POST /api/announcement/attendance/preview` — renders against today's live
 *  values and stores nothing. Resolves mentions each call, so debounce ≥ 500 ms. */
export function previewAnnouncement(
  request: AnnouncementPreviewRequest = {},
): Promise<AnnouncementPreview> {
  return api<AnnouncementPreview>("/announcement/attendance/preview", {
    method: "POST",
    body: request,
  });
}

/** `POST /api/announcement/attendance/send` — posts immediately. One post per
 *  Dhaka day per server by DB claim; `force` is the only way past it, and a
 *  failed send is free.
 *
 *  ⚠️ Applies to **every** configured server unless `guildIds` narrows it, and
 *  **partial success is HTTP 200** — read `summary.failed` and `servers[]`.
 *  Each server takes its own day-claim, so one failure never consumes another's. */
export function sendAnnouncement(
  force = false,
  guildIds?: string[],
): Promise<AnnouncementSendResult> {
  return api<AnnouncementSendResult>("/announcement/attendance/send", {
    method: "POST",
    body: {
      force,
      ...(guildIds && guildIds.length > 0 ? { guildIds } : {}),
    },
  });
}
