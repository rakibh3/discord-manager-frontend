"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  getAnnouncement,
  patchAnnouncement,
  sendAnnouncement,
} from "@/lib/api/endpoints/announcement";
import type {
  AnnouncementPatch,
  AnnouncementPayload,
  AnnouncementSendResult,
} from "@/lib/api/types";

export type AnnouncementResult =
  | { ok: true; data: AnnouncementPayload }
  | { ok: false; message: string };

/**
 * Applies a partial change to the template or its schedule.
 *
 * The 200 response already reflects the change *and* the rebuilt cron task, so
 * it replaces the displayed state directly rather than waiting for a
 * revalidation round trip.
 *
 * The two service-level 400s — unknown placeholder, and a rendered message over
 * 2,000 characters — arrive as sentences written for an admin (they skip Zod's
 * Title Casing), so they are surfaced verbatim.
 */
export async function updateAnnouncement(
  patch: AnnouncementPatch,
): Promise<AnnouncementResult> {
  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      message: "Nothing has changed, so there is nothing to save.",
    };
  }

  try {
    const data = await patchAnnouncement(patch);
    revalidatePath("/dashboard/announcement");
    return { ok: true, data };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { ok: false, message: error.message };
  }
}

export type AnnouncementSendState =
  | {
      ok: true;
      result: AnnouncementSendResult;
      message: string;
      refreshed: AnnouncementPayload | null;
    }
  | {
      ok: false;
      message: string;
      /** True for a 409 — today is already posted, so `force` is the way past. */
      alreadySent: boolean;
      refreshed: AnnouncementPayload | null;
    };

/**
 * Posts the announcement immediately.
 *
 * The most outward-facing action in the dashboard: it reaches ~5,000 students
 * and, when `mentionEveryone` is on, pings every one of them. There is no undo,
 * so the UI gates it behind a confirmation that shows the rendered message.
 *
 * `force` is the only way past the once-per-day claim and files the post as the
 * next attempt. A *failed* send never consumes the day, so a plain retry after
 * fixing a permission is allowed to post — `force` is not needed for that, and
 * using it there would risk two real messages.
 */
export async function sendAnnouncementNow(
  force = false,
): Promise<AnnouncementSendState> {
  try {
    const result = await sendAnnouncement(force);
    revalidatePath("/dashboard/announcement");

    return {
      ok: true,
      result,
      message:
        result.unresolvedTargets.length > 0
          ? `Announcement posted as attempt ${result.attempt}. ${result.unresolvedTargets.length} mention target(s) no longer resolve and were dropped from the post.`
          : `Announcement posted as attempt ${result.attempt}.`,
      refreshed: await refreshQuietly(),
    };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    // Re-read so the screen reflects what actually happened rather than what
    // was asked for — a 409 in particular means a message already exists today
    // and the attempt list on screen is now out of date.
    return {
      ok: false,
      message: error.message,
      alreadySent: error.status === 409,
      refreshed: await refreshQuietly(),
    };
  }
}

/** A read that must never turn a send outcome into an unhandled error. */
async function refreshQuietly(): Promise<AnnouncementPayload | null> {
  try {
    return await getAnnouncement();
  } catch {
    return null;
  }
}
