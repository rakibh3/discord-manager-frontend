import "server-only";

import { cache } from "react";

import { api } from "@/lib/api/client";
import type {
  DiscordServer,
  DiscordSyncStatus,
  SyncTriggerResult,
} from "@/lib/api/types";

/** `GET /api/discord/servers` — every configured server, with its label and
 *  whether the bot currently reaches it. Build every server filter from this
 *  rather than hard-coding IDs; a single-server deployment returns one entry,
 *  which is the normal case rather than a separate mode. Memoized per render. */
export const getServers = cache((): Promise<DiscordServer[]> =>
  api<DiscordServer[]>("/discord/servers"),
);

/** The same list, but a failure answers with an empty list instead of throwing.
 *  The server list only decides whether a *filter* is worth rendering, so it
 *  must never be able to take a page of real figures down with it. */
export const getServersQuietly = cache(async (): Promise<DiscordServer[]> => {
  try {
    return await getServers();
  } catch {
    return [];
  }
});

/** `GET /api/discord/sync/status` — bot connection, member counts, last sync and
 *  ingestion state, plus `servers[]` with each server's own counts and channel
 *  verification. Uncached, but memoized per render pass.
 *
 *  Every server names its channels identically, so a swapped channel ID is
 *  invisible in configuration and in Discord. `servers[].channels[…].verified`
 *  is the only place it shows up — read it first when one server goes quiet. */
export const getSyncStatus = cache((): Promise<DiscordSyncStatus> =>
  api<DiscordSyncStatus>("/discord/sync/status"),
);

/** `POST /api/discord/sync` — answers 202 before any work, so poll the status
 *  endpoint until `lastSync.running` is false. 409 means one is already running. */
export function triggerSync(): Promise<SyncTriggerResult> {
  return api<SyncTriggerResult>("/discord/sync", { method: "POST" });
}
