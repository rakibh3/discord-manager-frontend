import "server-only";

import { api } from "@/lib/api/client";
import type {
  ChannelSchedulePayload,
  ChannelToggleResult,
  SchedulePatch,
} from "@/lib/api/types";

/** `GET /api/schedule/daily-update`. Never cached or memoized: `channel.isOpen`
 *  is read live from Discord, and the manual toggles re-read within a request.
 *  `servers[]` carries each server's own channel state and last run. */
export function getSchedule(): Promise<ChannelSchedulePayload> {
  return api<ChannelSchedulePayload>("/schedule/daily-update");
}

/** `PATCH /api/schedule/daily-update`. An empty object is a 400 and `timezone`
 *  is never sent.
 *
 *  ⚠️ `openTime` is **refused** here, not stripped — it mirrors the announcement
 *  time and moves only at `PATCH /announcement/attendance`. `closeTime` is
 *  checked against that stored open time. */
export function patchSchedule(
  patch: SchedulePatch,
): Promise<ChannelSchedulePayload> {
  return api<ChannelSchedulePayload>("/schedule/daily-update", {
    method: "PATCH",
    body: patch,
  });
}

/** `POST /api/schedule/daily-update/open` — forces the channel open now and
 *  posts an embed. 403 means the bot lacks `Manage Roles`; 503 means it is
 *  offline.
 *
 *  ⚠️ This applies to **every** configured server unless `guildIds` narrows it,
 *  and **partial success is HTTP 200**: read `summary.failed` and `servers[]`
 *  rather than treating a resolved promise as "it worked everywhere". */
export function openChannel(
  guildIds?: string[],
): Promise<ChannelToggleResult> {
  return api<ChannelToggleResult>("/schedule/daily-update/open", {
    method: "POST",
    body: guildIds && guildIds.length > 0 ? { guildIds } : {},
  });
}

/** `POST /api/schedule/daily-update/lock`. Same caveats as `openChannel`. */
export function lockChannel(
  guildIds?: string[],
): Promise<ChannelToggleResult> {
  return api<ChannelToggleResult>("/schedule/daily-update/lock", {
    method: "POST",
    body: guildIds && guildIds.length > 0 ? { guildIds } : {},
  });
}
