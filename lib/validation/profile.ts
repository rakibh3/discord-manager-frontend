import { z } from "zod";

/**
 * Mirrors the backend's Zod rules for `PUT /users/my-profile` exactly
 * (`API_INTEGRATION.md` §8.2). Every field is optional.
 *
 * Blank strings are normalized to `undefined` rather than validated, because
 * the action **omits** empty fields from the request entirely — sending
 * `profilePhoto: ""` would fail the URL rule for a field the admin simply left
 * alone. Deliberately clearing a field is not something this endpoint supports.
 */
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const profileSchema = z.object({
  name: z.preprocess(
    blankToUndefined,
    z
      .string()
      .min(2, { error: "Name must be at least 2 characters." })
      .max(100, { error: "Name must be 100 characters or fewer." })
      .optional(),
  ),
  email: z.preprocess(
    blankToUndefined,
    z.email({ error: "Enter a valid email address." }).optional(),
  ),
  profilePhoto: z.preprocess(
    blankToUndefined,
    z
      .url({ error: "Enter a full image URL, starting with https://" })
      .optional(),
  ),
  bio: z.preprocess(
    blankToUndefined,
    z
      .string()
      .max(500, { error: "Bio must be 500 characters or fewer." })
      .optional(),
  ),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const BIO_MAX_LENGTH = 500;

/** Field copy, used in place of the backend's Title Cased Zod messages. */
export const PROFILE_FIELD_COPY: Record<string, string> = {
  name: "Name must be between 2 and 100 characters.",
  email: "Enter a valid email address.",
  profilePhoto: "Enter a full image URL, starting with https://",
  bio: "Bio must be 500 characters or fewer.",
};
