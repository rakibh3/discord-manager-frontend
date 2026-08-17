import "server-only";

import { cache } from "react";

import { api, apiRequest } from "@/lib/api/client";
import type {
  ApiResponse,
  ReminderDeliveryStatus,
  ReminderLogRow,
  ReminderProgress,
  ReminderQueued,
  ReminderQueueStatus,
  ReminderRecipientRow,
  ReminderTargetsPayload,
} from "@/lib/api/types";

/**
 * `GET /api/reminders/targets?date=YYYY-MM-DD` — the dry run. Sends nothing.
 *
 * `date` is required, must be a real calendar date and must not be in the
 * future. The response is **not paginated**: on a bad day in a 5,000-member
 * guild this is thousands of rows, so callers render `targetCount` plus a
 * bounded slice, never the raw array.
 *
 * This is the exact same query `POST /send` uses, so the preview cannot
 * disagree with what the send will do.
 */
export function getTargets(date: string): Promise<ReminderTargetsPayload> {
  return api<ReminderTargetsPayload>("/reminders/targets", { query: { date } });
}

/**
 * `POST /api/reminders/send` — DMs thousands of people and cannot be undone.
 *
 * Answers **202**: the jobs were queued and *nothing has been delivered*.
 * Delivery is paced at `dmPerSecond` (2/sec by default), so a full guild runs
 * for roughly 40 minutes.
 *
 * `date` is required and never inferred — an inferred date near midnight would
 * remind the wrong day's members. `message` is 1–**1970** characters (Discord's
 * 2000 minus the fixed `⚠️ **Daily Update Reminder**` heading).
 *
 * 400 also means "every member already submitted" — nobody to remind, which is
 * a good outcome, not a failure. 409 is the double-click guard and names the
 * existing broadcast. 503 means Redis is unreachable and the broadcast was
 * auto-cancelled so the date isn't left blocked.
 */
export function sendReminder(input: {
  date: string;
  message: string;
}): Promise<ReminderQueued> {
  return api<ReminderQueued>("/reminders/send", {
    method: "POST",
    body: input,
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

/**
 * `GET /api/reminders/:id` — live progress.
 *
 * The four counts are read from the recipient rows rather than the session
 * row's cached counters, and are guaranteed to sum to `targetCount`.
 */
export function getProgress(id: string): Promise<ReminderProgress> {
  return api<ReminderProgress>(`/reminders/${id}`);
}

/**
 * `GET /api/reminders/:id/recipients` — the delivery audit, paginated and
 * filterable. Sorted by `discordUsername`. Contact details are deliberately not
 * exposed by the backend.
 */
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

/**
 * `POST /api/reminders/:id/cancel` — returns the same payload as `GET /:id`,
 * already showing `CANCELLED`.
 *
 * The worker re-reads the status before every send, so queued and in-flight
 * jobs stop delivering. Recipients never reached stay `PENDING` — they were
 * never attempted, which is not the same as failed. 409 if already terminal.
 */
export function cancelReminder(id: string): Promise<ReminderProgress> {
  return api<ReminderProgress>(`/reminders/${id}/cancel`, { method: "POST" });
}

/**
 * `GET /api/reminders/status` — queue and worker health.
 *
 * Declared before `/:id` on the backend, so this path does not collide.
 * Memoized per render pass: the composer and the health panel both need it.
 */
export const getQueueStatus = cache((): Promise<ReminderQueueStatus> =>
  api<ReminderQueueStatus>("/reminders/status"),
);
