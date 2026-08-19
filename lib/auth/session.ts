import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { TokenPair } from "@/lib/api/types";

/** Session cookies written by Next, not the backend: the backend's own pair is
 *  `secure:false` + `sameSite:'none'`, which browsers reject outright. */

export const ACCESS_COOKIE = "dm_access";
export const REFRESH_COOKIE = "dm_refresh";

/** Seven days, not thirty: the refresh token's database row is hardcoded to 7
 *  days in `auth.service.ts`, and the row is what actually governs. */
const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7;

/** The route handler that clears the cookies and then lands on `/login-admin`.
 *  Server Components must redirect *here*, never straight at the login page:
 *  they cannot write cookies, so `proxy.ts` would still see a session and bounce
 *  them back to `/dashboard` — a redirect loop that reads as an endless refresh. */
export const SESSION_EXPIRED_PATH = "/api/auth/session-expired";

const cookieOptions = () =>
  ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SEVEN_DAYS_IN_SECONDS,
  }) as const;

/** ⚠️ Server Actions and Route Handlers only — `cookies().set()` throws during a
 *  Server Component render. */
export async function writeSession({
  accessToken,
  refreshToken,
}: TokenPair): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, accessToken, cookieOptions());
  jar.set(REFRESH_COOKIE, refreshToken, cookieOptions());
}

/** Same write restriction as `writeSession`. */
export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

/** Reads are permitted everywhere, unlike writes. */
export async function readSession(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const jar = await cookies();
  return {
    accessToken: jar.get(ACCESS_COOKIE)?.value ?? null,
    refreshToken: jar.get(REFRESH_COOKIE)?.value ?? null,
  };
}

/** The authoritative auth check and DAL entry point: called in the dashboard
 *  layout and in every authenticated data-access function. `cache()` dedupes it. */
export const requireSession = cache(
  async (): Promise<{ accessToken: string; refreshToken: string | null }> => {
    const session = await readSession();
    if (!session.accessToken) redirect("/login-admin");
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };
  },
);
