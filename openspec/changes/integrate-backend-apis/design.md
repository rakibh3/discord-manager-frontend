## Context

The backend (Express + Prisma + discord.js + BullMQ) is complete through PID Phase 6 and documented endpoint-by-endpoint in `API_INTEGRATION.md`, which was written by reading the backend source rather than a spec. This repo is an untouched `create-next-app`: Next 16.3.1, React 19.2.8, Tailwind v4, and nothing else.

Four properties of the backend drive most of the design below:

1. **Its auth cookies are unusable from a browser.** They are set with `secure:false` combined with `sameSite:'none'`, which browsers reject outright. Cross-origin cookie auth is not an option, so the token has to be handled by something we control.
2. **Its error surface is irregular.** Five distinct error shapes, an expired JWT returning HTTP 500, the useful message sometimes in `errorMessage` rather than `message`, and Zod messages title-cased word by word.
3. **Some of its work is asynchronous and slow.** `POST /discord/sync` and `POST /reminders/send` both answer 202 before anything has happened; a full reminder broadcast is paced at ~2 DMs/second and runs for roughly 40 minutes.
4. **Part of the PRD's dashboard has no HTTP surface at all.** `API_INTEGRATION.md` §13 is explicit: the daily-status aggregation lives in the repository layer and is exposed by no route.

`AGENTS.md` also warns that this Next.js differs from training data — Middleware is `proxy.ts`, `cookies()`/`headers()`/`params`/`searchParams` are async, and caching is opt-in. Decisions here were checked against `node_modules/next/dist/docs/`.

## Goals / Non-Goals

**Goals:**

- Every endpoint that exists today reachable through the UI, with each documented quirk handled once, centrally, rather than rediscovered per page.
- The access token never present in client JavaScript.
- Silent backend outages (ingestion off, guard tripped, bot down, Redis down, fallback blocked) visible without going looking for them.
- Irreversible actions — manual channel open/lock, reminder send — gated behind confirmations that name the blast radius.
- A `daily-status` implementation that is genuinely ready to switch on, and that shows nothing rather than something fake while off.

**Non-Goals:**

- Any endpoint in §13. No frontend code calls a path that would 404.
- SSE. It does not exist on the backend; polling replaces it and is sufficient for a 40-minute job.
- Admin user management (admins are seeded).
- Offline support, i18n, or a theme switcher. The UI is English with Bengali student-facing copy where the PRD specifies it.
- Enabling `cacheComponents`. Almost nothing here is cacheable; opting in would add ceremony for no benefit.

## Decisions

### D1. Admin API is called from the Next server; the public form calls the backend directly

The dashboard's data path is browser → Next server → backend. Tokens stay in httpOnly cookies, refresh-and-retry lives in one module, and the hot path has no CORS preflight.

The attendance form is the deliberate exception: `verify-user` fires on a 500 ms keystroke debounce, and proxying each call through the Next server would double latency for an endpoint that is public by design and rate-limited per IP. It uses `NEXT_PUBLIC_API_BASE_URL` from the browser.

*Alternative rejected:* browser-side calls for everything with the token in memory or `localStorage`. Cheaper to write, but puts an admin token in JS-readable storage and scatters refresh logic across every component.

*Consequence:* because both apps ship from one origin, that origin must be in **both** `APP_URL` and `ATTENDANCE_FORM_URL` on the backend. This is a coordination requirement, not a code change here.

### D2. Session cookies are written by Next, from the login response body

Login and refresh return both tokens in `data`. We read them from there and set our own `dm_access` / `dm_refresh` cookies: `httpOnly`, `sameSite:'lax'`, `path:'/'`, `secure` in production, `maxAge` **7 days**.

Seven days, not thirty: the refresh token's JWT `exp` is `JWT_REFRESH_EXPIRES_IN` (30d in dev) but its database row is hardcoded to 7 days in `auth.service.ts`, and the row is what actually governs. A 30-day cookie would leave users holding a credential the backend already rejects.

*Alternative rejected:* an encrypted single session cookie holding both tokens. Marginal gain; two cookies read more directly and cost nothing.

### D3. `proxy.ts` is a redirect, the DAL is the authorization boundary

`proxy.ts` checks only for the presence of `dm_access` and redirects — no verification, no fetch. The Next docs are explicit that Proxy is not a session-management or authorization solution, and equally explicit that **a layout check is not sufficient either**: layouts do not re-render on client-side navigation, and a layout does not control whether its route segments render.

So `requireSession()` is called in the dashboard layout *and* inside every authenticated data-access function, memoized with React `cache()` so repeated calls in one render pass read the cookie jar once. The guarantee is at the data source, not at the chrome.

The docs also warn that a top-level `await` on `cookies()` in a layout holds `{children}` behind it. The admin identity read is therefore pushed into a nested Server Component inside its own `<Suspense>`, so the shell streams first.

### D4. One `ApiError` for five error shapes

`toApiError(res)` inspects the body and produces `{ status, message, issues[] }`, preferring `errorDetails.issues` → `errorMessage` → `message` → a status-derived fallback. Two accessors carry the quirks:

