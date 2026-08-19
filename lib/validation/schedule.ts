import type { ChannelSchedulePayload, SchedulePatch } from "@/lib/api/types";
import { formatWallClock } from "@/lib/dhaka-date";

/** 0 = Sunday … 6 = Saturday, matching the backend's `daysOfWeek`. */
export const WEEKDAYS = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
] as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function formatWeekdays(days: number[]): string {
  if (days.length === 0) return "No days selected";
  if (days.length === 7) return "Every day";

  const sorted = [...days].sort((a, b) => a - b);
  return sorted
    .map((day) => WEEKDAYS.find((weekday) => weekday.value === day)?.short ?? day)
    .join(", ");
}

/** The editable half of the schedule. `openTime` is deliberately absent — it
 *  mirrors the announcement time and the backend rejects it outright. */
export type ScheduleFormValues = {
  closeTime: string;
  daysOfWeek: number[];
  enabled: boolean;
};

/** Only the fields that actually differ from the loaded row. */
export function buildPatch(
  current: ChannelSchedulePayload["schedule"],
  next: ScheduleFormValues,
): SchedulePatch {
  const patch: SchedulePatch = {};

  if (next.closeTime !== current.closeTime) patch.closeTime = next.closeTime;
  if (next.enabled !== current.enabled) patch.enabled = next.enabled;

  const sortedNext = [...next.daysOfWeek].sort((a, b) => a - b);
  const sortedCurrent = [...current.daysOfWeek].sort((a, b) => a - b);
  if (sortedNext.join(",") !== sortedCurrent.join(",")) {
    patch.daysOfWeek = sortedNext;
  }

  // `timezone` is deliberately never included — the backend strips it silently
  // and the zone is fixed at Asia/Dhaka. `openTime` is not included either, but
  // for the opposite reason: it is *rejected*, not stripped.
  return patch;
}

export type ScheduleValidation =
  | { ok: true; patch: SchedulePatch }
  | { ok: false; message: string };

/** Mirrors the backend's three rejections. `closeTime` is judged against the
 *  **stored** `openTime`, which is the announcement time — the form cannot move
 *  it, so there is nothing to merge on that side any more. */
export function validateSchedulePatch(
  current: ChannelSchedulePayload["schedule"],
  next: ScheduleFormValues,
): ScheduleValidation {
  if (!TIME_PATTERN.test(next.closeTime)) {
    return {
      ok: false,
      message: "Enter the lock time in 24-hour HH:mm format, between 00:00 and 23:59.",
    };
  }

  if (next.daysOfWeek.length === 0) {
    return {
      ok: false,
      message:
        "Select at least one weekday. A schedule with no days would never open the channel.",
    };
  }

  const patch = buildPatch(current, next);

  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      message: "Nothing has changed, so there is nothing to save.",
    };
  }

  const openTime = current.openTime;
  const closeTime = patch.closeTime ?? current.closeTime;

  // String comparison is correct for zero-padded HH:mm.
  if (closeTime <= openTime) {
    return {
      ok: false,
      message: `The lock time must be later than ${formatWallClock(openTime)}, when the channel opens. Because the open time follows the announcement, locking earlier than that means moving the announcement first — on the announcement screen.`,
    };
  }

  return { ok: true, patch };
}

/** `scheduler.lastRun.error` surfaces a raw `DiscordAPIError[50013]`, which tells
 *  an admin nothing about what to do — so it is translated. */
export function explainScheduleError(error: string | null): string | null {
  if (!error) return null;

  if (error.includes("50013") || /missing permissions/i.test(error)) {
    return "The bot lacks the Manage Roles permission on this channel, so it cannot change who may post. The channel will not open or lock on schedule until that permission is granted on the channel itself (not just server-wide).";
  }

  if (error.includes("50001") || /missing access/i.test(error)) {
    return "The bot cannot see this channel. Check that it is a member of the channel and that no category override is hiding it.";
  }

  if (error.includes("10003")) {
    return "The configured channel no longer exists. Check the channel ID in the backend configuration.";
  }

  return null;
}
