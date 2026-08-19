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
 *  must never be sent; the service-level 400s are safe to show verbatim.
 *
 *  ⚠️ `announceTime` also moves the `#daily-update` **open** time, in the same
 *  transaction — the channel opens when this message is posted. The channel is
 *  reconciled immediately, so a time already past today opens it now rather than
 *  tomorrow, and an `announceTime` not strictly earlier than the schedule's
 *  `closeTime` is a 400. Re-read the schedule after a call that changes it. */
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
 *  ⚠️ It also **opens `#daily-update`** in the servers it posted to — announcing
 *  a window nobody can post in would be worse than not announcing at all. Read
 *  `data.channel`: `failed` there means the message went out and the channel did
 *  not open, and a `null` `locksAt` means nothing will close it again. The stored
 *  open time is not changed; this send is a moment, not a new schedule.
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
