import "server-only";

import { cache } from "react";

import { api, apiRequest } from "@/lib/api/client";
import type {
  ApiResponse,
  ReminderCriterion,
  ReminderDeliveryStatus,
  ReminderLogRow,
  ReminderProgress,
  ReminderQueued,
  ReminderQueueStatus,
  ReminderRecipientRow,
  ReminderTargetsPayload,
} from "@/lib/api/types";
import { periodQuery, type Period } from "@/lib/period";

/** How a target set is computed, shared by the preview and the send so the two
 *  cannot disagree — they run the same query. */
export type ReminderSelection = {
  period: Period;
  /** Defaults to `MISSING_UPDATE`, which is what a broadcast meant before
   *  ranges existed. `MISSING_BOTH` is opt-in on purpose. */
  criterion?: ReminderCriterion;
  /** How many counted days the person must have failed. Defaults to 1. */
  minMissedDays?: number;
  /** Omitted means every configured server. */
  guildIds?: string[];
};

function selectionQuery(selection: ReminderSelection) {
  return {
    ...periodQuery(selection.period),
    criterion: selection.criterion,
    minMissedDays: selection.minMissedDays,
    guildIds: selection.guildIds,
  };
}

/** `GET /api/reminders/targets` — the dry run, sends nothing. Not paginated, so
 *  render `targetCount` plus a bounded slice, never the raw array.
 *
 *  `targetCount` counts recipient rows and `uniqueRecipients` counts people: one
 *  account targeted through two servers is still exactly one DM, and that gap is
 *  the per-server audit trail rather than a duplicate send. */
export function getTargets(
  selection: ReminderSelection,
): Promise<ReminderTargetsPayload> {
  return api<ReminderTargetsPayload>("/reminders/targets", {
    query: selectionQuery(selection),
  });
}

/** `POST /api/reminders/send` — DMs thousands and cannot be undone. 202 means
 *  queued, paced at `dmPerSecond`; `message` is 1–1970 chars.
 *
 *  A 409 means an unfinished broadcast covers a period sharing **any** day with
 *  this one — an overlap check, not date equality, because it guards the bot's
 *  single global DM budget. */
export function sendReminder(
  selection: ReminderSelection & { message: string },
): Promise<ReminderQueued> {
  return api<ReminderQueued>("/reminders/send", {
    method: "POST",
    body: {
      ...periodQuery(selection.period),
      criterion: selection.criterion,
      minMissedDays: selection.minMissedDays,
      ...(selection.guildIds && selection.guildIds.length > 0
        ? { guildIds: selection.guildIds }
        : {}),
      message: selection.message,
    },
  });
}

/** `GET /api/reminders` — history, newest first, paginated. */
export function getHistory(options: {
  page?: number;
  limit?: number;
} = {}): Promise<ApiResponse<ReminderLogRow[]>> {
  return apiRequest<ReminderLogRow[]>("/reminders", {
    query: { page: options.page, limit: options.limit },
  });
}

/** `GET /api/reminders/:id` — live progress, read from the recipient rows and
 *  guaranteed to sum to `targetCount`. */
export function getProgress(id: string): Promise<ReminderProgress> {
  return api<ReminderProgress>(`/reminders/${id}`);
}

/** `GET /api/reminders/:id/recipients` — the delivery audit, paginated and
 *  filterable, sorted by `discordUsername`. */
export function getRecipients(
  id: string,
  options: {
    page?: number;
    limit?: number;
    status?: ReminderDeliveryStatus;
  } = {},
): Promise<ApiResponse<ReminderRecipientRow[]>> {
  return apiRequest<ReminderRecipientRow[]>(`/reminders/${id}/recipients`, {
    query: {
      page: options.page,
      limit: options.limit,
      status: options.status,
    },
  });
}

/** `POST /api/reminders/:id/cancel` — the same payload as `GET /:id`, already
 *  `CANCELLED`. Unreached recipients stay `PENDING`; 409 if already terminal. */
export function cancelReminder(id: string): Promise<ReminderProgress> {
  return api<ReminderProgress>(`/reminders/${id}/cancel`, { method: "POST" });
}

/** `GET /api/reminders/status` — queue and worker health. Memoized per render
 *  pass, since the composer and the health panel both need it. */
export const getQueueStatus = cache((): Promise<ReminderQueueStatus> =>
  api<ReminderQueueStatus>("/reminders/status"),
);
