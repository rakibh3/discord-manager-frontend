import type { ChannelSchedulePayload, SchedulePatch } from "@/lib/api/types";

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

/** Only the fields that actually differ from the loaded row. */
export function buildPatch(
  current: ChannelSchedulePayload["schedule"],
  next: {
    openTime: string;
    closeTime: string;
    daysOfWeek: number[];
    enabled: boolean;
  },
): SchedulePatch {
  const patch: SchedulePatch = {};

  if (next.openTime !== current.openTime) patch.openTime = next.openTime;
  if (next.closeTime !== current.closeTime) patch.closeTime = next.closeTime;
  if (next.enabled !== current.enabled) patch.enabled = next.enabled;

  const sortedNext = [...next.daysOfWeek].sort((a, b) => a - b);
  const sortedCurrent = [...current.daysOfWeek].sort((a, b) => a - b);
  if (sortedNext.join(",") !== sortedCurrent.join(",")) {
    patch.daysOfWeek = sortedNext;
  }

  // `timezone` is deliberately never included — the backend strips it silently
  // and the zone is fixed at Asia/Dhaka.
  return patch;
}

export type ScheduleValidation =
  | { ok: true; patch: SchedulePatch }
  | { ok: false; message: string };

/**
 * Mirrors the backend's three rejections, so the admin is told before a request
 * goes out rather than after.
 *
 * The `closeTime > openTime` rule is the subtle one: the service applies it to
 * the **merged** result of the patch and the stored row, not to the submitted
 * fields. Sending `{ closeTime: "02:00" }` against a stored `openTime` of
 * `18:00` is a 400 even though the form only shows one field changing — so the
 * check here has to merge against the loaded row too, or it would disagree.
 */
export function validateSchedulePatch(
  current: ChannelSchedulePayload["schedule"],
  next: {
    openTime: string;
    closeTime: string;
    daysOfWeek: number[];
    enabled: boolean;
  },
): ScheduleValidation {
  if (!TIME_PATTERN.test(next.openTime) || !TIME_PATTERN.test(next.closeTime)) {
    return {
      ok: false,
      message: "Enter both times in 24-hour HH:mm format, between 00:00 and 23:59.",
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

  const mergedOpen = patch.openTime ?? current.openTime;
  const mergedClose = patch.closeTime ?? current.closeTime;

  // String comparison is correct for zero-padded HH:mm.
  if (mergedClose <= mergedOpen) {
    return {
      ok: false,
      message: `The close time must be later than the open time. This change would leave the channel opening at ${mergedOpen} and locking at ${mergedClose} on the same day.`,
    };
  }

  return { ok: true, patch };
}

/**
 * `scheduler.lastRun.error` is where a missing `Manage Roles` permission first
 * shows up, as a raw `DiscordAPIError[50013]: Missing Permissions`. That string
 * tells an admin nothing about what to do, so it is translated.
 */
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
