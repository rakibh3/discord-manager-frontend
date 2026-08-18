## Why

The site's front door currently points at the admin console: `/` redirects to `/dashboard`, which bounces unauthenticated visitors to `/login`. But almost every human who types the bare domain is a student trying to submit attendance, not an admin. They land on a sign-in form they have no credential for.

The admin console is a back-office surface for a handful of people who know where it lives. Its sign-in should be an unlisted URL that is typed deliberately, not the default destination for anyone who wanders in.

## What Changes

- **BREAKING** — `/` now renders the attendance form itself instead of redirecting to `/dashboard`. The form moves from `app/(public)/attendance/` to the root route.
- `/attendance` becomes a permanent (308) redirect to `/`, so the links already handed out in Discord keep working against a single canonical URL.
- **BREAKING** — the admin sign-in moves from `/login` to `/login-admin`. `/login` stops existing and returns 404; there is no redirect from the old path, so it does not advertise where the login went.
- Every internal redirect that targets the sign-in page — proxy, session guard, API client 401 handling, sign-out action — is repointed to `/login-admin`.
- `/login-admin` is marked `noindex, nofollow` so the admin entry point never surfaces in search results.
- The two surfaces are unlinked in both directions: the public homepage carries no link to the admin login, and the login page drops its existing link to the attendance form.
- Unauthenticated visits to `/dashboard/*` continue to redirect to the sign-in page (now `/login-admin`) — the guard behavior is unchanged, only its destination.

## Capabilities

### New Capabilities

- `public-attendance-entry`: The public, unauthenticated front door — what `/` serves, how the legacy `/attendance` URL resolves to it, and the guarantee that this surface never demands a session or exposes an admin path.
- `admin-login-access`: Where the admin sign-in lives, that its URL is unlisted and non-indexed, that the retired `/login` path is gone, and where each authentication redirect (proxy, session guard, 401 handling, sign-out) sends the user.

### Modified Capabilities

<!-- None. `openspec/specs/` holds no published specs yet, so both capabilities above are introduced fresh. -->

## Impact

**Routes**
- `app/page.tsx` — stops redirecting to `/dashboard`; becomes the attendance form.
- `app/(public)/attendance/` — page, layout, and the `attendance-form` / `discord-handle-field` client components relocate to the root route group; the path becomes a redirect.
- `app/(auth)/login/` → `app/(auth)/login-admin/` — directory rename, plus `noindex` metadata and removal of the attendance link.

**Redirect targets** (all currently hardcode `/login`)
- `proxy.ts` — the `matcher` array, the refresh-success and refresh-failure branches, and the signed-in-visits-login redirect.
- `lib/auth/session.ts:91` — `requireSession()` failure redirect.
- `lib/api/client.ts:108` — 401 handling.
- `actions/auth.ts:104` — sign-out redirect. (`actions/auth.ts:86` targets `/dashboard` and is unaffected.)

**Typed routes** — `LayoutProps<"/attendance">` in the attendance layout and `LayoutProps<"/dashboard">` are generated from the route tree; the moved layout's type parameter changes with its path.

**Not affected** — the backend. `/attendance/submit` and `/attendance/verify-user` are API endpoints on `API_BASE`, unrelated to the frontend page path being moved.

**External** — any Discord message, bookmark, or pinned link pointing at `/attendance` keeps working via the 308. Admin bookmarks pointing at `/login` break by design and must be re-shared out of band.
