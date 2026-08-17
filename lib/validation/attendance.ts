import { z } from "zod";

/**
 * Shared attendance validation. Mirrors the backend's Zod rules exactly.
 *
 * Not `server-only`: the form runs these in the browser before submitting, and
 * the backend re-runs every one of them on the write path. The client copy is
 * an affordance; the server is the enforcement point.
 */

/**
 * Official Discord username rule.
 *
 * 2–32 characters, lowercase `a-z`, digits, `_` and `.`, and no consecutive
 * dots. **A leading or trailing `_` or `.` is valid** — `.rabbil`, `itzazad_`
 * and `shahriarratul.` are all real handles.
 *
 * ⚠️ Do not tighten this. Verified against the live server, 115 of 2,189
 * members (5.3%) have a leading or trailing separator, and 59 of those accounts
 * were created *after* the Pomelo rollout — so these are not grandfathered
 * names, Discord still issues them. A stricter regex locks out roughly 1 in 19
 * students permanently, which is a direct violation of PRD Golden Rule 3.
 */
export const DISCORD_USERNAME_REGEX = /^(?!.*\.{2})[a-z0-9_.]{2,32}$/;

/**
 * Trim → strip leading `@` → lowercase.
 *
 * Students copy their handle from their profile, where it is displayed as
 * `@rakib_dev`, and Discord stores every username lowercased. This runs before
 * validation, not as the user types — rewriting the field under their cursor
 * moves the caret and is hostile on mobile.
 */
export function normalizeDiscordUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Bangladeshi mobile: `01711000000`, `+8801711000000` or `8801711000000`. */
export const PHONE_REGEX = /^(?:\+?880|0)1[3-9]\d{8}$/;

/**
 * Names: Latin letters and spaces only.
 *
 * A product decision, not a technical limit: students enter their name in
 * English, so Bengali script is rejected rather than accommodated. The rule is
 * therefore ASCII-range by design, which is narrower than the backend's
 * `^[\p{L}\s]+$` — a Bengali name that somehow reached the API would be
 * accepted there, but it cannot get through this form.
 *
 * Because the form's own copy is in Bengali, the field hint has to say
 * "English letters" *before* a student types anything. Discovering this rule
 * from a validation error after writing your own name in your own script is a
 * bad way to find out. See the name field in `attendance-form.tsx`.
 *
 * Apostrophes and hyphens (`D'Souza`, `Abdur-Rahman`) are rejected, matching
 * the backend's existing "letters and spaces" rule. If those turn up in real
 * submissions, widen both sides together.
 */
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
});

export type AttendanceInput = z.input<typeof attendanceSchema>;
export type AttendanceValues = z.output<typeof attendanceSchema>;

/**
 * Our own copy for each field, used in place of the backend's Title Cased Zod
 * messages ("Enter A Valid Discord Username: 2-32 Characters …").
 */
export const ATTENDANCE_FIELD_COPY: Record<string, string> = {
  name: "ইংরেজি অক্ষরে নাম লিখুন (English letters only), কমপক্ষে ৩ অক্ষর।",
  phone: "Enter a Bangladeshi mobile number, for example 01711000000.",
  email: "Enter a valid email address.",
  discordUsername:
    "Use the name under the @ on your Discord profile — lowercase letters, digits, _ or . only.",
};
