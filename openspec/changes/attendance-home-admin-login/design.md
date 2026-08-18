## Context

The app has three surfaces and one shared root layout (`app/layout.tsx`, which supplies fonts, theme provider, tooltip provider and toaster):

| Surface | Today | Group |
| --- | --- | --- |
| Attendance form | `/attendance` | `app/(public)/attendance/` |
| Admin sign-in | `/login` | `app/(auth)/login/` |
| Admin console | `/dashboard/*` | `app/(dashboard)/dashboard/` |

`app/page.tsx` currently `redirect()`s `/` to `/dashboard`. For an anonymous visitor `proxy.ts` then bounces that to `/login`, so the bare domain lands a student on a credential form.

Constraints worth naming up front:

- **This is Next 16.** Middleware is `proxy.ts`, not `middleware.ts`, and layouts are typed with generated `LayoutProps<"/route">` helpers that are keyed to the literal route path — moving a layout changes its type parameter.
- **`/login` is hardcoded in four places outside the route directory**: `proxy.ts` (matcher plus three redirect branches), `lib/auth/session.ts:91`, `lib/api/client.ts:108`, `actions/auth.ts:104`. A rename that misses one produces a redirect loop into a 404.
- **The proxy is optimistic only.** Its own doc comment is explicit that it checks cookie *presence*, never validity; `requireSession()` in the dashboard layout is the authoritative gate. This change must not shift any authorization weight onto the proxy.
- **`/attendance` links are already distributed** in Discord messages and cannot be recalled.

## Goals / Non-Goals

**Goals:**

- `/` renders the attendance form itself — HTTP 200, no redirect hop, no session required.
- One canonical URL for the form; `/attendance` permanently redirects to it.
- Admin sign-in served at `/login-admin`, unlisted and non-indexed.
- `/login` gone (404), disclosing nothing about where it moved.
- Every sign-in redirect target updated in lockstep, with zero `/login` strings left behind.

**Non-Goals:**

- No change to authentication mechanics — cookie names, refresh rotation, `requireSession()`, and the 401 path all keep their current logic. Only destination strings change.
- No real access control from URL obscurity. `/login-admin` being hard to guess is convenience, not security; the credential check remains the only gate.
- No change to the attendance form's own markup, validation, or backend calls (`/attendance/submit`, `/attendance/verify-user` are API paths on `API_BASE` and are untouched).
- No redesign of the dashboard, and no new marketing or landing surface.

## Decisions

### 1. Move the form into `app/(public)/`'s root slot rather than rewriting `/` → `/attendance`

`app/(public)/page.tsx` + `app/(public)/layout.tsx` serve `/` — route groups do not contribute path segments, so a page directly inside `(public)` *is* the root route. `app/page.tsx` is deleted; without that deletion the two would collide on the same path and the build fails.

The four files move as a unit:

```
app/(public)/attendance/page.tsx              → app/(public)/page.tsx
app/(public)/attendance/layout.tsx            → app/(public)/layout.tsx
app/(public)/attendance/attendance-form.tsx   → app/(public)/attendance-form.tsx
app/(public)/attendance/discord-handle-field.tsx → app/(public)/discord-handle-field.tsx
```

`LayoutProps<"/attendance">` becomes `LayoutProps<"/">` in the moved layout. Note that `app/layout.tsx` already uses `LayoutProps<"/">` — that is expected and not a conflict; both layouts legitimately render at the root path.

**Alternative rejected — keep the page at `/attendance` and make `app/page.tsx` a rewrite.** A rewrite would serve the form at `/` without moving files, but leaves two live URLs for one page, splits SEO and analytics, and means the "homepage" is a rewrite target that no one reading the route tree would recognize as the homepage. The file move costs one commit and leaves the tree self-explanatory.

**Alternative rejected — leave `/` as a `redirect()` to `/attendance`.** Cheapest diff, but every visitor to the bare domain watches the URL change under them, and the canonical URL is a subpath of a site whose only public page it is.

### 2. `/attendance` → `/` via `next.config.ts` `redirects()`, permanent

```ts
async redirects() {
  return [{ source: "/attendance", destination: "/", permanent: true }];
}
```

`permanent: true` emits 308, which preserves the request method and — unlike a hand-rolled `redirect()` — carries the query string through automatically. It resolves at the routing layer before any React render, so the redirect costs no RSC work. `next.config.ts` is currently an empty config object, so this is the file's first real entry.

**Alternative rejected — a `app/(public)/attendance/page.tsx` that calls `permanentRedirect("/")`.** Also 308, but it keeps a stub route directory alive purely to delete itself, and query strings would need manual forwarding.

**Alternative rejected — handling it in `proxy.ts`.** The proxy matcher deliberately excludes public paths; adding `/attendance` to it drags the public surface into session-checking code for no benefit.

### 3. `/login-admin` is a directory rename, not a new route

`app/(auth)/login/` → `app/(auth)/login-admin/`, moving both `page.tsx` and `login-form.tsx`. The form component and the sign-in server action are unchanged — `actions/auth.ts:86` already redirects to `/dashboard` on success, which stays correct.

