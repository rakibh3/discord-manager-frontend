import { NextResponse, type NextRequest } from "next/server";

import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/session";

/** Where a render-time session failure lands. `cookies().set()` throws during a
 *  Server Component render, so the dead cookies survive a plain
 *  `redirect("/login-admin")` — and `proxy.ts`, seeing an access cookie, bounces
 *  straight back to `/dashboard`. That ping-pong is what looks like the page
 *  refreshing forever. A route handler *can* write cookies, so the clear happens
 *  here and the browser reaches the login page with no session left to bounce on. */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login-admin", request.url));
  response.cookies.delete({ name: ACCESS_COOKIE, path: "/" });
  response.cookies.delete({ name: REFRESH_COOKIE, path: "/" });
  return response;
}
