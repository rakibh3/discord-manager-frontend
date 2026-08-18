import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

/** The window gate must never close the form because something broke: every
 *  failure mode is pinned to `null`, which the homepage renders as the form. */

process.env.API_BASE_URL = "http://backend.test/api";

// `server-only` throws unless the bundler resolves its server condition, which
// the test runner does not do. The real guarantee is the Next build.
mock.module("server-only", () => ({}));

mock.module("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));

mock.module("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { getAttendanceWindow } = await import("@/lib/attendance-window");

type AttendanceWindow = NonNullable<
  Awaited<ReturnType<typeof getAttendanceWindow>>
>;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const openWindow: AttendanceWindow = {
  isOpen: true,
  date: "2026-08-18",
  openTime: "18:00",
  closeTime: "23:59",
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  enabled: true,
  timezone: "Asia/Dhaka",
  nextOpenAt: null,
  closesAt: "2026-08-18T17:59:00.000Z",
};

const originalFetch = globalThis.fetch;
let requests: { url: string; authorization: string | null }[];

beforeEach(() => {
  requests = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubFetch(respond: () => Response | Promise<Response>) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    requests.push({
      url: String(input),
      authorization: headers.get("Authorization"),
    });
    return respond();
  }) as typeof fetch;
}

describe("getAttendanceWindow", () => {
  test("returns the window when the backend serves one", async () => {
    stubFetch(() => json(200, { success: true, statusCode: 200, data: openWindow }));

    const result = await getAttendanceWindow();

    expect(result).toEqual(openWindow);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("http://backend.test/api/attendance/window");
  });

  test("sends no Authorization header — students have no credential", async () => {
    stubFetch(() => json(200, { success: true, statusCode: 200, data: openWindow }));

    await getAttendanceWindow();

    expect(requests[0].authorization).toBeNull();
  });

  test("carries a closed window through unchanged", async () => {
    const closed = { ...openWindow, isOpen: false, closesAt: null };
    stubFetch(() => json(200, { success: true, statusCode: 200, data: closed }));

    expect(await getAttendanceWindow()).toEqual(closed);
  });

  // ── Fail-open: every one of these must render the form ────────────────────

  test("fails open when the route does not exist yet (the state today)", async () => {
    stubFetch(() =>
      json(404, {
        success: false,
        message: "API Not Found!",
        path: "/api/attendance/window",
      }),
    );

    expect(await getAttendanceWindow()).toBeNull();
  });

  test("fails open when the backend is down", async () => {
    stubFetch(() => json(503, { success: false, message: "Service Unavailable" }));

    expect(await getAttendanceWindow()).toBeNull();
  });

  test("fails open when the backend is unreachable", async () => {
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });

    expect(await getAttendanceWindow()).toBeNull();
  });

  test("fails open on a non-JSON response", async () => {
    stubFetch(
      () => new Response("<html>502 Bad Gateway</html>", { status: 200 }),
    );

    expect(await getAttendanceWindow()).toBeNull();
  });

  /** A payload missing `isOpen` would coerce to `false` and lock everyone out,
   *  so a half-shaped response counts as no answer rather than as "closed". */
  test("fails open on a payload missing isOpen rather than reading it as closed", async () => {
    stubFetch(() =>
      json(200, {
        success: true,
        statusCode: 200,
        data: { openTime: "18:00", closeTime: "23:59", daysOfWeek: [0] },
      }),
    );

    expect(await getAttendanceWindow()).toBeNull();
  });

  test("fails open when data is null", async () => {
    stubFetch(() => json(200, { success: true, statusCode: 200, data: null }));

    expect(await getAttendanceWindow()).toBeNull();
  });
});
