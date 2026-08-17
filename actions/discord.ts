"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { triggerSync } from "@/lib/api/endpoints/discord";

export type SyncTriggerState =
  | { outcome: "started"; message: string }
  | { outcome: "already-running"; message: string }
  | { outcome: "error"; message: string };

/**
 * Starts a full guild re-sync.
 *
 * The endpoint answers **202** before doing any work, so "started" here means
 * queued, not finished — the caller polls `/api/discord/sync-status` until
 * `lastSync.running` is `false`.
 */
export async function triggerMemberSync(): Promise<SyncTriggerState> {
  try {
    await triggerSync();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    // 409 means a sync is already in flight. That is not a failure — the thing
    // the admin wanted (a sync running) is true. Reporting an error here would
    // make a working system look broken, so poll instead.
    if (error.status === 409) {
      return {
        outcome: "already-running",
        message: "A sync is already in progress. Watching it instead.",
      };
    }

    // 503 is the bot being disconnected or the guild failing to fetch. The
    // backend's message names which, so it is worth showing verbatim.
    if (error.status === 503) {
      return { outcome: "error", message: error.message };
    }

    return { outcome: "error", message: error.message };
  }

  revalidatePath("/dashboard/discord");
  return {
    outcome: "started",
    message:
      "Sync started. It runs in the background and takes tens of seconds for a large guild.",
  };
}