Two content edits to `page.tsx`:

- Add `robots: { index: false, follow: false }` to the exported `metadata`, emitting `<meta name="robots" content="noindex, nofollow">`. Per the Next 16 metadata docs, nested metadata fields like `robots` defined in a later segment overwrite earlier ones, so the page-level export is sufficient and does not need a matching entry in the root layout.
- Delete the closing paragraph that links to `/attendance`. Its rationale ("students don't sign in") no longer holds when the form is the homepage — anyone who reached `/login-admin` typed it deliberately, and the link would be a live pointer between two surfaces we are deliberately keeping unlinked.

### 4. `/login` 404s by omission, not by an explicit rule

Deleting the route directory is the whole implementation. No catch-all, no config entry, no `notFound()` stub. Next serves the standard 404 for an unmatched path, which is exactly the desired signal: `/login` looks like a path that never existed, rather than one that moved.

This is the one deliberately breaking piece. It is confined to a handful of admin bookmarks and is the point of the change — a 308 from `/login` would hand the new URL to anyone probing the old one, defeating the "type it manually" intent.

### 5. Redirect targets change together, verified by grep

The rename is only correct if all five call sites move at once:

| File | Line | Change |
| --- | --- | --- |
| `proxy.ts` | 77 | refresh-success branch: `pathname === "/login"` → `"/login-admin"` |
| `proxy.ts` | 88–89 | refresh-failure branch: both the path comparison and the redirect target |
| `proxy.ts` | 97 | unauthenticated `/dashboard/*` → `/login-admin` |
| `proxy.ts` | 100–101 | signed-in-visits-sign-in → `/login-admin` |
| `proxy.ts` | 110 | `matcher: ["/dashboard/:path*", "/login-admin"]` |
| `lib/auth/session.ts` | 91 | `requireSession()` failure |
| `lib/api/client.ts` | 108 | 401 handling |
| `actions/auth.ts` | 104 | sign-out |

The acceptance check is mechanical: `grep -rn '"/login"' app actions lib proxy.ts` must return nothing. Note the proxy's comment at line 108 also names `/attendance` and needs updating to say `/` — a stale comment here is the kind that sends the next reader hunting for a route that no longer exists.

### 6. Keep the proxy matcher tight

The matcher stays `["/dashboard/:path*", "/login-admin"]`. `/` is deliberately absent, which is what guarantees the homepage never runs session or refresh logic and can never redirect a student anywhere. This preserves the existing invariant — the public form behaves identically with or without a session cookie — and is worth stating explicitly because the natural instinct when adding a homepage is to add it to the matcher.

## Risks / Trade-offs

- **A missed `/login` reference produces a redirect loop into a 404.** A stale target sends an unauthenticated admin to a path that no longer exists, and the proxy has nothing to catch it. → The grep in Decision 5 is the gate; it must pass before the change lands. The manual pass also covers `/dashboard/*` unauthenticated, sign-out, and expired-token flows end to end.
- **Admins lose their `/login` bookmarks with no in-app recovery path.** By design, but it means someone locked out has no self-service route back in. → Share `/login-admin` out of band (the team channel) before deploying, not after.
- **URL obscurity invites treating `/login-admin` as a security control.** It is not; anyone who reads the client bundle, a redirect chain, or an access log finds it. → Recorded as a Non-Goal, and the credential check plus `requireSession()` remain the only real gate. Nothing in this change relaxes either.
- **Search engines may hold the old `/attendance` URL for a while.** The 308 handles visitors correctly regardless; only the indexed URL lags. → No mitigation needed, this resolves on its own.
- **The `(public)` layout now applies to `/` and to any future page added to that group.** Its current styling (centered, `max-w-lg`, muted background) is form-shaped and would be wrong for a second, differently shaped public page. → Fine while `/` is the group's only member; revisit if a second public page appears.

## Migration Plan

1. Announce the new admin URL to the admin team before deploying. This is the only step that cannot be undone after the fact.
2. Land the route moves, redirect-target updates, and `next.config.ts` redirect as one commit — a partial deploy leaves the app with a live sign-in guard pointing at a dead path.
3. After deploy, verify: `/` returns 200 with the form; `/attendance` returns 308 to `/`; `/login` returns 404; `/login-admin` returns 200 and signs in; `/dashboard` while signed out redirects to `/login-admin`.

**Rollback:** revert the commit. No data, schema, or backend state is involved, so the revert is complete and immediate. The only residue is browser and CDN caching of the 308 on `/attendance`, which is why the redirect is the piece to re-check first if the change is ever reverted and re-landed differently.

## Open Questions

None blocking. Two things to keep an eye on after this lands:

- Whether `/login-admin` should eventually sit behind something real (IP allowlist, or a proxy-level check) rather than obscurity. Out of scope here; worth revisiting if the admin surface grows.
- Whether the `(public)` group will gain a second page, at which point its shared layout needs to stop assuming a single narrow form.
