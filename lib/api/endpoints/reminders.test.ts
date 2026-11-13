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

const {
  getReminderEmailEvents,
  getReminderEmails,
  reminderEmailsExportPath,
  sendReminder,
} = await import("@/lib/api/endpoints/reminders");

const ok = (data: unknown, meta?: unknown) =>
  new Response(JSON.stringify({ success: true, statusCode: 200, data, meta }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

type Call = { url: string; method: string; body?: unknown };

let calls: Call[];
const originalFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function install(handler: () => Response) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return handler();
  }) as typeof fetch;
}

describe("reminder email endpoints", () => {
  test("sendReminder sends channels when chosen", async () => {
    install(() => ok({ id: "r1", targetCount: 3, queuedJobs: 0 }));

    await sendReminder({
      period: { mode: "date", date: "2026-11-12" },
      message: "Post your update",
      channels: ["EMAIL", "DISCORD"],
    });

    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.body).toEqual({
      date: "2026-11-12",
      message: "Post your update",
      channels: ["EMAIL", "DISCORD"],
    });
  });

  test("sendReminder omits an empty channel list — Discord-only default", async () => {
    install(() => ok({ id: "r1", targetCount: 3, queuedJobs: 3 }));

    await sendReminder({
      period: { mode: "date", date: "2026-11-12" },
      message: "Post your update",
      channels: [],
    });

    expect(calls[0]?.body).not.toHaveProperty("channels");
  });

  test("getReminderEmails comma-joins states and drops empty filters", async () => {
    install(() =>
      ok({ rows: [], counts: { total: 0 } }, { page: 2, limit: 50, total: 0 }),
    );

    await getReminderEmails({
      states: ["opened", "not_opened"],
      from: "2026-11-01",
      search: "  ",
      page: 2,
      limit: 50,
    });

    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/api/reminders/emails");
    expect(url.searchParams.get("state")).toBe("opened,not_opened");
    expect(url.searchParams.get("from")).toBe("2026-11-01");
    expect(url.searchParams.has("search")).toBe(false);
    expect(url.searchParams.has("to")).toBe(false);
    expect(url.searchParams.get("page")).toBe("2");
  });

  test("getReminderEmails omits state entirely when none is chosen", async () => {
    install(() => ok({ rows: [], counts: { total: 0 } }));

    await getReminderEmails({ states: [] });

    // `state=` would be a 400; an empty selection means "every state".
    expect(new URL(calls[0]!.url).searchParams.has("state")).toBe(false);
  });

  test("getReminderEmailEvents encodes the id into the path", async () => {
    install(() => ok([]));

    await getReminderEmailEvents("abc/def");

    expect(calls[0]?.url).toBe(
      "http://backend.test/api/reminders/emails/abc%2Fdef/events",
    );
  });

  test("reminderEmailsExportPath carries exactly the active filters", () => {
    expect(reminderEmailsExportPath()).toBe("/reminders/emails/export");
    expect(reminderEmailsExportPath({ states: [], search: "" })).toBe(
      "/reminders/emails/export",
    );
    expect(
      reminderEmailsExportPath({
        reminderId: "8f0c5e3a-1111-4222-8333-444455556666",
        states: ["delivered", "bounced"],
        to: "2026-11-13",
        search: "a b",
      }),
    ).toBe(
      "/reminders/emails/export?reminderId=8f0c5e3a-1111-4222-8333-444455556666&state=delivered%2Cbounced&to=2026-11-13&search=a+b",
    );
  });
});
