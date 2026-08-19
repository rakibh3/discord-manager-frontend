import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { api, ApiError } from "@/lib/api/client";
import type { AdminUser, AdminUserWithProfile } from "@/lib/api/types";
import { SESSION_EXPIRED_PATH } from "@/lib/auth/session";

/** `GET /api/users/me` — the signed-in admin, without password or profile. Every
 *  request bumps `lastActiveAt`, so it is memoized per render pass, never cached.
 *  If the user record no longer exists on the backend (404), redirects to login. */
export const getCurrentAdmin = cache(async (): Promise<AdminUser> => {
  try {
    return await api<AdminUser>("/users/me");
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 401 || error.isAuthExpired)
    ) {
      // Through the clearing route, not `/login-admin` directly: the stale
      // cookies are still set here and `proxy.ts` would bounce us back.
      redirect(SESSION_EXPIRED_PATH);
    }
    throw error;
  }
});

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
