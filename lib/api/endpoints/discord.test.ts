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

const { triggerSync } = await import("@/lib/api/endpoints/discord");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type Call = { url: string; method: string; body?: unknown };

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
    const call: Call = {
      url,
      method: init?.method ?? "GET",
      body: init?.body,
    };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
}

describe("discord endpoints", () => {
  test("triggerSync sends an empty body when no guildId is given", async () => {
    const mockResult = {
      accepted: ["146", "189"],
      skipped: [] as { guildId: string; reason: string }[],
      startedAt: "2026-08-19T12:00:00.000Z",
    };

    install(() => json(202, { success: true, statusCode: 202, data: mockResult }));

    const res = await triggerSync();

    expect(res).toEqual(mockResult);
    expect(calls[0].url).toBe("http://backend.test/api/discord/sync");
    expect(calls[0].method).toBe("POST");
    // Empty body must be sent as `{}`, not omitted — the spec describes
    // "empty body (or omitted `guildId`)" as the multi-server case.
    expect(calls[0].body).toBe("{}");
  });

  test("triggerSync forwards a guildId when given", async () => {
    const mockResult = {
      accepted: ["146"],
      skipped: [] as { guildId: string; reason: string }[],
      startedAt: "2026-08-19T12:00:00.000Z",
    };

    install(() => json(202, { success: true, statusCode: 202, data: mockResult }));

    const res = await triggerSync("146");

    expect(res).toEqual(mockResult);
    expect(calls[0].url).toBe("http://backend.test/api/discord/sync");
    expect(calls[0].body).toBe(JSON.stringify({ guildId: "146" }));
  });
});
