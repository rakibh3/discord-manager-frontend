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

// `@/lib/auth/session` is deliberately NOT mocked. `mock.module` is
// process-wide in bun, so replacing it here would leak into every other
// endpoint test in the same run. The real module reads the cookie mocked above.

const {
  addRegistrationsToRoster,
  getRegistrationSettings,
  getRegistrationWindow,
  getRegistrations,
  patchRegistrationSettings,
  registrationsExportPath,
  resendWelcomeEmail,
  retryUnsentWelcomeEmails,
} = await import("@/lib/api/endpoints/registration");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const ok = (data: unknown, meta?: unknown) =>
  json(200, { success: true, statusCode: 200, data, meta });

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
    const headers = new Headers(init?.headers);
    const call: Call = {
      url: String(input),
      method: init?.method ?? "GET",
      body: init?.body,
      authorization: headers.get("Authorization"),
    };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
}

describe("registration endpoints", () => {
  test("getRegistrationWindow is anonymous and hits the PUBLIC path", async () => {
    const window = {
      isOpen: true,
      state: "open",
      opensAt: null,
      closesAt: "2026-12-10T17:59:00.000Z",
      timezone: "Asia/Dhaka",
    } as const;
    install(() => ok(window));

    const res = await getRegistrationWindow();

    expect(res).toEqual(window);
    expect(calls[0]?.url).toBe("http://backend.test/api/registration/window");
    // No credential may ride along on the public read.
    expect(calls[0]?.authorization).toBeNull();
  });

  test("getRegistrationSettings hits the ADMIN path with the bare token", async () => {
    install(() => ok({ enabled: false }));

    await getRegistrationSettings();

    expect(calls[0]?.url).toBe(
      "http://backend.test/api/registrations/settings",
    );
    // Bare token — no "Bearer " prefix.
    expect(calls[0]?.authorization).toBe("test-token");
  });

  test("patchRegistrationSettings sends only the given keys, nulls included", async () => {
    install(() => ok({ enabled: true }));

    await patchRegistrationSettings({
      enabled: true,
      closeDate: null,
      closeTime: null,
    });

    expect(calls[0]?.method).toBe("PATCH");
    expect(JSON.parse(String(calls[0]?.body))).toEqual({
      enabled: true,
      closeDate: null,
      closeTime: null,
    });
  });

  test("getRegistrations omits `all` filters and defaults paging", async () => {
    install(() => ok([], { page: 1, limit: 50, total: 0 }));

    const res = await getRegistrations({ status: "all", emailStatus: "all" });

    expect(res.meta).toEqual({ page: 1, limit: 50, total: 0 });
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/api/registrations");
    expect(url.searchParams.has("status")).toBe(false);
    expect(url.searchParams.has("emailStatus")).toBe(false);
    expect(url.searchParams.has("search")).toBe(false);
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("limit")).toBe("50");
  });

  test("getRegistrations passes real filters through", async () => {
    install(() => ok([], { page: 2, limit: 20, total: 0 }));

    await getRegistrations({
      search: "rakib",
      status: "PENDING",
      emailStatus: "FAILED",
      page: 2,
      limit: 20,
    });

    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("search")).toBe("rakib");
    expect(url.searchParams.get("status")).toBe("PENDING");
    expect(url.searchParams.get("emailStatus")).toBe("FAILED");
    expect(url.searchParams.get("page")).toBe("2");
  });

  test("addRegistrationsToRoster sends {} for all pending, ids for a selection", async () => {
    install(() => ok({ requested: 0, enrolled: 0 }));

    await addRegistrationsToRoster();
    await addRegistrationsToRoster(["a", "b"]);

    expect(calls[0]?.url).toBe(
      "http://backend.test/api/registrations/add-to-roster",
    );
    expect(calls[0]?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.body))).toEqual({});
    expect(JSON.parse(String(calls[1]?.body))).toEqual({ ids: ["a", "b"] });
  });

  test("resendWelcomeEmail encodes the id into the path", async () => {
    install(() => ok({ id: "r 1" }));

    await resendWelcomeEmail("r 1");

    expect(calls[0]?.url).toBe(
      "http://backend.test/api/registrations/r%201/resend-email",
    );
    expect(calls[0]?.method).toBe("POST");
  });

  test("retryUnsentWelcomeEmails posts to the bulk retry path", async () => {
    install(() => ok({ requested: 3, queued: 3 }));

    const res = await retryUnsentWelcomeEmails();

    expect(res).toEqual({ requested: 3, queued: 3 });
    expect(calls[0]?.url).toBe(
      "http://backend.test/api/registrations/emails/retry",
    );
    expect(calls[0]?.method).toBe("POST");
  });

  test("a backend refusal surfaces its message", async () => {
    install(() =>
      json(400, {
        success: false,
        message: "Mailtrap is not configured: set MAILTRAP_API_TOKEN.",
      }),
    );

    await expect(retryUnsentWelcomeEmails()).rejects.toThrow(
      "Mailtrap is not configured",
    );
  });

  test("registrationsExportPath carries only the active filters", () => {
    expect(registrationsExportPath()).toBe("/registrations/export");
    expect(registrationsExportPath({ status: "all", emailStatus: "all" })).toBe(
      "/registrations/export",
    );
    expect(
      registrationsExportPath({
        search: "a b",
        status: "ENROLLED",
        emailStatus: "SENT",
      }),
    ).toBe("/registrations/export?search=a+b&status=ENROLLED&emailStatus=SENT");
  });
});
