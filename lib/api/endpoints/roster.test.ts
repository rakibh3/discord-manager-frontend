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
  getRoster,
  importRoster,
  updateRosterEntry,
  deactivateRosterEntry,
  restoreRosterEntry,
  getRosterImports,
  getRosterSettings,
  patchRosterSettings,
} = await import("@/lib/api/endpoints/roster");

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

describe("roster endpoints", () => {
  test("getRoster calls /roster with query params", async () => {
    const mockList = [
      {
        id: "r1",
        name: "Rakibul Hasan",
        email: "rakib@example.com",
        phone: "01711000000",
        isActive: true,
        createdAt: "2026-08-19T00:00:00.000Z",
        updatedAt: "2026-08-19T00:00:00.000Z",
      },
    ];

    install(() =>
      json(200, {
        success: true,
        statusCode: 200,
        data: mockList,
        meta: { page: 1, limit: 50, total: 1 },
      }),
    );

    const res = await getRoster({ search: "rakib", status: "active", page: 1, limit: 50 });

    expect(res.data).toEqual(mockList);
    expect(res.meta?.total).toBe(1);
    expect(calls[0].url).toBe("http://backend.test/api/roster?status=active&search=rakib&page=1&limit=50");
    expect(calls[0].authorization).toBe("mock-access-token");
  });

  test("importRoster posts FormData to /roster/import", async () => {
    const mockImportResult = {
      importId: "imp1",
      fileName: "batch-11.xlsx",
      totalRows: 500,
      created: 412,
      updated: 75,
      skipped: 13,
      duplicates: 2,
      duplicateRowsCollapsed: 2,
      rejectedRows: [{ rowNumber: 44, reason: "Invalid email" }],
      duplicateAddresses: [{ email: "dup@example.com", rowNumbers: [12, 40] }],
      batchFailures: [],
    };

    install(() =>
      json(200, {
        success: true,
        statusCode: 200,
        data: mockImportResult,
      }),
    );

    const formData = new FormData();
    formData.append("file", new Blob(["fake-csv"]), "students.csv");

    const res = await importRoster(formData);

    expect(res).toEqual(mockImportResult);
    expect(calls[0].url).toBe("http://backend.test/api/roster/import");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].authorization).toBe("mock-access-token");
  });

  test("updateRosterEntry patches /roster/:id", async () => {
    const mockUpdated = {
      id: "r1",
      name: "Rakib Updated",
      email: "rakib@example.com",
      phone: "01711000000",
      isActive: true,
      createdAt: "2026-08-19T00:00:00.000Z",
      updatedAt: "2026-08-19T01:00:00.000Z",
    };

    install(() =>
      json(200, {
        success: true,
        statusCode: 200,
        data: mockUpdated,
      }),
    );

    const res = await updateRosterEntry("r1", { name: "Rakib Updated" });

    expect(res).toEqual(mockUpdated);
    expect(calls[0].url).toBe("http://backend.test/api/roster/r1");
    expect(calls[0].method).toBe("PATCH");
  });

  test("deactivateRosterEntry deletes /roster/:id", async () => {
    const mockDeactivated = {
      id: "r1",
      name: "Rakib",
      email: "rakib@example.com",
      phone: null,
      isActive: false,
      createdAt: "2026-08-19T00:00:00.000Z",
      updatedAt: "2026-08-19T01:00:00.000Z",
    };

    install(() =>
      json(200, {
        success: true,
        statusCode: 200,
        data: mockDeactivated,
      }),
    );

    const res = await deactivateRosterEntry("r1");

    expect(res.isActive).toBe(false);
    expect(calls[0].url).toBe("http://backend.test/api/roster/r1");
    expect(calls[0].method).toBe("DELETE");
  });

  test("restoreRosterEntry patches /roster/:id/restore", async () => {
    const mockRestored = {
      id: "r1",
      name: "Rakib",
      email: "rakib@example.com",
      phone: null,
      isActive: true,
      createdAt: "2026-08-19T00:00:00.000Z",
      updatedAt: "2026-08-19T02:00:00.000Z",
    };

    install(() =>
      json(200, {
        success: true,
        statusCode: 200,
        data: mockRestored,
      }),
    );

    const res = await restoreRosterEntry("r1");

    expect(res.isActive).toBe(true);
    expect(calls[0].url).toBe("http://backend.test/api/roster/r1/restore");
    expect(calls[0].method).toBe("PATCH");
  });

  test("getRosterImports calls /roster/imports", async () => {
    const mockImports = [
      {
        id: "imp1",
        fileName: "batch-11.xlsx",
        totalRows: 500,
        created: 412,
        updated: 75,
        skipped: 13,
        duplicates: 2,
        duplicateRowsCollapsed: 2,
        importedAt: "2026-08-19T00:00:00.000Z",
        importedBy: { id: "a1", name: "Admin", email: "admin@example.com" },
      },
    ];

    install(() =>
      json(200, {
        success: true,
        statusCode: 200,
        data: mockImports,
        meta: { page: 1, limit: 20, total: 1 },
      }),
    );

    const res = await getRosterImports({ page: 1, limit: 20 });

    expect(res.data).toEqual(mockImports);
    expect(calls[0].url).toBe("http://backend.test/api/roster/imports?page=1&limit=20");
  });

  test("getRosterSettings calls /roster/settings", async () => {
    const mockSettings = {
      enforceEmail: false,
      activeEntries: 2140,
      updatedAt: "2026-08-19T13:00:00.000Z",
      updatedBy: { id: "a1", name: "Admin", email: "admin@example.com" },
    };

    install(() =>
      json(200, {
        success: true,
        statusCode: 200,
        data: mockSettings,
      }),
    );

    const res = await getRosterSettings();

    expect(res).toEqual(mockSettings);
    expect(calls[0].url).toBe("http://backend.test/api/roster/settings");
  });

  test("patchRosterSettings patches /roster/settings", async () => {
    const mockSettings = {
      enforceEmail: true,
      activeEntries: 2140,
      updatedAt: "2026-08-19T13:05:00.000Z",
      updatedBy: { id: "a1", name: "Admin", email: "admin@example.com" },
    };

    install(() =>
      json(200, {
        success: true,
        statusCode: 200,
        data: mockSettings,
      }),
    );

    const res = await patchRosterSettings({ enforceEmail: true });

    expect(res).toEqual(mockSettings);
    expect(calls[0].url).toBe("http://backend.test/api/roster/settings");
    expect(calls[0].method).toBe("PATCH");
  });

  test("rosterStatusExportPath forwards daysOfWeek when set", async () => {
    const { rosterStatusExportPath } = await import("@/lib/api/endpoints/roster");

    const path = rosterStatusExportPath(
      { mode: "range", from: "2026-08-15", to: "2026-08-17", daysOfWeek: [] },
      { daysOfWeek: [0, 1, 2], format: "csv" },
    );

    expect(path).toContain("daysOfWeek=0%2C1%2C2");
  });

  test("rosterStatusExportPath omits daysOfWeek when not provided", async () => {
    const { rosterStatusExportPath } = await import("@/lib/api/endpoints/roster");

    const path = rosterStatusExportPath(
      { mode: "range", from: "2026-08-15", to: "2026-08-17", daysOfWeek: [] },
      { format: "csv" },
    );

    expect(path).not.toContain("daysOfWeek");
  });
});
