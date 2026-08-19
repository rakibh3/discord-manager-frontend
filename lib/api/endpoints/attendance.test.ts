import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

process.env.API_BASE_URL = "http://backend.test/api";

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

const {
  getAttendanceWindow,
  verifyDiscordUsername,
  verifyEmail,
  submitAttendance,
} = await import("@/lib/api/endpoints/attendance");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type Call = { url: string; method: string; body?: string; authorization: string | null };

let calls: Call[];
const originalFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function install(handler: (call: Call) => Response) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const call: Call = {
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
      authorization: headers.get("authorization"),
    };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
}

describe("attendance public endpoints", () => {
  test("getAttendanceWindow calls /attendance/window anonymously", async () => {
    const mockWindow = {
      isOpen: true,
      date: "2026-08-18",
      openTime: "18:00",
      closeTime: "23:59",
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      enabled: true,
      timezone: "Asia/Dhaka" as const,
      nextOpenAt: "2026-08-19T12:00:00.000Z",
      closesAt: "2026-08-18T17:59:00.000Z",
    };

    install(() => json(200, { success: true, statusCode: 200, data: mockWindow }));

    const res = await getAttendanceWindow();

    expect(res).toEqual(mockWindow);
    expect(calls[0].url).toBe("http://backend.test/api/attendance/window");
    expect(calls[0].authorization).toBeNull();
  });

  test("verifyDiscordUsername calls /attendance/verify-user anonymously", async () => {
    const mockVerify = {
      verified: true,
      alreadySubmitted: false,
      attendanceDate: "2026-08-18",
      member: {
        id: "m1",
        discordUserId: "u1",
        discordUsername: "rakib_dev",
        displayName: "Rakib",
        avatarUrl: "https://cdn.discordapp.com/avatars/1.png",
      },
    };

    install(() => json(200, { success: true, statusCode: 200, data: mockVerify }));

    const res = await verifyDiscordUsername("rakib_dev");

    expect(res).toEqual(mockVerify);
    expect(calls[0].url).toBe("http://backend.test/api/attendance/verify-user?username=rakib_dev");
    expect(calls[0].authorization).toBeNull();
  });

  test("verifyEmail calls /attendance/verify-email anonymously", async () => {
    const mockVerify = {
      verified: true,
      attendanceDate: "2026-08-18",
      emailVerificationRequired: true,
    };

    install(() => json(200, { success: true, statusCode: 200, data: mockVerify }));

    const res = await verifyEmail("rakib@example.com");

    expect(res).toEqual(mockVerify);
    expect(calls[0].url).toBe("http://backend.test/api/attendance/verify-email?email=rakib%40example.com");
    expect(calls[0].authorization).toBeNull();
  });

  test("submitAttendance posts to /attendance/submit anonymously", async () => {
    const mockSubmitResult = {
      attendanceDate: "2026-08-18",
      submittedAt: "2026-08-18T14:00:00.000Z",
      member: {
        id: "m1",
        discordUserId: "u1",
        discordUsername: "rakib_dev",
        displayName: "Rakib",
        avatarUrl: null,
      },
    };

    install(() => json(201, { success: true, statusCode: 201, data: mockSubmitResult }));

    const res = await submitAttendance({
      name: "Rakibul Hasan",
      phone: "01711000000",
      email: "rakib@example.com",
      discordUsername: "rakib_dev",
    });

    expect(res).toEqual(mockSubmitResult);
    expect(calls[0].url).toBe("http://backend.test/api/attendance/submit");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].authorization).toBeNull();
    expect(JSON.parse(calls[0].body!)).toEqual({
      name: "Rakibul Hasan",
      phone: "01711000000",
      email: "rakib@example.com",
      discordUsername: "rakib_dev",
    });
  });
});
