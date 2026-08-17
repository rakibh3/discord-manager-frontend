import "server-only";

import { cache } from "react";

import { api } from "@/lib/api/client";
import type { DiscordSyncStatus, SyncTriggerResult } from "@/lib/api/types";

/**
 * `GET /api/discord/sync/status` — bot connection, member counts, last sync,
 * and the daily-update ingestion state.
 *
 * Uncached: the counters are live. Memoized per render pass so the dashboard's
 * health banner and the Discord page's status panel share one call.
 */
export const getSyncStatus = cache((): Promise<DiscordSyncStatus> =>
  api<DiscordSyncStatus>("/discord/sync/status"),
);

/**
 * `POST /api/discord/sync` — fires a full guild re-sync **without awaiting it**.
 *
 * Answers **202** before any work has happened; a real sync takes tens of
 * seconds. Completion is determined by polling the status endpoint until
 * `lastSync.running` flips to `false`.
 *
 * 409 means a sync is already running — that is not an error, it just means the
 * caller should start polling. 503 means the bot is not connected or the guild
 * could not be fetched.
 */
export function triggerSync(): Promise<SyncTriggerResult> {
  return api<SyncTriggerResult>("/discord/sync", { method: "POST" });
}
