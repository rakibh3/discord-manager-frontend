import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { TokenPair } from "@/lib/api/types";

/**
 * Session cookies, written by Next rather than by the backend.
 *
 * The backend sets its own `accessToken`/`refreshToken` cookies with
 * `secure: false` combined with `sameSite: 'none'` — a combination browsers
 * reject outright, so cross-origin cookie auth is simply not available. Both
 * login and refresh also return the pair in the response **body**, so we read
 * them from there and set cookies we control.
 */

export const ACCESS_COOKIE = "dm_access";
export const REFRESH_COOKIE = "dm_refresh";

/**
 * Seven days, not thirty.
 *
 * The refresh token's JWT `exp` follows `JWT_REFRESH_EXPIRES_IN` (30d in dev),
 * but its **database row** is hardcoded to 7 days in `auth.service.ts` and the
 * row is what actually governs — a 30-day JWT whose row has expired is rejected
 * with 401. A longer cookie would just leave users holding a credential the
 * backend already refuses.
 */
const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7;

const cookieOptions = () =>
  ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SEVEN_DAYS_IN_SECONDS,
  }) as const;

/**
 * ⚠️ Only callable from a Server Action or a Route Handler. `cookies().set()`
 * throws during a Server Component render; `lib/api/client.ts` catches that and
 * redirects to `/login` rather than letting it surface.
 */
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

/**
 * The authoritative auth check — the Data Access Layer entry point.
 *
 * `proxy.ts` only does an optimistic cookie-presence redirect, and the Next
 * docs are explicit that a layout check is not sufficient either: layouts do
 * not re-render on client-side navigation and do not control whether their
 * segments render. So this is called in the dashboard layout *and* inside every
 * authenticated data-access function, which puts the guarantee at the data
 * source rather than at the chrome.
 *
 * `cache()` memoizes it for one render pass, so the layout plus three data
 * functions still read the cookie jar exactly once.
 */
export const requireSession = cache(
  async (): Promise<{ accessToken: string; refreshToken: string | null }> => {
    const session = await readSession();
    if (!session.accessToken) redirect("/login");
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };
  },
);
