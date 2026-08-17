## Why

The backend is feature-complete through PID Phase 6 and exposes 17 HTTP endpoints, but this repo is still an untouched `create-next-app` scaffold — a single `app/page.tsx`, no dependencies beyond Next 16 / React 19 / Tailwind v4. Every operational capability the backend already ships (member sync health, the `#daily-update` channel schedule, rate-limited reminder broadcasts, the public attendance form) is currently unreachable by any human, so the system cannot be run day to day.

This change builds the frontend half: the admin dashboard and the public attendance form, wired to every endpoint that exists today.

## What Changes

**Integration foundation**

- A server-only API client that unwraps the `{ success, statusCode, message, meta, data }` envelope and collapses the backend's five distinct error shapes into one `ApiError`.
- Correct handling of the backend's documented quirks: a **bare** `Authorization` token (no `Bearer` prefix), an expired JWT arriving as **HTTP 500** rather than 401, refresh reading its token from a **cookie header** and **rotating** it (single-flight required), and login-with-unknown-email answering **404**.
- Asia/Dhaka civil-date helpers. `toISOString().slice(0,10)` is banned repo-wide — it yields the UTC day and would put an admin in Dhaka at 00:30 on yesterday's dashboard.

**Admin dashboard** (auth-gated, server-rendered)

- Email/password login; tokens read from the response **body** into Next-set httpOnly cookies, because the backend's own cookies (`secure:false` + `sameSite:'none'`) are rejected by browsers outright.
- Discord health: bot connection, member counts, last-sync detail, manual re-sync with polling. Surfaces the three otherwise-invisible outages — `ingestionEnabled:false`, `guardTripped`, `bot.connected:false`.
- Channel schedule editor: open/close times and weekday checkboxes (**never a cron field**), plus manual open/lock behind a confirmation dialog — those two post an embed thousands of students read.
- Reminder broadcasts: dry-run target preview → confirmation → send → live progress polling → recipient audit → history → cancel, plus queue/worker health.
- Admin profile view and edit.

**Public attendance form** at `/attendance` — unauthenticated, browser-direct, 500 ms debounced username verification with abort-on-keystroke, and the four validated fields.

**Dependencies added:** shadcn/ui (via `components.json`) for primitives, the `@bklit` registry for every chart, `zod` + `react-hook-form` for form validation.

**Scope boundary — the daily-status dashboard has no backend.** `API_INTEGRATION.md` §13 records that per-member status (`COMPLETE` / `MISSING_UPDATE` / `MISSING_ATTENDANCE` / `MISSING_BOTH`), the seven overview counts, search/filter, the user-detail view, and CSV/Excel export exist only in the backend's repository layer and are exposed over **no HTTP route**. This change ships that page's types, data-access functions and UI written to the documented contract, behind one flag that renders an honest "not yet available" state — it does **not** fabricate numbers. Charts on the overview are driven only by data that genuinely exists today (reminder outcomes, broadcast history, member directory composition, queue depth).

## Capabilities

### New Capabilities

- `api-client`: The server-only fetch layer — envelope unwrapping, the five error shapes normalized to one `ApiError`, bare-token auth headers, single-flight refresh-and-retry, and Asia/Dhaka date handling.
- `admin-auth`: Login, logout, httpOnly session cookies written by Next, the optimistic `proxy.ts` redirect, and the authoritative `requireSession()` data-access guard.
- `admin-profile`: Reading the signed-in admin (`GET /users/me`) and editing name, email, photo and bio (`PUT /users/my-profile`).
- `dashboard-shell`: The authenticated app shell — navigation, responsive layout, loading and error boundaries, the shared design system, and chart theming tokens.
- `discord-sync`: Bot and member-directory health, manual re-sync with completion polling, and prominent surfacing of silent outages.
- `channel-schedule`: Viewing and patching the `#daily-update` schedule, and the confirmed manual open/lock overrides.
- `reminder-broadcasts`: The full broadcast lifecycle — target preview, confirmed send, polled progress, recipient audit, history, cancellation, and queue health.
- `attendance-form`: The public student-facing form — live Discord username verification, the four validated fields, and submission outcome handling.
- `daily-status-dashboard`: Overview metrics and the per-member daily status view, specified in full and gated off until the backend endpoints exist.

### Modified Capabilities

None — `openspec/specs/` is empty; this is the first change in the repo.

## Impact

- **Code:** `app/` gains `(auth)`, `(dashboard)` and `(public)` route groups plus one same-origin route handler for client polling; new top-level `lib/`, `actions/`, `components/`, and `proxy.ts`. The scaffold's `app/page.tsx` becomes a redirect.
- **APIs consumed:** all of `/api/auth`, `/api/users`, `/api/discord`, `/api/schedule`, `/api/reminders`, `/api/attendance`. None of the §13 routes are called.
- **Dependencies:** shadcn/ui primitives, `@bklit` charts (pulls `@visx/*` and `motion`), `zod`, `react-hook-form`, `@hookform/resolvers`.
- **Configuration:** `.env.local` needs `API_BASE_URL` (server-only) and `NEXT_PUBLIC_API_BASE_URL` (attendance form only).
- **Backend coordination required:** this origin must appear in **both** `APP_URL` and `ATTENDANCE_FORM_URL`, since the dashboard and the form ship from one deployment. The backend's CORS allowlist is built from exactly those two vars and runs with `credentials: true`.
- **Out of scope:** admin user management (seeded via `bun run seed`), the SSE progress stream (polling replaces it), and any export endpoint.
