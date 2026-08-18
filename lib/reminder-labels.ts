import type {
  ReminderCriterion,
  ReminderDeliveryStatus,
  ReminderStatus,
} from "@/lib/api/types";
import { formatCivilDate } from "@/lib/dhaka-date";

/** Fixed wording per status. `DM_CLOSED` and a cancelled broadcast's unattempted
 *  recipients are not failures, and must not read as one. */

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

/** "~18 minutes" from `outstanding / dmPerSecond`. At 2 DMs/sec a 5,000-member
 *  broadcast runs ~40 minutes, and a barely-moving bar reads as a hung job. */
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

// ── Period and criterion (API_INTEGRATION.md §5A) ───────────────────────────

export const CRITERION_LABEL: Record<ReminderCriterion, string> = {
  MISSING_UPDATE: "No daily update",
  MISSING_BOTH: "Neither attendance nor an update",
};

export const CRITERION_DESCRIPTION: Record<ReminderCriterion, string> = {
  MISSING_UPDATE:
    "Targets anyone with no daily update on a counted day, whatever their attendance says. This is the default because it is exactly what a broadcast meant before ranges existed — and the daily-update channel is what reminders exist to drive.",
  MISSING_BOTH:
    "Targets only people who filed neither attendance nor an update on a counted day. Narrower: a student who submits attendance and never posts an update is not reminded.",
};

/** Every broadcast records a period rather than a single date; a single-date
 *  send stores the same day at both ends. ⚠️ `reminderDate` no longer exists on
 *  any payload, so nothing may read one. Written defensively because a payload
 *  from a backend that predates the change would otherwise render "Invalid Date". */
export function reminderPeriodLabel(period: {
  reminderStartDate?: string | null;
  reminderEndDate?: string | null;
}): string {
  const { reminderStartDate: start, reminderEndDate: end } = period;

  if (!start && !end) return "Unknown period";
  if (!start || !end || start === end) {
    return formatCivilDate((start ?? end) as string);
  }
  return `${formatCivilDate(start)} – ${formatCivilDate(end)}`;
}

/** The shorter form a table cell can hold. */
export function reminderPeriodShort(period: {
  reminderStartDate?: string | null;
  reminderEndDate?: string | null;
}): string {
  const { reminderStartDate: start, reminderEndDate: end } = period;
  if (start && end && start !== end) {
    const days =
      Math.floor(
        (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
          86_400_000,
      ) + 1;
    return `${formatCivilDate(start)} + ${days - 1} more day${days - 1 === 1 ? "" : "s"}`;
  }
  return reminderPeriodLabel(period);
}
