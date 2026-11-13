import type {
  EmailLogState,
  EmailRowState,
  ReminderChannel,
  ReminderCriterion,
  ReminderDeliveryStatus,
  ReminderEmailEventType,
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
  MISSING_UPDATE: "Anyone without a daily update, whatever their attendance.",
  MISSING_BOTH:
    "Only people with neither attendance nor an update. Narrower.",
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

// ── Reminder email channel ───────────────────────────────────────────────────

export const CHANNEL_LABEL: Record<ReminderChannel, string> = {
  DISCORD: "Discord",
  EMAIL: "Email",
};

/** "Discord + Email", in a stable order. Rows written before email existed have
 *  no `channels`, which means Discord only. */
export function channelsLabel(channels: ReminderChannel[] | undefined): string {
  const list: ReminderChannel[] = channels?.length ? channels : ["DISCORD"];
  return (["DISCORD", "EMAIL"] as const)
    .filter((channel) => list.includes(channel))
    .map((channel) => CHANNEL_LABEL[channel])
    .join(" + ");
}

/** The chips on the email log, in the order they read best. `delivered` is a
 *  SUPERSET of `opened` + `not_opened`, so it comes first. */
export const EMAIL_LOG_STATES: EmailLogState[] = [
  "delivered",
  "opened",
  "not_opened",
  "awaiting",
  "bounced",
  "failed",
  "pending",
  "no_address",
];

export const EMAIL_STATE_LABEL: Record<EmailLogState, string> = {
  delivered: "Delivered",
  opened: "Opened",
  not_opened: "Not opened yet",
  awaiting: "Awaiting delivery",
  bounced: "Bounced",
  failed: "Failed to send",
  pending: "Queued",
  no_address: "Not registered",
};

export const EMAIL_STATE_DESCRIPTION: Record<EmailLogState, string> = {
  delivered:
    "Reached the student's mail server — includes everyone who opened it.",
  opened:
    "An open was recorded. Estimated from a tracking pixel: Apple Mail can open automatically.",
  not_opened:
    "Delivered, but no open recorded. Clients that block images never report an open, so this is not proof it was unread.",
  awaiting:
    "Mailtrap accepted it; no delivery report has arrived yet.",
  bounced: "The receiving server refused it — the address may be wrong.",
  failed: "Mailtrap refused to send it. The error says why.",
  pending: "Waiting in the queue to be sent.",
  no_address:
    "Never registered, so there is no email address. Reached on Discord only, if Discord was a channel.",
};

export const EMAIL_STATE_VARIANT: Record<
  EmailRowState,
  "success" | "secondary" | "warning" | "destructive" | "outline"
> = {
  opened: "success",
  not_opened: "secondary",
  awaiting: "outline",
  bounced: "destructive",
  failed: "destructive",
  pending: "outline",
  no_address: "warning",
};

export const EMAIL_EVENT_LABEL: Record<ReminderEmailEventType, string> = {
  DELIVERY: "Delivered",
  OPEN: "Opened",
  CLICK: "Link clicked",
  SOFT_BOUNCE: "Temporary bounce (Mailtrap retries)",
  BOUNCE: "Bounced",
  REJECT: "Rejected",
  SUSPENSION: "Suspended",
  SPAM: "Marked as spam",
  UNSUBSCRIBE: "Unsubscribed",
};
