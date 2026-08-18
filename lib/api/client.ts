import "server-only";

import { redirect } from "next/navigation";

import { ApiError, toApiError, toNetworkError } from "@/lib/api/errors";
import type { ApiResponse } from "@/lib/api/types";
import {
  clearSession,
  readSession,
  requireSession,
  writeSession,
} from "@/lib/auth/session";

/**
 * The server-only fetch layer for the admin API.
 *
 * Everything authenticated goes browser → Next server → backend. The access
 * token stays in an httpOnly cookie, refresh-and-retry lives here rather than
 * in every component, and the hot path has no CORS preflight. `server-only`
 * makes an accidental client import a build failure rather than a token leak.
 *
 * The public attendance form is the deliberate exception — it calls the backend
 * browser-direct and does not use this module.
 */

const BASE_URL = process.env.API_BASE_URL;

function baseUrl(): string {
  if (!BASE_URL) {
    throw new Error(
      "API_BASE_URL is not set. Copy .env.example to .env.local and point it at the backend (e.g. http://localhost:8000/api).",
    );
  }
  return BASE_URL.replace(/\/$/, "");
}

/** Exposed so error copy can name the URL it failed to reach. */
export function apiBaseUrlForDisplay(): string {
  return BASE_URL ?? "(unset)";
}

export type QueryValue = string | number | boolean | undefined | null;

export type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Skip auth entirely — login, refresh, and the public attendance routes. */
  anonymous?: boolean;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(baseUrl() + path);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * Returns the **full envelope**, so paginated callers can read `meta`.
 *
 * On an expired access token — which arrives as HTTP 500, not 401 — this
 * refreshes once and replays the original request. Any other failure throws an
 * `ApiError`.
 */
export async function apiRequest<T>(
  path: string,
  { body, query, anonymous, headers, ...init }: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const url = buildUrl(path, query);

  const send = async (accessToken: string | null): Promise<Response> => {
    try {
      return await fetch(url, {
        ...init,
        // Next 16 leaves fetch uncached by default, which is what dashboard
        // data wants. An explicit option can still override per call.
        cache: init.cache ?? "no-store",
        headers: {
          ...(body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
          // ⚠️ Bare token — NO "Bearer " prefix. `auth.ts` hands the raw header
          // value to `jwt.verify`, so a scheme prefix is "jwt malformed" → 500.
          ...(accessToken ? { Authorization: accessToken } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (cause) {
      throw toNetworkError(cause);
    }
  };

  const accessToken = anonymous ? null : (await requireSession()).accessToken;

  let response = await send(accessToken);

  if (!response.ok && !anonymous) {
    const error = await toApiError(response);

    if (!error.isAuthExpired) throw error;

    const refreshed = await refreshTokens();
    if (!refreshed) {
      await clearSessionQuietly();
      redirect("/login-admin");
    }

    response = await send(refreshed.accessToken);
  }

  if (!response.ok) throw await toApiError(response);

  return (await response.json()) as ApiResponse<T>;
}

/** The common case, where only `data` matters. */
export async function api<T>(
  path: string,
  options?: RequestOptions,
): Promise<T> {
  return (await apiRequest<T>(path, options)).data;
}

// ── Refresh, single-flight ───────────────────────────────────────────────────

/**
 * Refresh **rotates**: the old row is deleted in the same transaction that
 * creates the new one. Two concurrent refreshes mean one wins and the other
 * 401s, logging the user out. One module-level in-flight promise serializes
 * them, which is enough to cover a burst inside a single render pass.
 */
let inFlightRefresh: Promise<{
  accessToken: string;
  refreshToken: string;
} | null> | null = null;

function refreshTokens(): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  inFlightRefresh ??= (async () => {
    try {
      const { refreshToken } = await readSession();
      if (!refreshToken) return null;

      const response = await fetch(`${baseUrl()}/auth/refresh-token`, {
        method: "POST",
        // ⚠️ The endpoint reads `req.cookies.refreshToken`, not the body, so
        // the header has to be built by hand. The rotated pair comes back in
        // the response body, so there is no `Set-Cookie` to parse.
        headers: { Cookie: `refreshToken=${refreshToken}` },
        cache: "no-store",
      });
      if (!response.ok) return null;

      const json = (await response.json()) as ApiResponse<{
        accessToken: string;
        refreshToken: string;
      }>;

      // Persisting the rotated pair is what fails during a Server Component
      // render — `cookies().set()` throws there. Returning null makes the
      // caller redirect to `/login-admin`, which is correct but user-visible;
      // the proactive refresh in `proxy.ts` is what keeps it rare.
      try {
        await writeSession(json.data);
      } catch {
        return null;
      }

      return json.data;
    } catch {
      return null;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

/** Clearing cookies is also a write, and fails mid-render for the same reason. */
async function clearSessionQuietly(): Promise<void> {
  try {
    await clearSession();
  } catch {
    // Server Component render — `proxy.ts` will bounce the next request.
  }
}

export { ApiError };
