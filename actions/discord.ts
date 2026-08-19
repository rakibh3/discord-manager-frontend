"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { triggerSync } from "@/lib/api/endpoints/discord";

export type SyncTriggerState =
  | { outcome: "started"; message: string }
  | { outcome: "already-running"; message: string }
  | { outcome: "error"; message: string };

/** Starts a full guild re-sync. The 202 means queued, not finished — the caller
 *  polls `/api/discord/sync-status` until `lastSync.running` is false.
 *
 *  An omitted `guildId` syncs every configured server (the ordinary case). A
 *  named `guildId` narrows the sync to one server — useful when a single
 *  server's directory needs repairing without paying for a full
 *  multi-thousand-member fetch of the others. The ID must be one of the
 *  configured servers; an unknown ID is a 400 naming it. */
export async function triggerMemberSync(
  guildId?: string,
): Promise<SyncTriggerState> {
  try {
    await triggerSync(guildId);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    // 409 means a sync is already in flight — what the admin wanted is already
    // true, so poll instead of reporting a failure.
    if (error.status === 409) {
      return {
        outcome: "already-running",
        message: "A sync is already in progress. Watching it instead.",
      };
    }

    // 400 is the unnamed/unknown guildId branch — the backend's message names
    // the rejected ID, so it is worth showing verbatim.
    if (error.status === 400) {
      return { outcome: "error", message: error.message };
    }

    // 503 is the bot being disconnected or the guild failing to fetch. The
    // backend's message names which, so it is worth showing verbatim.
    if (error.status === 503) {
      return { outcome: "error", message: error.message };
    }

    return { outcome: "error", message: error.message };
  }

  revalidatePath("/dashboard/discord");
  // The overview tile reads `getSyncStatus()` for its "Last synced …" line,
  // so a sync has to revalidate the dashboard root too — otherwise the tile
  // would still show the previous run's timing until a hard refresh.
  revalidatePath("/dashboard");
  return {
    outcome: "started",
    message: guildId
      ? "Sync started for that server. It runs in the background and takes tens of seconds for a large guild."
      : "Sync started. It runs in the background and takes tens of seconds for a large guild.",
  };
}
