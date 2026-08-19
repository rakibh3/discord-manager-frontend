"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  getAnnouncement,
  patchAnnouncement,
  sendAnnouncement,
} from "@/lib/api/endpoints/announcement";
import { formatWallClock } from "@/lib/dhaka-date";
import type {
  AnnouncementPatch,
  AnnouncementPayload,
  AnnouncementSendResult,
} from "@/lib/api/types";

export type AnnouncementResult =
  | { ok: true; data: AnnouncementPayload }
  | { ok: false; message: string };

/** Partial update to the template or its schedule; service-level 400s are shown verbatim. */
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

    // `announceTime` *is* the channel's open time — the backend moves both in
    // one transaction — so the schedule screen is stale the moment this
    // succeeds, and would otherwise keep showing the old opening time.
    if (patch.announceTime) revalidatePath("/dashboard/schedule");

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
      /** ⚠️ True when a server failed *inside a 200* — the send reached some
       *  servers and not others, which no status code will tell you. */
      partial: boolean;
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

/** Posts the announcement immediately — no undo, so the UI confirms first.
 *  `force` bypasses the once-per-day claim; a failed send never consumes the day. */
export async function sendAnnouncementNow(
  force = false,
  guildIds?: string[],
): Promise<AnnouncementSendState> {
  try {
    const result = await sendAnnouncement(force, guildIds);
    revalidatePath("/dashboard/announcement");
    // The send opened `#daily-update` wherever it posted, so the channel state
    // on the schedule screen — read live from Discord — has just changed.
    revalidatePath("/dashboard/schedule");

    // ⚠️ Not the `ok`/`succeeded` envelope the channel toggles use: each server
    // reports a dispatch *status*, because "already sent" is neither success nor
    // failure — it is the once-per-day claim working exactly as intended.
    const posted = result.servers.filter(
      (server) => server.status === "posted",
    );
    const failed = result.servers.filter(
      (server) => server.status === "failed",
    );

    // Mention targets that no longer resolve are dropped silently by Discord,
    // so the count has to be carried into the confirmation itself.
    const unresolved = new Set(
      posted.flatMap((server) =>
        server.status === "posted" ? server.unresolvedTargets : [],
      ),
    );

    const { total, alreadySent } = result.summary;

    // Sending and opening the channel are one action: the message tells students
    // to submit, and the window is what lets them. A server where the post landed
    // but the channel stayed shut is the worst outcome of the two — those
    // students can read the instruction and cannot act on it — so it is carried
    // in the headline rather than left to the report below.
    const channelFailed = result.channel.failed;

    const base =
      failed.length > 0
        ? `Posted in ${posted.length} of ${total} servers — ${failed.length} failed.`
        : total > 1
          ? `Posted in ${posted.length} of ${total} servers${alreadySent > 0 ? `; ${alreadySent} already had today's message.` : "."}`
          : "Announcement posted.";

    const parts = [base];

    if (channelFailed.length > 0) {
      parts.push(
        `#daily-update did not open in ${channelFailed.length} server${channelFailed.length === 1 ? "" : "s"} — those students cannot submit yet.`,
      );
    } else if (result.channel.opened.length > 0) {
      parts.push(
        `#daily-update is now open${result.channel.locksAt ? ` until ${formatWallClock(result.channel.locksAt)}` : ""}.`,
      );
    }

    if (result.channel.locksAt === null && result.channel.opened.length > 0) {
      // No lock job is registered, so nothing will close the window. A post made
      // after midnight lands on the *next* day's record.
      parts.push("Nothing will lock it — it has to be locked by hand.");
    }

    if (unresolved.size > 0) {
      parts.push(
        `${unresolved.size} mention target(s) no longer resolve and were dropped from the post.`,
      );
    }

    return {
      ok: true,
      result,
      // A run that left a server behind is not a success story, whatever the
      // status code says — and a channel that did not open leaves one behind
      // just as surely as a post that did not land.
      partial:
        failed.length > 0 ||
        channelFailed.length > 0 ||
        (posted.length > 0 && posted.length < total),
      message: parts.join(" "),
      refreshed: await refreshQuietly(),
    };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    // Re-read so the screen reflects what actually happened; a 409 means a
    // message already exists today and the on-screen attempts are stale.
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
