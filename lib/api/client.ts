import "server-only";

import { redirect } from "next/navigation";

import { ApiError, toApiError, toNetworkError } from "@/lib/api/errors";
import type { ApiResponse } from "@/lib/api/types";
import {
  readSession,
  requireSession,
  SESSION_EXPIRED_PATH,
  writeSession,
} from "@/lib/auth/session";

/** The server-only fetch layer for the admin API: the token stays in an httpOnly
 *  cookie and refresh-and-retry lives here. The attendance form is the exception. */

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

/** Arrays are sent comma-joined (`daysOfWeek=0,1,2`), which is the form every
 *  list-shaped query parameter takes on this API. */
export type QueryValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | readonly (string | number)[];

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
    if (Array.isArray(value)) {
      // An empty array is "no filter", not "match nothing" — sending `key=`
      // would be a 400 rather than the omission the caller meant.
      if (value.length === 0) continue;
      url.searchParams.set(key, value.join(","));
      continue;
    }
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/** Returns the full envelope so paginated callers can read `meta`. An expired
 *  token — which arrives as HTTP 500, not 401 — triggers one refresh and a replay. */
export async function apiRequest<T>(
  path: string,
  { body, query, anonymous, headers, ...init }: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const url = buildUrl(path, query);

  const send = async (accessToken: string | null): Promise<Response> => {
    const isFormData =
      typeof FormData !== "undefined" && body instanceof FormData;
    try {
      return await fetch(url, {
        ...init,
        // Next 16 leaves fetch uncached by default, which is what dashboard
        // data wants. An explicit option can still override per call.
        cache: init.cache ?? "no-store",
        headers: {
          ...(body !== undefined && !isFormData
            ? { "Content-Type": "application/json" }
            : {}),
          // ⚠️ Bare token — NO "Bearer " prefix. `auth.ts` hands the raw header
          // value to `jwt.verify`, so a scheme prefix is "jwt malformed" → 500.
          ...(accessToken ? { Authorization: accessToken } : {}),
          ...headers,
        },
        body:
          body !== undefined
            ? isFormData
              ? body
              : JSON.stringify(body)
            : undefined,
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
    // Cookies cannot be cleared from here — a Server Component render throws on
    // the write — so the clear happens in the route handler this lands on.
    if (!refreshed) redirect(SESSION_EXPIRED_PATH);

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

/** Refresh rotates the pair, so two concurrent calls log the user out. One
 *  module-level in-flight promise serializes them. */
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
        // ⚠️ The endpoint reads `req.cookies.refreshToken`, not the body, so the
        // header is built by hand; the rotated pair comes back in the body.
        headers: { Cookie: `refreshToken=${refreshToken}` },
        cache: "no-store",
      });
      if (!response.ok) return null;

      const json = (await response.json()) as ApiResponse<{
        accessToken: string;
        refreshToken: string;
      }>;

      // `cookies().set()` throws during a Server Component render. Returning
      // null redirects to `/login-admin`; `proxy.ts` keeps that rare.
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

export { ApiError };