- `isValidation` — 400 with issues; the caller maps `issues[].path` (lowercased first character) to its own field copy. Server text is a fallback only, because it arrives Title Cased Word By Word and reads wrong in polished UI.
- `isAuthExpired` — `status === 401 || (status === 500 && message ∈ {jwt expired, invalid signature, jwt malformed, invalid token})`. Keying on 401 alone would produce a 500 error page every time a token ages out, which is the single most likely way to ship this broken.

### D5. Refresh is single-flight, and cannot run during a Server Component render

Refresh rotates: the old row is deleted in the same transaction that creates the new one, so two concurrent refreshes log the user out. One module-level in-flight promise serializes them. The call sends `Cookie: refreshToken=<token>` by hand, because the endpoint reads `req.cookies` rather than the body, and reads the rotated pair from the response body rather than parsing `Set-Cookie`.

The sharp edge: `cookies().set()` throws in a Server Component. If a token expires mid-render, `writeSession()` cannot persist the rotated pair. We catch that and `redirect('/login')` — correct but user-visible.

**Mitigation:** refresh proactively in `proxy.ts`. Proxy can write cookies on the response, so if `dm_access` is absent or near expiry while `dm_refresh` is present, it refreshes there and the render never sees an expired token. Access tokens live 7 days in dev, so the in-render path should be rare; it stays as the correct-but-blunt fallback.

*Alternative rejected:* a client-side refresh loop. Would require the token in the browser, defeating D1.

### D6. Polling, in a fixed shape, through same-origin route handlers

No SSE exists. Client components poll one thin Next route handler per resource, which reuses the server client so the token never leaves the server. Every poller follows the same rules: server-render the first read and pass it as `initial` so there is no empty flash; stop when the status is terminal; abort in-flight requests and clear the interval on unmount; swallow a failed tick and let the next one retry.

Intervals per the integration guide: reminder progress 2–3 s (only while `PENDING`/`PROCESSING`), discord sync status 5 s (only while `lastSync.running`), queue health 10 s on the reminders page.

Estimated-time-remaining (`outstanding / dmPerSecond`) is a requirement, not a nicety: 40 minutes of a bar that barely moves reads as a hung job when it is the rate limiter working correctly.

### D7. Everything is `no-store`; `use cache` is not used

`fetch` is uncached by default in Next 16 and that is the right default here — this is operational state. `GET /schedule/daily-update` in particular costs a live Discord read of `channel.isOpen` on every request and must never be cached. `GET /users/me` mutates `lastActiveAt` on every authenticated call, so it is per-render-memoized but never cached across requests. Mutations call `revalidatePath` on the pages they affect.

### D8. shadcn/ui primitives, `@bklit` charts, no second charting library

shadcn gives accessible primitives (dialog, table, form, tabs, toast) as source in-repo. Every chart comes from the `@bklit` registry via `npx shadcn@latest add @bklit/<chart>`, composed root → `Grid` → series → axes → `ChartTooltip`, colored from `chartCssVars` / `--chart-*` rather than literals. `ui-ux-pro-max` informs layout, palette, typography and the accessibility pass.

Charts on the *overview* are limited to data that exists: member directory composition (active vs departed), reminder outcome breakdown per broadcast, and broadcast history trend. The PRD's attendance-versus-update charts are part of `daily-status-dashboard` and stay dark until its endpoints exist.

Every chart carries a text equivalent of its figures — a chart is not the only way any number is available.

### D9. Validation is defined once in Zod and shared

One schema per form, used by `react-hook-form` on the client and re-checked in the Server Action, mirroring the backend rules exactly. Three of them are load-bearing:

- **Discord username:** `/^(?!.*\.{2})[a-z0-9_.]{2,32}$/` after trim → strip leading `@` → lowercase. A leading or trailing `_` or `.` is **valid**. Tightening this locks out 5.3% of real members — 115 of 2,189 verified against the live server — and is a direct violation of PRD Golden Rule 3.
- **Reminder message:** 1–**1970** characters, not 2000, with a live counter.
- **Schedule patch:** non-empty, and `closeTime > openTime` evaluated against the *merged* result of the patch and the currently-loaded row — the backend applies this cross-field rule after merging, so a client check on the form values alone would disagree.

Phone accepts `^(?:\+?880|0)1[3-9]\d{8}$` and the entered text is submitted verbatim; the name rule is Unicode letters, so Bengali names pass.

### D10. Asia/Dhaka is the only date authority

`lib/dhaka-date.ts` exports `dhakaToday()`, `dhakaDaysAgo()`, `dhakaYesterday()` and a formatter pinned to the zone. `toISOString().slice(0,10)` is banned; an admin in Dhaka at 00:30 would otherwise be shown yesterday's dashboard while the backend files rows under today. All rendered timestamps use `timeZone: 'Asia/Dhaka'` so a travelling admin reads the same clock as the schedule. `date` on `POST /reminders/send` is always passed explicitly from a user-chosen value.

