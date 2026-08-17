"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  getSchedule,
  lockChannel,
  openChannel,
  patchSchedule,
} from "@/lib/api/endpoints/schedule";
import type { ChannelSchedulePayload, SchedulePatch } from "@/lib/api/types";

export type ScheduleResult =
  | { ok: true; data: ChannelSchedulePayload }
  | { ok: false; message: string };

/**
 * Applies a partial schedule change.
 *
 * The 200 response already reflects the change *and* the reloaded scheduler, so
 * it is returned to the caller to replace the displayed state without waiting
 * for a round trip through `revalidatePath`.
 */
export async function updateSchedule(
  patch: SchedulePatch,
): Promise<ScheduleResult> {
  if (Object.keys(patch).length === 0) {
    return { ok: false, message: "Nothing has changed, so there is nothing to save." };
  }

  try {
    const data = await patchSchedule(patch);
    revalidatePath("/dashboard/schedule");
    return { ok: true, data };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    // The client mirrors the backend's cross-field rule, but the stored row can
    // change between load and save. If the backend still rejects it, its 400 is
    // a long explanatory sentence written for exactly this case — show it.
    return { ok: false, message: error.message };
  }
}

export type ChannelToggleState =
  | { ok: true; isOpen: boolean; announced: boolean; message: string }
  | { ok: false; message: string; refreshed: ChannelSchedulePayload | null };

/**
 * Manual open/lock.
 *
 * Both post an announcement embed to a channel thousands of students read, so
 * the UI gates them behind a confirmation. The stored schedule is untouched —
 * the next scheduled transition still fires.
 */
async function toggleChannel(
  action: "open" | "lock",
): Promise<ChannelToggleState> {
  try {
    const result =
      action === "open" ? await openChannel() : await lockChannel();

    revalidatePath("/dashboard/schedule");

    return {
      ok: true,
      isOpen: result.isOpen,
      announced: result.announced,
      message: result.announced
        ? `Channel ${action === "open" ? "opened" : "locked"} and the announcement was posted.`
        : `Channel ${action === "open" ? "opened" : "locked"}, but the announcement embed was not posted.`,
    };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    // On failure the displayed state must not be left showing an optimistic
    // value — re-read the truth from Discord so the admin sees what actually
    // happened rather than what they asked for.
    let refreshed: ChannelSchedulePayload | null = null;
    try {
      refreshed = await getSchedule();
    } catch {
      refreshed = null;
    }

    // 403 names the exact permission to grant; 503 says whether the bot is down
    // or the edit failed. Both are written for humans.
    return { ok: false, message: error.message, refreshed };
  }
}

// Every export of a `"use server"` module has to be an async function
// declaration — an arrow-function alias is not recognised as a Server Action.
export async function openChannelNow(): Promise<ChannelToggleState> {
  return toggleChannel("open");
}

export async function lockChannelNow(): Promise<ChannelToggleState> {
  return toggleChannel("lock");
}
