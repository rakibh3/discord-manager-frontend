import type {
  AnnouncementPatch,
  AnnouncementPayload,
  AnnouncementPlaceholder,
} from "@/lib/api/types";

/** Client-side mirrors of the announcement's backend rules, so an admin is told
 *  before a request goes out. The 2,000-char limit is server-only by necessity. */

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Discord snowflakes are 17–20 digits. Shape only — existence is resolved at post time. */
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

/** The same handle rule the attendance form uses. A leading/trailing `_` or `.` is valid. */
const HANDLE_PATTERN = /^(?!.*\.{2})[a-z0-9_.]{2,32}$/;

/** Every `{{token}}` in the text, whatever it is. */
const PLACEHOLDER_PATTERN = /\{\{\s*[\w.]+\s*\}\}/g;

/** `@handle`, ` Rakib_Dev ` and `rakib_dev` all normalize identically. */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Splits a free-text field on commas, spaces and newlines — admins paste role
 *  IDs and handles in every shape, and dropping the rest would be silent. */
export function splitEntries(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** Dedupes while preserving order — the backend rejects duplicates outright. */
function unique(entries: string[]): string[] {
  return [...new Set(entries)];
}

export type AnnouncementFormValues = {
  body: string;
  terminationDays: number;
  mentionEveryone: boolean;
  /** Raw textarea contents; parsed by `splitEntries` at validation time. */
  mentionRoleIdsRaw: string;
  mentionUsernamesRaw: string;
  announceTime: string;
  daysOfWeek: number[];
  enabled: boolean;
};

/** The form's starting values, read off a loaded payload. */
export function formValuesFrom(
  payload: AnnouncementPayload,
): AnnouncementFormValues {
  return {
    // The RAW body with placeholders intact. Binding to `preview.content`
    // would bake today's date into the stored template on the next save.
    body: payload.template.body,
    terminationDays: payload.template.terminationDays,
    mentionEveryone: payload.template.mentionEveryone,
    mentionRoleIdsRaw: payload.template.mentionRoleIds.join("\n"),
    mentionUsernamesRaw: payload.template.mentionUsernames.join("\n"),
    announceTime: payload.schedule.announceTime,
    daysOfWeek: payload.schedule.daysOfWeek,
    enabled: payload.schedule.enabled,
  };
}

/** Placeholders in `body` the backend does not support, returned with their
 *  braces so the message can name the exact string to fix. */
export function unknownPlaceholders(
  body: string,
  supported: readonly AnnouncementPlaceholder[],
): string[] {
  const canonical = new Set<string>(supported);
  const found = body.match(PLACEHOLDER_PATTERN) ?? [];

  return unique(
    found
      // `{{ date }}` and `{{date}}` are the same token to the reader; compare
      // the canonical form so a stray space is not reported as unknown.
      .map((token) => token.replace(/\s+/g, ""))
      .filter((token) => !canonical.has(token)),
  );
}

/** Only the fields that actually differ from the loaded payload. */
export function buildAnnouncementPatch(
  payload: AnnouncementPayload,
  next: AnnouncementFormValues,
): AnnouncementPatch {
  const patch: AnnouncementPatch = {};
  const { template, schedule } = payload;

  if (next.body !== template.body) patch.body = next.body;
  if (next.terminationDays !== template.terminationDays) {
    patch.terminationDays = next.terminationDays;
  }
  if (next.mentionEveryone !== template.mentionEveryone) {
    patch.mentionEveryone = next.mentionEveryone;
  }
  if (next.announceTime !== schedule.announceTime) {
    patch.announceTime = next.announceTime;
  }
  if (next.enabled !== schedule.enabled) patch.enabled = next.enabled;

  const roleIds = unique(splitEntries(next.mentionRoleIdsRaw));
  if (roleIds.join(",") !== template.mentionRoleIds.join(",")) {
    // `[]` is a legitimate value here — it clears the allowlist. Unlike
    // `daysOfWeek`, a mention list that pings nobody is a real choice.
    patch.mentionRoleIds = roleIds;
  }

  const usernames = unique(
    splitEntries(next.mentionUsernamesRaw).map(normalizeHandle),
  );
  if (usernames.join(",") !== template.mentionUsernames.join(",")) {
    patch.mentionUsernames = usernames;
  }

  const sortedNext = [...next.daysOfWeek].sort((a, b) => a - b);
  const sortedCurrent = [...schedule.daysOfWeek].sort((a, b) => a - b);
  if (sortedNext.join(",") !== sortedCurrent.join(",")) {
    patch.daysOfWeek = sortedNext;
  }

  // `timezone` is deliberately never included — the zone is fixed at
  // Asia/Dhaka and the backend strips the field silently.
  return patch;
}

export type AnnouncementValidation =
  | { ok: true; patch: AnnouncementPatch }
  | { ok: false; message: string };

/** Mirrors every rejection the backend makes that we can check without it. */
export function validateAnnouncement(
  payload: AnnouncementPayload,
  next: AnnouncementFormValues,
): AnnouncementValidation {
  if (next.body.trim().length === 0) {
    return {
      ok: false,
      message: "The message body cannot be empty.",
    };
  }

  const unknown = unknownPlaceholders(next.body, payload.supportedPlaceholders);
  if (unknown.length > 0) {
    return {
      ok: false,
      message: `Unknown placeholder(s): ${unknown.join(", ")}. Supported placeholders are ${payload.supportedPlaceholders.join(", ")}. Left in the text these would reach every student as literal characters.`,
    };
  }

  if (
    !Number.isInteger(next.terminationDays) ||
    next.terminationDays < 1 ||
    next.terminationDays > 365
  ) {
    return {
      ok: false,
      message: "Termination days must be a whole number between 1 and 365.",
    };
  }

  if (!TIME_PATTERN.test(next.announceTime)) {
    return {
      ok: false,
      message:
        "Enter the announce time in 24-hour HH:mm format, between 00:00 and 23:59.",
    };
  }

  if (next.daysOfWeek.length === 0) {
    return {
      ok: false,
      message:
        "Select at least one weekday. A schedule with no days would never post. To pause the announcement while keeping the message and the time, turn it off instead.",
    };
  }

  const badRoleIds = unique(splitEntries(next.mentionRoleIdsRaw)).filter(
    (entry) => !SNOWFLAKE_PATTERN.test(entry),
  );
  if (badRoleIds.length > 0) {
    return {
      ok: false,
      message: `Not a valid role ID: ${badRoleIds.join(", ")}. A role ID is the 17–20 digit number you get from "Copy ID" in Discord, not the role's name.`,
    };
  }

  const badHandles = unique(
    splitEntries(next.mentionUsernamesRaw).map(normalizeHandle),
  ).filter((entry) => !HANDLE_PATTERN.test(entry));
  if (badHandles.length > 0) {
    return {
      ok: false,
      message: `Not a valid Discord username: ${badHandles.join(", ")}. Use the handle under the @ on the profile — 2–32 characters, lowercase letters, numbers, _ or . only.`,
    };
  }

  const patch = buildAnnouncementPatch(payload, next);
  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      message: "Nothing has changed, so there is nothing to save.",
    };
  }

  // The length rule is deliberately not checked here: it applies to the rendered
  // message plus the mention line, which only the server can produce.
  return { ok: true, patch };
}

