import "server-only";

import { cache } from "react";

import { api } from "@/lib/api/client";
import type { AdminUser, AdminUserWithProfile } from "@/lib/api/types";

/** `GET /api/users/me` — the signed-in admin, without password or profile. Every
 *  request bumps `lastActiveAt`, so it is memoized per render pass, never cached. */
export const getCurrentAdmin = cache((): Promise<AdminUser> =>
  api<AdminUser>("/users/me"),
);

export type ProfileUpdate = {
  name?: string;
  email?: string;
  profilePhoto?: string;
  bio?: string;
};

/** `PUT /api/users/my-profile`. Blank fields must be omitted, not sent empty.
 *  404 means the admin has no `profiles` row; 409 means the email is taken. */
export function updateMyProfile(
  payload: ProfileUpdate,
): Promise<AdminUserWithProfile> {
  return api<AdminUserWithProfile>("/users/my-profile", {
    method: "PUT",
    body: payload,
  });
}
