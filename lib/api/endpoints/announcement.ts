import "server-only";

import { api } from "@/lib/api/client";
import type {
  AnnouncementPatch,
  AnnouncementPayload,
  AnnouncementPreview,
  AnnouncementPreviewRequest,
  AnnouncementSendResult,
} from "@/lib/api/types";

/**
 * `GET /api/announcement/attendance`.
 *
 * The evening message posted into `#attendance` — the one that tells ~5,000
 * students to submit. The row is created lazily on first read, so this never
 * 404s.
 *
 * Unlike the channel schedule this costs **no** Discord call for channel state,
 * but it does resolve every mention target, so it must not be polled tightly.
 * Uncached regardless: `preview.content` embeds today's date and
 * `today.posted` is the "sent today ✓" signal, both of which go stale within a
 * day and neither of which may be shown wrong.
 */
export function getAnnouncement(): Promise<AnnouncementPayload> {
  return api<AnnouncementPayload>("/announcement/attendance");
}

/**
 * `PATCH /api/announcement/attendance`.
 *
 * An **empty object is rejected with 400**, and `timezone` must never be sent.
 * Two further 400s come from the service rather than Zod, which means their
 * messages arrive un-Title-Cased and are safe to display verbatim: an unknown
 * placeholder (the message names it and lists the supported set), and a
 * **rendered** message over Discord's 2,000 characters — the length is measured
 * after placeholder expansion with the mention line appended, never on the raw
 * body.
 *
 * The 200 is the same shape as `GET`. A scheduler reload failure does not fail
 * the request — the row is saved either way and the problem surfaces under
 * `scheduler` on the next read.
 */
export function patchAnnouncement(
  patch: AnnouncementPatch,
): Promise<AnnouncementPayload> {
  return api<AnnouncementPayload>("/announcement/attendance", {
    method: "PATCH",
    body: patch,
  });
}

/**
 * `POST /api/announcement/attendance/preview`.
 *
 * Renders a body against today's live values and **stores nothing**. An empty
 * object previews what is currently stored.
 *
 * Produced by the same renderer the timed post uses, so it is exactly what
 * students would read. It resolves mention targets on every call, so callers
 * must debounce (≥ 500 ms).
 */
export function previewAnnouncement(
  request: AnnouncementPreviewRequest = {},
): Promise<AnnouncementPreview> {
  return api<AnnouncementPreview>("/announcement/attendance/preview", {
    method: "POST",
    body: request,
  });
}

/**
 * `POST /api/announcement/attendance/send`.
 *
 * Posts immediately, leaving the stored schedule untouched, and works even on a
 * process where `SCHEDULER_ENABLED` is false.
 *
 * At most one post per Dhaka day, enforced by a database claim rather than by
 * timing — a double-clicked button gets a 409, not a second message. `force`
 * is the only way past that, and files the second post as the next attempt; use
 * it to recover a day stuck in `SENDING`, or for a genuinely intended second
 * announcement.
 *
 * A **failed** send does not consume the day, so after fixing a permission a
 * plain retry is allowed to post — no `force` needed. 403 means the bot lacks
 * `Send Messages` on the channel; 503 means it is not connected.
 */
export function sendAnnouncement(
  force = false,
): Promise<AnnouncementSendResult> {
  return api<AnnouncementSendResult>("/announcement/attendance/send", {
    method: "POST",
    body: { force },
  });
}
