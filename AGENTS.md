# AGENTS.md

Next.js 16 App Router app serving **two apps from one origin**: `/` is the public attendance form and `/register` the public registration form (no auth on either), `/dashboard/*` is the admin dashboard (session required). Talks to the Express backend in `../backend` — see `API_INTEGRATION.md` in either package for the endpoint contract, and `../AGENTS.md` for the cross-package rules (git, dates, CORS, envelope).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Commands

```bash
bun install
cp .env.example .env.local   # API_BASE_URL=http://localhost:8000/api (backend must be running)
bun run dev                  # http://localhost:3000
bun test                     # bun's built-in runner; *.test.ts are colocated
bun run lint
bun run build                # also the typecheck (no standalone tsc script)
```

## Env (`API_INTEGRATION.md` §1 and `.env.example` have the full story)

- `API_BASE_URL` is **server-only — never prefix it with `NEXT_PUBLIC_`**: the admin API is reached from the Next server, so the access token never reaches the browser.
- `NEXT_PUBLIC_API_BASE_URL` exists only for the two public forms. The attendance form's username verification fires browser-direct on a keystroke debounce (proxying it would double latency on a rate-limited endpoint). The registration form at `/register` posts its submit browser-direct for a different reason: the backend rate-limits that route **per IP**, and a submit proxied through the Next server would put every registrant behind one address and one shared budget — never move it into a Server Action.
- Any new origin must be added to backend `APP_URL` **and** `ATTENDANCE_FORM_URL` (both accept comma-separated lists) — missing from the second alone makes the form fail CORS while the dashboard works.

## Auth architecture (the part that bites)

- **Session cookies are written by Next, not the backend** (`dm_access`/`dm_refresh` in `lib/auth/session.ts`). The backend's own cookie pair (`secure:false` + `sameSite:'none'`) is rejected by browsers — never switch back to backend-issued cookies.
- All admin API calls go through the server-only fetch layer `lib/api/client.ts` (`import "server-only"`); it reads the httpOnly cookie and does refresh-and-retry. **An expired access token arrives as HTTP 500, not 401** — the retry logic keys on that.
- **Server Components must redirect to `SESSION_EXPIRED_PATH` (`/api/auth/session-expired`), never straight to `/login-admin`.** A Server Component cannot write cookies, so `proxy.ts` still sees a live session and bounces it back to `/dashboard` — a redirect loop that reads as an endless refresh.
- `proxy.ts` (Next 16 renamed Middleware to Proxy) is only a cookie-presence check plus a proactive refresh; `requireSession()` in the dashboard layout is the real authority. Its matcher deliberately excludes `/` so the public form stays reachable with or without a session.
- `cookies().set()` throws during a Server Component render — writes are for Server Actions and Route Handlers only; reads are fine everywhere.

## Request/response quirks

- The payload is always inside `data` of the `{ success, statusCode, message, meta?, data }` envelope; pagination lives in `meta`.
- List-shaped query params are **comma-joined** (`daysOfWeek=0,1,2`); an empty array means "no filter" and must be omitted entirely (sending `key=` is a 400).
- Backend Zod errors title-case every word of field path and message — never render them verbatim; map `errorDetails.issues[].path` (lowercased) to your own copy.

## Layout conventions

- Dashboard data flows: `app/(dashboard)/**` Server Components → Server Actions in `actions/*.ts` → `lib/api/endpoints/*.ts` (one file per backend module). Route handlers under `app/api/*` exist only where the browser must call out (session-expired, exports, SSE-style progress).
- `lib/dhaka-date.ts` is the only date authority (mirrors backend `src/utils/dhakaDate.ts`): `YYYY-MM-DD` civil days, `HH:mm` wall clock; `toISOString().slice(0,10)` is banned.
- Charts are a custom in-repo stack (`components/charts/` — d3/visx based), not recharts; shadcn primitives live in `components/ui/`.
