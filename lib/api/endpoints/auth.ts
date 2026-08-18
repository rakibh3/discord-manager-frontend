import "server-only";

import { apiRequest } from "@/lib/api/client";
import type { TokenPair } from "@/lib/api/types";

/** `POST /api/auth/login`. The usable token pair is in the response body; the
 *  backend's own cookies are unusable. Callers must collapse 401 and 404 into one. */
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

/** `POST /api/auth/logout` — deletes the DB row and always answers 200. We send
 *  our own refresh token by header; best-effort, callers clear cookies regardless. */
export async function logout(refreshToken: string | null): Promise<void> {
  await apiRequest("/auth/logout", {
    method: "POST",
    anonymous: true,
    headers: refreshToken ? { Cookie: `refreshToken=${refreshToken}` } : {},
  });
}

/** `POST /api/auth/refresh-token` is deliberately not exported: it rotates the
 *  pair, so it is only reached through `refreshTokens()` or `proxy.ts`. */
