import "server-only";

import { cache } from "react";

import { api } from "@/lib/api/client";
import type { AdminUser, AdminUserWithProfile } from "@/lib/api/types";

/**
 * `GET /api/users/me` — the signed-in admin. Password omitted, and **profile
 * not included** (only the update endpoint returns that).
 *
 * Every authenticated request bumps `lastActiveAt`, so this is never cacheable
 * across requests. `cache()` memoizes it for one render pass instead, so the
 * layout and the header share a single call.
 */
export const getCurrentAdmin = cache((): Promise<AdminUser> =>
  api<AdminUser>("/users/me"),
);

export type ProfileUpdate = {
  name?: string;
  email?: string;
  profilePhoto?: string;
  bio?: string;
};

/**
 * `PUT /api/users/my-profile`.
 *
 * `name`/`email` write the `users` row; `profilePhoto`/`bio` write the nested
 * `profiles` row. Blank fields must be **omitted**, not sent as empty strings —
 * an empty string fails the URL and length rules.
 *
 * 404 means the admin has no `profiles` row at all: the nested update raises
 * P2025. The seed creates one; an admin inserted by hand may not have it.
 * 409 means the email already belongs to another user.
 */
export function updateMyProfile(
  payload: ProfileUpdate,
): Promise<AdminUserWithProfile> {
  return api<AdminUserWithProfile>("/users/my-profile", {
    method: "PUT",
    body: payload,
  });
}
