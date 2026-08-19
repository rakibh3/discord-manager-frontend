import { z } from "zod";

/** Shared attendance validation, mirroring the backend's Zod rules. Not
 *  `server-only`: the form runs these in the browser, the server enforces them. */

/** Official Discord username rule: 2–32 chars of `[a-z0-9_.]`, no consecutive
 *  dots. ⚠️ Do not tighten — 5.3% of members have a leading/trailing separator. */
export const DISCORD_USERNAME_REGEX = /^(?!.*\.{2})[a-z0-9_.]{2,32}$/;

/** Trim → strip leading `@` → lowercase. Runs before validation, not as the user
 *  types — rewriting the field under the caret is hostile on mobile. */
export function normalizeDiscordUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Bangladeshi mobile: `01711000000`, `+8801711000000` or `8801711000000`. */
export const PHONE_REGEX = /^(?:\+?880|0)1[3-9]\d{8}$/;

/** Names: Latin letters and spaces only — a product decision, narrower than the
 *  backend's `^[\p{L}\s]+$`. The field hint must say so before a student types. */
export const NAME_REGEX = /^[A-Za-z\s]+$/;

export const attendanceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, { error: "Enter your full name (at least 3 characters)." })
    .max(100, { error: "Name must be 100 characters or fewer." })
    .regex(NAME_REGEX, {
      // Names the script explicitly — "letters only" would leave a student who
      // typed their name in Bengali with no idea what is wrong with it.
      error:
        "ইংরেজি অক্ষরে নাম লিখুন (English letters only) — সংখ্যা বা চিহ্ন ছাড়া।",
    }),
  phone: z
    .string()
    .trim()
    .regex(PHONE_REGEX, {
      error: "Enter a Bangladeshi mobile number, for example 01711000000.",
    }),
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
  name: "ইংরেজি অক্ষরে নাম লিখুন (English letters only), কমপক্ষে ৩ অক্ষর।",
  phone: "Enter a Bangladeshi mobile number, for example 01711000000.",
  email: "Enter a valid email address.",
  discordUsername:
    "Use the name under the @ on your Discord profile — lowercase letters, digits, _ or . only.",
};
