import { z } from "zod";

import { DISCORD_USERNAME_REGEX, normalizeDiscordUsername } from "./attendance";

/** Shared registration validation, mirroring the backend's Zod rules. Not
 *  `server-only`: the public form runs these in the browser, and the server
 *  enforces them again. */

/** Reduces a Bangladeshi mobile number to the local `01XXXXXXXXX` form: drops
 *  spaces, dashes and parentheses, and folds a leading `+880` / `880` into
 *  `0`. Mirror of the backend's `normalizeBdPhone`. */
export function normalizeBdPhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, "").replace(/^\+?880/, "0");
}

export const BD_MOBILE_REGEX = /^01[3-9]\d{8}$/;

export const registrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Enter your full name." })
    .max(150, { error: "That name is too long — use at most 150 characters." }),
  // Trimmed and lowercased BEFORE the address check: an address pasted out of
  // a chat message brings a trailing space with it.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Enter a valid email address." })),
  phone: z
    .string()
    .transform(normalizeBdPhone)
    .refine((value) => BD_MOBILE_REGEX.test(value), {
      error: "Enter a valid Bangladeshi mobile number, for example 01712345678.",
    }),
  discordUsername: z
    .string()
    .transform(normalizeDiscordUsername)
    .refine((value) => DISCORD_USERNAME_REGEX.test(value), {
      error:
        "Use the name under the @ on your Discord profile — 2 to 32 characters, lowercase letters, digits, _ or . only, and no two dots in a row.",
    }),
});

export type RegistrationInput = z.input<typeof registrationSchema>;
export type RegistrationValues = z.output<typeof registrationSchema>;

/** Our own copy per field, replacing the backend's Title Cased Zod messages. */
export const REGISTRATION_FIELD_COPY: Record<keyof RegistrationInput, string> =
  {
    name: "Enter your full name.",
    email: "Enter a valid email address.",
    phone: "Enter a valid Bangladeshi mobile number, for example 01712345678.",
    discordUsername:
      "Use the name under the @ on your Discord profile — lowercase letters, digits, _ or . only.",
  };

export type RegistrationWindowFields = {
  openDate: string | null;
  openTime: string | null;
  closeDate: string | null;
  closeTime: string | null;
};

/** The window rules the backend enforces on the merged settings, checked here
 *  first so the admin reads them next to the fields. Returns the problem, or
 *  `null` when the window is acceptable.
 *
 *  `YYYY-MM-DD HH:mm` is fixed width, so the comparison is a plain string
 *  compare of Dhaka wall clocks — no `Date`, no browser timezone. */
export function validateRegistrationWindow(
  window: RegistrationWindowFields,
): string | null {
  const { openDate, openTime, closeDate, closeTime } = window;

  if ((openDate === null) !== (openTime === null)) {
    return "Set both the opening date and the opening time, or clear both.";
  }
  if ((closeDate === null) !== (closeTime === null)) {
    return "Set both the closing date and the closing time, or clear both.";
  }
  if (
    openDate !== null &&
    openTime !== null &&
    closeDate !== null &&
    closeTime !== null &&
    `${closeDate} ${closeTime}` <= `${openDate} ${openTime}`
  ) {
    return "Registration must close after it opens.";
  }

  return null;
}

/** The invite link, as the backend accepts it: a full `https:` address. An
 *  empty value means "no link". */
export function validateInviteUrl(raw: string): string | null {
  const value = raw.trim();
  if (value === "") return null;

  try {
    if (new URL(value).protocol === "https:") return null;
  } catch {
    // Falls through to the message below.
  }

  return "Enter a full https:// link, for example https://discord.gg/your-invite.";
}