/** `scheduler.lastOutcome` and a failed send surface raw Discord errors, which
 *  tell an admin nothing about what to do. */
export function explainAnnouncementError(error: string | null): string | null {
  if (!error) return null;

  if (error.includes("50013") || /missing permissions/i.test(error)) {
    return "The bot lacks the Send Messages permission on the attendance channel, so the evening announcement is not being posted at all. Grant it on the channel itself, not just server-wide — the only other symptom is a channel that quietly goes silent.";
  }

  if (error.includes("50001") || /missing access/i.test(error)) {
    return "The bot cannot see the attendance channel. Check that it is a member of the channel and that no category override is hiding it.";
  }

  if (error.includes("10003")) {
    return "The configured attendance channel no longer exists. Check the channel ID in the backend configuration.";
  }

  if (error.includes("50035") || /2000 or fewer/i.test(error)) {
    return "Discord rejected the message as too long. The limit is 2,000 characters on the rendered message including the mention line, not on the raw body.";
  }

  return null;
}

/** Splits an `unresolved` entry (`role:<id>` / `user:<handle>`) for display. */
export function describeUnresolved(entry: string): string {
  const [kind, ...rest] = entry.split(":");
  const value = rest.join(":");
  if (kind === "role") return `Role ${value} no longer exists`;
  if (kind === "user") return `@${value} is no longer in the server`;
  return entry;
}
