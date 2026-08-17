import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * Covers the two behaviours in the API client that are easy to get wrong and
 * expensive to discover in production:
 *
 *   1. An expired access token arrives as **HTTP 500** `"jwt expired"`, not
 *      401. It must trigger a refresh and a replay of the original request.
 *   2. Refresh **rotates** the token pair, so concurrent refreshes log the user
 *      out. Three simultaneous expiries must produce exactly one refresh call.
 */

process.env.API_BASE_URL = "http://backend.test/api";

// `server-only` throws unless the bundler resolves its server condition, which
// the test runner does not do. Stubbing it here does not weaken the guarantee —
// the real check is the Next build, asserted by task 10.2.
mock.module("server-only", () => ({}));

const cookieJar = new Map<string, string>();

// `cookies()` is async in Next 16. Writes are permitted here because these
// tests stand in for a Server Action / Route Handler, not a render.
mock.module("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
}));

mock.module("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { api } = await import("@/lib/api/client");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const expiredJwt = () => json(500, { success: false, message: "jwt expired" });

const okEnvelope = (data: unknown) =>
  json(200, { success: true, statusCode: 200, data });

const rotatedPair = () =>
  okEnvelope({ accessToken: "access-2", refreshToken: "refresh-2" });

type Call = { url: string; authorization: string | null };

let calls: Call[];
const originalFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
  cookieJar.clear();
  cookieJar.set("dm_access", "access-1");
  cookieJar.set("dm_refresh", "refresh-1");
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function install(handler: (call: Call) => Promise<Response> | Response) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const call: Call = { url, authorization: headers.get("authorization") };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
}

describe("expired access token", () => {
  test("refreshes once and replays the original request", async () => {
    let attempts = 0;

    install(async (call) => {
      if (call.url.endsWith("/auth/refresh-token")) return rotatedPair();
      attempts += 1;
      return attempts === 1 ? expiredJwt() : okEnvelope({ id: "user-1" });
    });

    const result = await api<{ id: string }>("/users/me");

    expect(result).toEqual({ id: "user-1" });
    expect(calls.map((call) => call.url)).toEqual([
      "http://backend.test/api/users/me",
      "http://backend.test/api/auth/refresh-token",
      "http://backend.test/api/users/me",
    ]);

    // Bare token, no "Bearer " prefix — a prefix is "jwt malformed" → 500.
    expect(calls[0].authorization).toBe("access-1");
    // The replay carries the rotated token, and the jar was updated.
    expect(calls[2].authorization).toBe("access-2");
    expect(cookieJar.get("dm_access")).toBe("access-2");
    expect(cookieJar.get("dm_refresh")).toBe("refresh-2");
  });

  test("a 500 with any other message is not treated as expiry", async () => {
    install(async () => json(500, { success: false, message: "boom" }));

    await expect(api("/users/me")).rejects.toThrow("boom");
    expect(
      calls.filter((call) => call.url.endsWith("/auth/refresh-token")),
    ).toHaveLength(0);
  });

  test("a rejected refresh clears the session and redirects to /login", async () => {
    install(async (call) =>
      call.url.endsWith("/auth/refresh-token")
        ? json(401, { success: false, message: "Invalid or expired refresh token" })
        : expiredJwt(),
    );

    await expect(api("/users/me")).rejects.toThrow("REDIRECT:/login");
    expect(cookieJar.has("dm_access")).toBe(false);
    expect(cookieJar.has("dm_refresh")).toBe(false);
  });
});

describe("single-flight refresh", () => {
  test("three concurrent expiries produce exactly one refresh call", async () => {
    const seen = new Set<string>();

    install(async (call) => {
      if (call.url.endsWith("/auth/refresh-token")) {
        // A real refresh is a network round trip; the delay is what would let
        // a second one slip through if the in-flight promise were missing.
        await new Promise((resolve) => setTimeout(resolve, 10));
        return rotatedPair();
      }
      // Expire each distinct path once, then succeed.
      if (!seen.has(call.url)) {
        seen.add(call.url);
        return expiredJwt();
      }
      return okEnvelope({ path: call.url });
    });

    await Promise.all([
      api("/users/me"),
      api("/discord/sync/status"),
      api("/schedule/daily-update"),
    ]);

    const refreshes = calls.filter((call) =>
      call.url.endsWith("/auth/refresh-token"),
    );
    expect(refreshes).toHaveLength(1);

    // Every replay used the rotated token, not the stale one.
    const replays = calls.filter(
      (call) => !call.url.endsWith("/auth/refresh-token"),
    );
    expect(replays).toHaveLength(6);
    expect(replays.slice(3).every((call) => call.authorization === "access-2")).toBe(
      true,
    );
  });
});
