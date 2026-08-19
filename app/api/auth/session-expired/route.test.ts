import { expect, mock, test } from "bun:test";

/** The end of the redirect loop: this handler must both send the browser to the
 *  login page *and* expire the cookies, or `proxy.ts` bounces it back to
 *  `/dashboard` and the page appears to refresh forever. */

mock.module("server-only", () => ({}));

const { GET } = await import("./route");
const { NextRequest } = await import("next/server");

test("redirects to /login-admin and expires both session cookies", async () => {
  const request = new NextRequest(
    "http://localhost:3000/api/auth/session-expired",
  );

  const response = await GET(request);

  expect(response.status).toBe(307);
  expect(new URL(response.headers.get("location")!).pathname).toBe(
    "/login-admin",
  );

  const cleared = response.headers.getSetCookie();
  for (const name of ["dm_access", "dm_refresh"]) {
    const header = cleared.find((value) => value.startsWith(`${name}=`));
    expect(header).toBeDefined();
    expect(header).toContain("Expires=Thu, 01 Jan 1970");
  }
});
