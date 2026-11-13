import { z } from "zod";

import { DISCORD_USERNAME_REGEX, normalizeDiscordUsername } from "./attendance";

/** Bangladeshi mobile: `01711000000`, `+8801711000000` or `8801711000000`.
 *  Kept local to the admin-side roster entry validation — the public attendance
 *  form no longer collects phone numbers (those come from the matched roster
 *  entry on the server). */
const PHONE_REGEX = /^(?:\+?880|0)1[3-9]\d{8}$/;

/** Validation for editing a single roster entry. */
export const rosterEntryEditSchema = z
  .object({
    name: z.string().trim().min(1, { error: "Name is required." }).optional(),
    email: z.string().trim().email({ error: "Enter a valid email address." }).optional(),
    phone: z
      .union([
        z.string().trim().regex(PHONE_REGEX, {
          error: "Enter a valid Bangladeshi mobile number (e.g. 01711000000), or leave blank.",
        }),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .transform((val) => (val === "" ? null : val)),
    /** The Discord username the student is paired with. Normalized the same
     *  way the public form does it; `""` or `null` clears the pairing. */
    discordUsername: z
      .union([
        z
          .string()
          .transform(normalizeDiscordUsername)
          .refine((value) => value === "" || DISCORD_USERNAME_REGEX.test(value), {
            error:
              "Use the name under the @ on their Discord profile — 2 to 32 characters, lowercase letters, digits, _ or . only. Leave blank to clear it.",
          }),
        z.null(),
      ])
      .optional()
      .transform((val) => (val === "" ? null : val)),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.phone !== undefined ||
      data.discordUsername !== undefined,
    {
      error:
        "At least one field (name, email, phone, or Discord username) must be provided to update.",
    },
  );

export type RosterEntryEditInput = z.input<typeof rosterEntryEditSchema>;
export type RosterEntryEditValues = z.output<typeof rosterEntryEditSchema>;

/** Validation for roster settings. */
export const rosterSettingsSchema = z.object({
  enforceEmail: z.boolean(),
});

export type RosterSettingsInput = z.input<typeof rosterSettingsSchema>;
