## 1. Move the attendance form to the site root

- [x] 1.1 `git mv` the four attendance files up one level: `app/(public)/attendance/{page,layout,attendance-form,discord-handle-field}.tsx` → `app/(public)/`, then remove the now-empty `attendance/` directory.
- [x] 1.2 Delete `app/page.tsx` (the `redirect("/dashboard")` stub). It must go in the same commit as 1.1 — leaving both means two files claim `/` and the build fails.
- [x] 1.3 In the moved `app/(public)/layout.tsx`, change the type parameter from `LayoutProps<"/attendance">` to `LayoutProps<"/">`, and update the doc comment that describes the route as the nested public form rather than the homepage.
- [x] 1.4 Confirm the moved layout still exports its `Attendance` title and description metadata, so `/` renders with the attendance title under the root layout's `%s · Discord Manager` template.
- [x] 1.5 Verify the page and form components need no import-path edits — they import from `@/lib/...` aliases and sibling files that moved with them, not relative paths that crossed the boundary.

## 2. Redirect the legacy `/attendance` URL

- [x] 2.1 Add a `redirects()` entry to `next.config.ts`: `{ source: "/attendance", destination: "/", permanent: true }`.
- [x] 2.2 Confirm `/attendance` returns 308 (not 307) and that `/attendance?foo=bar` forwards the query string to `/`.

## 3. Rename the admin sign-in route

- [x] 3.1 `git mv app/(auth)/login app/(auth)/login-admin` (carries both `page.tsx` and `login-form.tsx`).
- [x] 3.2 Add `robots: { index: false, follow: false }` to the `metadata` export in `app/(auth)/login-admin/page.tsx`.
- [x] 3.3 Remove the closing paragraph in that page that links to `/attendance` — the "students don't sign in" pointer, including its surrounding `<p>`.
- [x] 3.4 Confirm `login-form.tsx` needs no change: it posts to the sign-in action, and `actions/auth.ts:86` already redirects to `/dashboard` on success.

## 4. Repoint every sign-in redirect target

- [x] 4.1 `proxy.ts` — update the `config.matcher` to `["/dashboard/:path*", "/login-admin"]`.
- [x] 4.2 `proxy.ts` — update the refresh-success branch (~line 77): the `pathname === "/login"` comparison becomes `"/login-admin"`.
- [x] 4.3 `proxy.ts` — update the refresh-failure branch (~lines 88–89): both the path comparison and the `NextResponse.redirect` target.
- [x] 4.4 `proxy.ts` — update the unauthenticated `/dashboard/*` redirect (~line 97) to `/login-admin`.
- [x] 4.5 `proxy.ts` — update the signed-in-visits-sign-in redirect (~lines 100–101) to `/login-admin`.
- [x] 4.6 `proxy.ts` — update the matcher comment (~line 108) so it names `/` rather than `/attendance` as the deliberately-unmatched public path.
- [x] 4.7 `lib/auth/session.ts:91` — `requireSession()` failure redirect → `/login-admin`.
- [x] 4.8 `lib/api/client.ts:108` — 401 handling redirect → `/login-admin`.
- [x] 4.9 `actions/auth.ts:104` — sign-out redirect → `/login-admin`. Leave line 86 (`/dashboard`) alone.

## 5. Verify

- [x] 5.1 Run `grep -rn '"/login"' app actions lib proxy.ts` and confirm it returns nothing. A single survivor loops an admin into a 404.
- [x] 5.2 Run `grep -rn '/login-admin\|/dashboard' app/\(public\)` and confirm it returns nothing — the public surface must expose no admin path.
- [x] 5.3 Run `bun run build` and confirm it succeeds, with no route-collision error on `/` and no `LayoutProps` type error.
- [x] 5.4 Run `bun run lint` and `bun test`.
- [x] 5.5 Manually verify the routing table: `/` → 200 with the form and no URL change; `/attendance` → 308 to `/`; `/login` → 404; `/login-admin` → 200.
- [ ] 5.6 Manually verify auth flows: signed out, `/dashboard` redirects to `/login-admin`; sign in lands on `/dashboard`; sign out returns to `/login-admin`; visiting `/login-admin` while signed in redirects to `/dashboard`.
  - Verified against a local production server: signed-out `/dashboard` and `/dashboard/status` → 307 `/login-admin`; `/login-admin` with a `dm_access` cookie → 307 `/dashboard`.
  - **Remaining:** the credentialed legs (sign in → `/dashboard`, sign out → `/login-admin`) need a reachable backend; `API_BASE_URL` did not respond during this pass.
- [x] 5.7 Manually verify the homepage ignores sessions: load `/` both signed in and with a stale `dm_access` cookie — the form renders identically and never redirects.
- [x] 5.8 View source on `/login-admin` and confirm `<meta name="robots" content="noindex, nofollow">` is present.

## 6. Hand off

- [ ] 6.1 Share the `/login-admin` URL with the admin team out of band before deploying — `/login` 404s with no in-app path back in.
