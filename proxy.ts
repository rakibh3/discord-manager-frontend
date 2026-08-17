import { NextResponse, type NextRequest } from "next/server";

/**
 * Next 16 renamed Middleware to Proxy. Same semantics.
 *
 * This is an **optimistic** check only — cookie presence, never verification.
 * The Next docs are explicit that Proxy is not a session-management or
 * authorization solution; the authoritative check is `requireSession()` in the
 * dashboard layout and in every data-access function. All this buys is avoiding
 * a flash of dashboard chrome before that check runs.
 *
 * It also refreshes proactively. `cookies().set()` throws in a Server
 * Component, so a token that expires mid-render cannot be rotated and forces a
 * logout redirect. Proxy *can* write cookies on the response, so refreshing
 * here means the render never sees an expired token in the first place.
 */

const ACCESS_COOKIE = "dm_access";
const REFRESH_COOKIE = "dm_refresh";
const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7;

type TokenPair = { accessToken: string; refreshToken: string };

function setSessionCookies(response: NextResponse, tokens: TokenPair): void {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SEVEN_DAYS_IN_SECONDS,
  } as const;

  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, options);
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, options);
}

/**
 * One refresh attempt against the backend.
 *
 * The endpoint reads `req.cookies.refreshToken` rather than a body, and rotates
 * the pair, returning it in the response body. Failure is silent: the request
 * carries on unauthenticated and the DAL redirects.
 */
async function refresh(refreshToken: string): Promise<TokenPair | null> {
  const base = process.env.API_BASE_URL;
  if (!base) return null;

  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/auth/refresh-token`, {
      method: "POST",
      headers: { Cookie: `refreshToken=${refreshToken}` },
      cache: "no-store",
    });
    if (!response.ok) return null;

    const json = (await response.json()) as { data?: Partial<TokenPair> };
    const { accessToken, refreshToken: rotated } = json.data ?? {};
    if (!accessToken || !rotated) return null;

    return { accessToken, refreshToken: rotated };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  // The access cookie has aged out but the refresh cookie has not. Rotate here,
  // where cookies can actually be written, rather than mid-render.
  if (!accessToken && refreshToken) {
    const tokens = await refresh(refreshToken);
    if (tokens) {
      const response =
        pathname === "/login"
          ? NextResponse.redirect(new URL("/dashboard", request.url))
          : NextResponse.next();
      setSessionCookies(response, tokens);
      return response;
    }

    // The refresh token is dead too. Drop it so the next request doesn't retry
    // a refresh that cannot succeed on every single navigation.
    const response =
      pathname === "/login"
        ? NextResponse.next()
        : NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  const hasSession = Boolean(accessToken);

  if (!hasSession && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // `/attendance` is deliberately absent — the public form must be reachable
  // with or without a session, and must never redirect a student to a login.
  matcher: ["/dashboard/:path*", "/login"],
};