### D11. `daily-status-dashboard` ships complete but switched off

Types, endpoint functions, page, table, filters, detail view and export are written to the §13 contract behind `DAILY_STATUS_ENABLED` (server-side, default off). Off, the route renders an explanatory state and issues **no request** — so no `API Not Found!` 404 ever occurs, and no placeholder number is ever shown where a real metric belongs.

*Alternative rejected:* Next route handlers returning fabricated data. It demos well and is exactly how a fake 86.4% attendance figure ends up in a screenshot someone treats as real.

When the endpoints land, all seven overview figures come from the counts endpoint alone. They interlock and must agree; assembling any of them from the reminder targets list would produce numbers that quietly contradict each other.

### D12. Directory layout

```
proxy.ts                         # optimistic redirect + proactive refresh (D5)
app/
  (auth)/login/
  (dashboard)/                   # layout: requireSession() + shell
    page.tsx                     # overview
    discord/  schedule/  reminders/  reminders/[id]/  status/  settings/
  (public)/attendance/           # no auth, no shell
  api/                           # same-origin poll targets only
    reminders/[id]/progress/  reminders/status/  discord/sync-status/
lib/
  api/{types,errors,client}.ts
  api/endpoints/{auth,user,discord,schedule,reminders,attendance,daily-status}.ts
  auth/session.ts
  validation/                    # shared Zod schemas
  dhaka-date.ts  flags.ts
actions/                         # 'use server' mutations
components/{ui,charts,dashboard}/
```

One endpoint file per backend module keeps the mapping to `API_INTEGRATION.md` §8 one-to-one, which matters when the backend changes.

## Risks / Trade-offs

- **A token expires during a Server Component render** → cookies cannot be written, forcing a logout redirect. Mitigated by proactive refresh in `proxy.ts` (D5); the in-render path remains as a correct fallback.
- **A stale `verify-user` response overwrites a newer one** → the student sees a verdict for a handle they already edited. Mitigated by `AbortController` on every keystroke; the spec makes out-of-order responses a test case.
- **Verification is treated as a gate** → a network blip would block a legitimate student. Deliberately an affordance only: submit stays enabled, and `POST /submit` re-runs every check server-side as the real enforcement point.
- **An unpaginated `/targets` response with thousands of rows** → a frozen tab. Mitigated by rendering `targetCount` plus a bounded slice or a virtualized list, never the raw array.
- **A double-clicked send** → the backend's 409 guard prevents a duplicate broadcast, but the UI would show an error for a user action that actually succeeded. Mitigated by disabling on submit and by linking the 409 to the existing broadcast rather than reporting failure.
- **A misread `DM_CLOSED` or `CANCELLED`** → an admin concludes the system failed when it worked. Mitigated by fixed labels: "DMs closed — mentioned in channel", and "never attempted" for a cancelled broadcast's outstanding recipients.
- **Rate-limit budgets are process-local on the backend** → the real budget is N× with N processes. We design to the documented single-process numbers (60/min verify, 5/15min submit) and never rely on a tighter guarantee.
- **`@bklit` pulls `@visx/*` and `motion`** → bundle growth on an admin dashboard. Acceptable: charts are in client components on specific routes, not in the shell.
- **`daily-status` is written against a contract that may shift** → rework if the eventual endpoints differ. Bounded to the types and endpoint file; the alternative is either no UI at all or fake numbers, both worse.
- **The origin is missing from `ATTENDANCE_FORM_URL`** → the form's browser-direct calls fail CORS while the dashboard works fine, which looks like a form bug. Called out in the tasks and in the env documentation.

## Migration Plan

Nothing to migrate — the repo has no prior implementation and `openspec/specs/` is empty. Deployment order:

1. Add this origin to both `APP_URL` and `ATTENDANCE_FORM_URL` on the backend and restart it. Doing this first means the frontend never appears broken for a CORS reason.
2. Set `API_BASE_URL` and `NEXT_PUBLIC_API_BASE_URL` in the deployment environment. `DAILY_STATUS_ENABLED` stays unset.
3. Ship. Verify in order: login → `/users/me` in the header → discord status → schedule read → a `/targets` preview with **no** send → the attendance form end to end.
4. Verify the destructive paths on a test guild before real use: manual open/lock (posts an embed) and a real send (DMs students).

Rollback is a redeploy of the previous build; no backend or data change is involved.

## Open Questions

- **Access token lifetime in production.** `JWT_ACCESS_EXPIRES_IN` is `7d` in dev. If production shortens it to minutes, the proactive-refresh path in `proxy.ts` moves from a safety net to the primary path and needs explicit testing.
- **Whether `/attendance` should also be reachable at a friendlier public URL.** The PRD links students from `#attendance`; a vanity path or QR-friendly short URL is a deployment concern, not decided here.
- **Whether the overview should show broadcast history charts before `daily-status` exists.** Assumed yes — it is real data and the page would otherwise be nearly empty — but it is a product call the first review can reverse cheaply.
