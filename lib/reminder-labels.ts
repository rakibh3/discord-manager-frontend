import type {
  ReminderDeliveryStatus,
  ReminderStatus,
} from "@/lib/api/types";

/**
 * Fixed wording for every status.
 *
 * These are load-bearing. `DM_CLOSED` is not a failure — the member has DMs
 * closed and gets mentioned in `#daily-update-reminder` instead — and a
 * cancelled broadcast's outstanding recipients were *never attempted*, which is
 * accurate rather than a failure. Getting either wrong makes an admin conclude
 * the system broke when it worked exactly as designed.
 */

export const DELIVERY_STATUS_LABEL: Record<ReminderDeliveryStatus, string> = {
  PENDING: "Not yet attempted",
  DELIVERED: "Delivered",
  DM_CLOSED: "DMs closed — mentioned in channel",
  FAILED: "Failed",
};

export const DELIVERY_STATUS_DESCRIPTION: Record<
  ReminderDeliveryStatus,
  string
> = {
  PENDING: "Still queued. Delivery is paced, so this is normal mid-broadcast.",
  DELIVERED: "The direct message was accepted by Discord.",
  DM_CLOSED:
    "This member has direct messages turned off. They are mentioned in #daily-update-reminder once the queue drains instead — this is not a delivery failure.",
  FAILED: "Discord rejected the message for a reason other than closed DMs.",
};

export const BROADCAST_STATUS_LABEL: Record<ReminderStatus, string> = {
  PENDING: "Queued",
  PROCESSING: "Sending",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
};

export function broadcastStatusDescription(status: ReminderStatus): string {
  switch (status) {
    case "PENDING":
      return "Queued. No job has run yet — nothing has been delivered.";
    case "PROCESSING":
      return "In flight. Delivery is paced deliberately to keep the bot from being rate-limited or banned.";
    case "COMPLETED":
      return "Every recipient reached a terminal state.";
    case "CANCELLED":
      return "An admin stopped this broadcast. Recipients still outstanding were never attempted — they were not failures.";
    case "FAILED":
      return "The queue drained while recipients were still pending, which points to a worker that stalled or crashed rather than to Discord rejecting the messages. Worth investigating on the backend.";
  }
}

/** Only these two states are worth polling. */
export const LIVE_STATUSES: ReadonlySet<ReminderStatus> = new Set<ReminderStatus>([
  "PENDING",
  "PROCESSING",
]);

export const isLive = (status: ReminderStatus): boolean =>
  LIVE_STATUSES.has(status);

/**
 * "~18 minutes" from `outstanding / dmPerSecond`.
 *
 * Not a nicety: at 2 DMs/second a 5,000-member broadcast runs for ~40 minutes,
 * and a progress bar that barely moves for that long reads as a hung job when
 * it is the rate limiter working correctly.
 */
export function estimateRemaining(
  outstanding: number,
  dmPerSecond: number,
): string | null {
  if (outstanding <= 0 || dmPerSecond <= 0) return null;

  const seconds = Math.ceil(outstanding / dmPerSecond);
  if (seconds < 60) return `about ${seconds} seconds`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} minute${minutes === 1 ? "" : "s"}`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `about ${hours} hour${hours === 1 ? "" : "s"}${remainder ? ` ${remainder} min` : ""}`;
}

export const REMINDER_MESSAGE_MAX_LENGTH = 1970;
