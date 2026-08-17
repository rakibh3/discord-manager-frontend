"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { updateMyProfile } from "@/lib/api/endpoints/user";
import {
  PROFILE_FIELD_COPY,
  profileSchema,
} from "@/lib/validation/profile";

export type ProfileState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const FIELDS = ["name", "email", "profilePhoto", "bio"] as const;

export async function updateProfile(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = profileSchema.safeParse(
    Object.fromEntries(FIELDS.map((field) => [field, formData.get(field)])),
  );

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field) fieldErrors[field] ??= issue.message;
    }
    return { fieldErrors };
  }

  // Omit blanks entirely rather than sending empty strings — an empty string
  // fails the backend's URL and length rules for a field the admin never
  // touched, which would make saving a bio impossible without also setting a
  // photo URL.
  const payload = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined),
  );

  if (Object.keys(payload).length === 0) {
    return { error: "Change at least one field before saving." };
  }

  try {
    await updateMyProfile(payload);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    if (error.isValidation) {
      const fieldErrors: Record<string, string> = {};
      for (const [field, serverMessage] of Object.entries(error.fieldErrors())) {
        fieldErrors[field] = PROFILE_FIELD_COPY[field] ?? serverMessage;
      }
      return { fieldErrors };
    }

    // 409 is a Prisma P2002: the address belongs to another account. The
    // backend's own text for this reads "unknown field already exists!",
    // because `err.meta.target` is undefined under the driver adapter — so it
    // has to be replaced, not passed through.
    if (error.status === 409) {
      return {
        fieldErrors: {
          email: "That email address already belongs to another account.",
        },
      };
    }

    // 404 is not "you don't exist" — it is the nested `profiles` update raising
    // P2025 because this admin has no profile row. Seeded admins get one; one
    // inserted by hand may not.
    if (error.status === 404) {
      return {
        error:
          "This account has no profile record, so the photo and bio cannot be saved. Name and email can still be changed. Ask whoever provisioned the account to create the profile row (the seed script creates one automatically).",
      };
    }

    return { error: error.message };
  }

  // The header reads `/users/me` on every dashboard page, so a changed name or
  // email has to invalidate the whole segment, not just this route.
  revalidatePath("/dashboard", "layout");
  return { success: true };
}
