import "server-only";

import { api } from "@/lib/api/client";
import type {
  ChannelSchedulePayload,
  ChannelToggleResult,
  SchedulePatch,
} from "@/lib/api/types";

/**
 * `GET /api/schedule/daily-update`.
 *
 * **Never cached.** `channel.isOpen` is read live from Discord on every
 * request — an admin can flip the permission overwrite by hand, and a cached
 * value would show the channel as open while students cannot post. This is also
 * why the endpoint costs a Discord API call every time.
 *
 * The row is created lazily with PID defaults on first read, so this never
 * 404s. Not memoized with `cache()`: the manual open/lock actions need to
 * re-read the true current state within the same request.
 */
export function getSchedule(): Promise<ChannelSchedulePayload> {
  return api<ChannelSchedulePayload>("/schedule/daily-update");
}

/**
 * `PATCH /api/schedule/daily-update`.
 *
 * An **empty object is rejected with 400**, and `timezone` must never be sent
 * (Zod strips it; the zone is fixed at Asia/Dhaka). The cross-field rule —
 * `closeTime` strictly greater than `openTime` — is applied by the service
 * *after merging with the stored row*, so a client check has to merge too.
 *
 * The 200 response is the same shape as `GET`, already reflecting the change
 * with the scheduler reloaded in-process.
 */
export function patchSchedule(
  patch: SchedulePatch,
): Promise<ChannelSchedulePayload> {
  return api<ChannelSchedulePayload>("/schedule/daily-update", {
    method: "PATCH",
    body: patch,
  });
}

/**
 * `POST /api/schedule/daily-update/open`.
 *
 * Forces the channel open **now** and posts an announcement embed that
 * thousands of students see. The stored schedule is untouched, so the next
 * scheduled transition still fires.
 *
 * 403 means the bot lacks `Manage Roles` on the channel — the message names
 * exactly what to grant. 503 means the bot is not connected, or the permission
 * edit failed for another reason.
 */
export function openChannel(): Promise<ChannelToggleResult> {
  return api<ChannelToggleResult>("/schedule/daily-update/open", {
    method: "POST",
  });
}

/** `POST /api/schedule/daily-update/lock`. Same caveats as `openChannel`. */
export function lockChannel(): Promise<ChannelToggleResult> {
  return api<ChannelToggleResult>("/schedule/daily-update/lock", {
    method: "POST",
  });
}
