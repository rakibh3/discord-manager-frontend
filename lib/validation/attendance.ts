import { z } from "zod";

/** Shared attendance validation, mirroring the backend's Zod rules. Not
 *  `server-only`: the form runs these in the browser, the server enforces them.
 *
 *  ⚠️ The submit body carries **only** `email` and `discordUsername` (plus the
 *  optional mismatch flag). The student's `name` and `phone` are not part of
 *  the request — the backend sources them from the matched active roster entry
 *  when enforcement is enabled, and records empty strings otherwise. Carrying
 *  them on the body is refused with a 400 naming the field. */

/** Official Discord username rule: 2–32 chars of `[a-z0-9_.]`, no consecutive
 *  dots. ⚠️ Do not tighten — 5.3% of members have a leading/trailing separator. */
export const DISCORD_USERNAME_REGEX = /^(?!.*\.{2})[a-z0-9_.]{2,32}$/;

/** Trim → strip leading `@` → lowercase. Runs before validation, not as the user
 *  types — rewriting the field under the caret is hostile on mobile. */
export function normalizeDiscordUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export const attendanceSchema = z.object({
  email: z.email({ error: "Enter a valid email address." }),
  discordUsername: z
    .string()
    .transform(normalizeDiscordUsername)
    .refine((value) => DISCORD_USERNAME_REGEX.test(value), {
      error:
        "Use the name under the @ on your Discord profile — 2 to 32 characters, lowercase letters, digits, _ or . only, and no two dots in a row.",
    }),
  /** When a student's Discord pairing does not match the on-file record, ticking
   *  this lets them submit anyway and queues a mismatch report for review. */
  cannotEnterRealDiscordUsername: z.boolean().optional(),
});

export type AttendanceInput = z.input<typeof attendanceSchema>;
export type AttendanceValues = z.output<typeof attendanceSchema>;

/** Our own copy per field, replacing the backend's Title Cased Zod messages. */
export const ATTENDANCE_FIELD_COPY: Record<string, string> = {
  email: "Enter a valid email address.",
  discordUsername:
    "Use the name under the @ on your Discord profile — lowercase letters, digits, _ or . only.",
};
