import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

process.env.API_BASE_URL = "http://backend.test/api";

mock.module("server-only", () => ({}));

const cookieJar = new Map<string, string>();

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

const {
  getDailyStatusCounts,
  getDailyStatusPage,
  getDailyStatusMember,
  dailyStatusExportPath,
} = await import("@/lib/api/endpoints/daily-status");

const { datePeriod } = await import("@/lib/period");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type Call = { url: string; method: string; authorization: string | null };

let calls: Call[];
const originalFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
  cookieJar.clear();
  cookieJar.set("dm_access", "test-token");
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
      authorization: headers.get("authorization"),
    };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
}

describe("daily-status endpoints", () => {
  test("getDailyStatusCounts calls /daily-status/counts with date query", async () => {
    const mockCounts = {
      date: "2026-08-18",
      totalMembers: 100,
      attendanceSubmitted: 80,
      dailyUpdateSubmitted: 70,
      bothComplete: 65,
      missingUpdateOnly: 15,
      missingAttendanceOnly: 5,
      missingBoth: 15,
    };

    install(() => json(200, { success: true, statusCode: 200, data: mockCounts }));

    const data = await getDailyStatusCounts(datePeriod("2026-08-18"));

    expect(data).toEqual(mockCounts);
    expect(calls[0].url).toBe("http://backend.test/api/daily-status/counts?date=2026-08-18");
    expect(calls[0].authorization).toBe("test-token");
  });

  test("getDailyStatusPage calls /daily-status with pagination, status and search queries", async () => {
    const mockMembers = [
      {
        memberId: "m1",
        discordUserId: "u1",
        discordUsername: "rakib_dev",
        displayName: "Rakib",
        name: "Rakib Hasan",
        phone: "01711000000",
        email: "rakib@example.com",
        hasAttendance: true,
        hasDailyUpdate: false,
        status: "MISSING_UPDATE" as const,
        attendanceSubmittedAt: "2026-08-18T14:00:00.000Z",
      },
    ];

    install(() =>
      json(200, {
        success: true,
        statusCode: 200,
        meta: { page: 1, limit: 50, total: 1 },
        data: mockMembers,
      }),
    );

    const res = await getDailyStatusPage(datePeriod("2026-08-18"), {
      page: 1,
      limit: 50,
      status: "MISSING_UPDATE",
      search: "rakib",
    });

    expect(res.data).toEqual(mockMembers);
    expect(res.meta?.total).toBe(1);
    expect(calls[0].url).toContain("/daily-status?");
    expect(calls[0].url).toContain("date=2026-08-18");
    expect(calls[0].url).toContain("status=MISSING_UPDATE");
    expect(calls[0].url).toContain("search=rakib");
  });

  test("getDailyStatusMember calls /daily-status/members/:memberId with date query", async () => {
    const mockDetail = {
      memberId: "m1",
      discordUserId: "u1",
      discordUsername: "rakib_dev",
      displayName: "Rakib",
      name: "Rakib Hasan",
      phone: "01711000000",
      email: "rakib@example.com",
      hasAttendance: true,
      hasDailyUpdate: true,
      status: "COMPLETE" as const,
      attendanceSubmittedAt: "2026-08-18T14:00:00.000Z",
      messages: [
        {
          id: "msg1",
          content: "Done task",
          postedAt: "2026-08-18T18:00:00.000Z",
        },
      ],
    };

    install(() => json(200, { success: true, statusCode: 200, data: mockDetail }));

    const data = await getDailyStatusMember("m1", datePeriod("2026-08-18"));

    expect(data).toEqual(mockDetail);
    expect(calls[0].url).toBe("http://backend.test/api/daily-status/members/m1?date=2026-08-18");
  });

  test("range mode sends from/to and daysOfWeek instead of date", async () => {
    install(() =>
      json(200, {
        success: true,
        statusCode: 200,
        meta: { page: 1, limit: 50, total: 0 },
        data: [],
      }),
    );

    await getDailyStatusPage(
      {
        mode: "range",
        from: "2026-08-15",
        to: "2026-08-17",
        daysOfWeek: [0, 1, 2],
      },
      { minMissedBothDays: 2, sortBy: "missedBothDays", sortDir: "desc" },
    );

    const url = calls[0].url;
    // The two period forms are mutually exclusive on the wire: sending `date`
    // alongside `from`/`to` is a 400 naming the conflict.
    expect(url).not.toContain("date=");
    expect(url).toContain("from=2026-08-15");
    expect(url).toContain("to=2026-08-17");
    expect(url).toContain("daysOfWeek=0%2C1%2C2");
    expect(url).toContain("minMissedBothDays=2");
    expect(url).toContain("sortBy=missedBothDays");
  });

  test("guildId narrows a read to one server", async () => {
    install(() =>
      json(200, { success: true, statusCode: 200, data: { date: "2026-08-18" } }),
    );

    await getDailyStatusCounts(datePeriod("2026-08-18"), { guildId: "146" });

    expect(calls[0].url).toContain("guildId=146");
  });

  test("dailyStatusExportPath builds formatted query path", () => {
    const path = dailyStatusExportPath(datePeriod("2026-08-18"), {
      status: "MISSING_UPDATE",
      search: "rakib",
      format: "csv",
    });

    expect(path).toBe(
      "/daily-status/export?date=2026-08-18&format=csv&status=MISSING_UPDATE&search=rakib",
    );
  });

  test("dailyStatusExportPath carries the range and its server filter", () => {
    const path = dailyStatusExportPath(
      { mode: "range", from: "2026-08-15", to: "2026-08-17", daysOfWeek: [] },
      { guildId: "146", rangeStatus: "NONE", format: "csv" },
    );

    expect(path).toBe(
      "/daily-status/export?from=2026-08-15&to=2026-08-17&format=csv&guildId=146&rangeStatus=NONE",
    );
  });
});
