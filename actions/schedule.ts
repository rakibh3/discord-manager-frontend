"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  getSchedule,
  lockChannel,
  openChannel,
  patchSchedule,
} from "@/lib/api/endpoints/schedule";
import { fanOutMessage, normalizeFanOut } from "@/lib/api/fan-out";
import type {
  ChannelSchedulePayload,
  FanOutServer,
  FanOutSummary,
  SchedulePatch,
} from "@/lib/api/types";

export type ScheduleResult =
  | { ok: true; data: ChannelSchedulePayload }
  | { ok: false; message: string };

/** Applies a partial schedule change. The 200 already reflects the change and
 *  the reloaded scheduler, so it replaces displayed state without a round trip. */
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

    // The stored row can change between load and save; the backend's 400 for
    // this case is a long sentence written for an admin, so show it.
    return { ok: false, message: error.message };
  }
}

export type ChannelToggleState =
  | {
      ok: true;
      isOpen: boolean;
      /** ⚠️ True when at least one server failed *inside a 200*. The message
       *  already says so; this drives whether the UI shows it as a warning. */
      partial: boolean;
      message: string;
      servers: FanOutServer<{ announced: boolean }>[];
      summary: FanOutSummary;
    }
  | {
      ok: false;
      message: string;
      servers: FanOutServer<{ announced: boolean }>[];
      refreshed: ChannelSchedulePayload | null;
    };

/** Manual open/lock. Both post an embed thousands of students read, so the UI
 *  confirms first. The stored schedule is untouched.
 *
 *  This fans out across every configured server (or the ones named), and a
 *  request that succeeded in one server and failed in another still answers
 *  HTTP 200 — so the outcome is read from `summary.failed`, never from the
 *  promise resolving. */
async function toggleChannel(
  action: "open" | "lock",
  guildIds?: string[],
): Promise<ChannelToggleState> {
  const verb = action === "open" ? "Channel opened" : "Channel locked";

  try {
    const result =
      action === "open"
        ? await openChannel(guildIds)
        : await lockChannel(guildIds);

    revalidatePath("/dashboard/schedule");

    const fanOut = normalizeFanOut(result, { label: "the server" });

    // A server that changed state but could not post the embed is not a
    // failure, but it is worth saying — the students were never told.
    const silent = fanOut.servers.filter(
      (server) => server.ok && server.value?.announced === false,
    ).length;

    return {
      ok: true,
      isOpen: result.isOpen,
      partial: fanOut.partial,
      summary: fanOut.summary,
      servers: fanOut.servers,
      message:
        silent > 0 && !fanOut.partial
          ? `${fanOutMessage(fanOut, verb)} The announcement embed was not posted in ${silent} of them.`
          : fanOutMessage(fanOut, verb),
    };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    // On failure, re-read the truth from Discord so the admin sees what
    // actually happened rather than an optimistic value.
    let refreshed: ChannelSchedulePayload | null = null;
    try {
      refreshed = await getSchedule();
    } catch {
      refreshed = null;
    }

    // 403 names the exact permission to grant; 503 says whether the bot is down
    // or the edit failed. Both are written for humans.
    return { ok: false, message: error.message, servers: [], refreshed };
  }
}

// Every export of a `"use server"` module has to be an async function
// declaration — an arrow-function alias is not recognised as a Server Action.
export async function openChannelNow(
  guildIds?: string[],
): Promise<ChannelToggleState> {
  return toggleChannel("open", guildIds);
}

export async function lockChannelNow(
  guildIds?: string[],
): Promise<ChannelToggleState> {
  return toggleChannel("lock", guildIds);
}
