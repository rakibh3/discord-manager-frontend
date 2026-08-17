import "server-only";

import { apiRequest } from "@/lib/api/client";
import type { TokenPair } from "@/lib/api/types";

/**
 * `POST /api/auth/login`.
 *
 * Anonymous by definition. The response also sets the backend's own
 * `accessToken`/`refreshToken` cookies — ignore them, they carry
 * `secure:false` + `sameSite:'none'` and browsers reject that combination. The
 * usable pair is in the response body.
 *
 * Failure modes: 400 Zod · 401 wrong password · 403 suspended or non-admin ·
 * **404 unknown email** (`findUniqueOrThrow`). 401 and 404 must be collapsed
 * into one generic message by the caller.
 */
export async function login(credentials: {
  email: string;
  password: string;
}): Promise<TokenPair> {
  const { data } = await apiRequest<TokenPair>("/auth/login", {
    method: "POST",
    anonymous: true,
    body: credentials,
  });
  return data;
}

/**
 * `POST /api/auth/logout`.
 *
 * Reads the backend's `refreshToken` cookie and deletes the DB row. Always
 * answers 200, even with no cookie. We send our own refresh token in a cookie
 * header because the backend's cookie never reached the browser.
 *
 * Best-effort: the caller clears local cookies regardless of the outcome.
 */
export async function logout(refreshToken: string | null): Promise<void> {
  await apiRequest("/auth/logout", {
    method: "POST",
    anonymous: true,
    headers: refreshToken ? { Cookie: `refreshToken=${refreshToken}` } : {},
  });
}

/**
 * `POST /api/auth/refresh-token` is deliberately **not** exported for page use.
 *
 * It rotates the pair — two concurrent calls delete each other's row and log
 * the user out — so it is only ever reached through the single-flight
 * `refreshTokens()` inside `lib/api/client.ts`, or the proactive path in
 * `proxy.ts`. Calling it from anywhere else would defeat that serialization.
 */
