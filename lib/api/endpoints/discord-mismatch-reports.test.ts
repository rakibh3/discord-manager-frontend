import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

process.env.API_BASE_URL = "http://backend.test/api";

mock.module("server-only", () => ({}));

mock.module("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "test-token" }),
    set: () => {},
    delete: () => {},
  }),
}));

mock.module("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

mock.module("@/lib/auth/session", () => ({
  requireSession: async () => ({
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
  }),
  readSession: async () => ({
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
  }),
  writeSession: async () => {},
  clearSession: async () => {},
}));

const {
  listDiscordMismatchReports,
  actOnDiscordMismatchReport,
} = await import(
  "@/lib/api/endpoints/discord-mismatch-reports"
);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type Call = {
  url: string;
  method: string;
  body?: unknown;
  authorization: string | null;
};

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
      body: init?.body,
      authorization: headers.get("Authorization"),
    };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
}

describe("discord-mismatch-reports endpoints", () => {
  test("listDiscordMismatchReports defaults to status=open", async () => {
    install(() =>
      json(200, {
        success: true,
        statusCode: 200,
        data: { items: [], total: 0 },
        meta: { page: 1, limit: 50, total: 0 },
      }),
    );

    const res = await listDiscordMismatchReports();

    expect(res.data).toEqual({ items: [], total: 0 });
    expect(res.meta?.total).toBe(0);
    expect(calls[0].url).toBe(
      "http://backend.test/api/roster/discord-mismatch-reports?status=open&page=1&limit=50",
    );
    expect(calls[0].authorization).toBe("mock-access-token");
  });

  test("listDiscordMismatchReports forwards search and date range", async () => {
    install(() =>
      json(200, {
        success: true,
        statusCode: 200,
        data: { items: [], total: 0 },
        meta: { page: 1, limit: 50, total: 0 },
      }),
    );

    await listDiscordMismatchReports({
      status: "reassigned",
      search: "rakib",
      dateFrom: "2026-08-01T00:00:00.000Z",
      dateTo: "2026-08-19T23:59:59.000Z",
      page: 2,
      limit: 25,
    });

    expect(calls[0].url).toBe(
      "http://backend.test/api/roster/discord-mismatch-reports?status=reassigned&search=rakib&dateFrom=2026-08-01T00%3A00%3A00.000Z&dateTo=2026-08-19T23%3A59%3A59.000Z&page=2&limit=25",
    );
  });

  test("actOnDiscordMismatchReport posts the action body", async () => {
    const mockResult = {
      id: "rep1",
      status: "reassigned" as const,
      reviewedByAdminId: "admin1",
      reviewedAt: "2026-08-19T14:30:00.000Z",
      rosterEntryId: "entry1",
    };

    install(() =>
      json(200, {
        success: true,
        statusCode: 200,
        message: "Report reassigned; the entry pairing has been updated",
        data: mockResult,
      }),
    );

    const res = await actOnDiscordMismatchReport("rep1", {
      action: "reassign",
    });

    expect(res).toEqual(mockResult);
    expect(calls[0].url).toBe(
      "http://backend.test/api/roster/discord-mismatch-reports/rep1/action",
    );
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toBe(JSON.stringify({ action: "reassign" }));
    expect(calls[0].authorization).toBe("mock-access-token");
  });

  test("actOnDiscordMismatchReport accepts a dismiss action", async () => {
    const mockResult = {
      id: "rep2",
      status: "dismissed" as const,
      reviewedByAdminId: "admin1",
      reviewedAt: "2026-08-19T14:35:00.000Z",
      rosterEntryId: "entry2",
    };

    install(() =>
      json(200, {
        success: true,
        statusCode: 200,
        data: mockResult,
      }),
    );

    const res = await actOnDiscordMismatchReport("rep2", {
      action: "dismiss",
    });

    expect(res.status).toBe("dismissed");
    expect(calls[0].body).toBe(JSON.stringify({ action: "dismiss" }));
  });
});
