## 1. Project setup and design system

- [x] 1.1 Add dependencies with bun: `server-only`, `zod`, `react-hook-form`, `@hookform/resolvers`
- [x] 1.2 Init shadcn/ui (`bunx --bun shadcn@latest init`), confirm `components.json` targets Tailwind v4 and the `@/*` alias, and register the `@bklit` registry
- [x] 1.3 Add the shadcn primitives the specs need: button, input, label, form, card, table, dialog, alert-dialog, alert, badge, tabs, select, checkbox, textarea, skeleton, sonner, dropdown-menu, pagination, tooltip, switch
- [x] 1.4 Run `ui-ux-pro-max` with `--design-system` for an admin-dashboard palette, type scale and spacing; write the resulting semantic tokens (including `--chart-1`…`--chart-5`) into `app/globals.css`
- [x] 1.5 Create `.env.example` documenting `API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`, `DAILY_STATUS_ENABLED`, and the note that this origin must be in **both** `APP_URL` and `ATTENDANCE_FORM_URL` on the backend; create a local `.env.local`
- [x] 1.6 Add `lib/flags.ts` exporting `DAILY_STATUS_ENABLED` (server-side, default off)
- [x] 1.7 Replace the scaffold `app/page.tsx` with a redirect to `/dashboard`, and strip the unused scaffold assets from `app/globals.css` and `public/`

## 2. Integration layer

- [x] 2.1 Write `lib/dhaka-date.ts`: `dhakaToday`, `dhakaDaysAgo`, `dhakaYesterday`, `DHAKA_TIMEZONE`, plus a `formatDhaka()` helper for `DateTime` rendering
- [x] 2.2 Write `lib/api/types.ts` — `ApiResponse<T>` and every DTO in `API_INTEGRATION.md` §7.1, including the `daily-status` contract types from §13
- [x] 2.3 Write `lib/api/errors.ts` — `ApiError`, `toApiError()` covering all five shapes, `isValidation`, `isAuthExpired` (401 **or** 500 with a known JWT message), and `fieldErrors()`
- [x] 2.4 Write `lib/auth/session.ts` — `writeSession` / `clearSession` / `readSession` / `requireSession`, `httpOnly` + `sameSite:'lax'` cookies with a **7-day** maxAge, `requireSession` wrapped in React `cache()`
- [x] 2.5 Write `lib/api/client.ts` — `server-only`, `apiRequest`/`api`, bare `Authorization` token (no `Bearer`), `cache:'no-store'` default, query-string builder, and refresh-and-retry driven by `isAuthExpired`
- [x] 2.6 Add single-flight `refreshTokens()` sending `Cookie: refreshToken=…` and reading the rotated pair from the body; catch the Server-Component `cookies().set` failure and redirect to `/login`
- [x] 2.7 Write `proxy.ts` — optimistic redirect on `dm_access` presence for `/dashboard/:path*` and `/login`, plus proactive refresh when `dm_access` is missing and `dm_refresh` is present
- [x] 2.8 Verify: an expired token round-trips through refresh once and the original request succeeds; three concurrent expiries produce exactly one refresh call

## 3. Auth and app shell

- [x] 3.1 `lib/api/endpoints/auth.ts` — login, refresh, logout
- [x] 3.2 `actions/auth.ts` — `login` Server Action collapsing 401 and 404 into one generic message, passing 403 through verbatim, mapping 400 issues to fields; `redirect()` outside the try block
- [x] 3.3 `app/(auth)/login/page.tsx` with `useActionState`, inline field errors, pending state, and `aria-invalid` wiring
- [x] 3.4 `logout` action — best-effort backend call, unconditional cookie clear and redirect
- [x] 3.5 `lib/api/endpoints/user.ts` — `getCurrentAdmin` memoized with React `cache()`
- [x] 3.6 `app/(dashboard)/layout.tsx` — `requireSession()`, shell with nav, and the admin identity read pushed into a nested Server Component inside `<Suspense>` so `{children}` is not held behind it
- [x] 3.7 Shell navigation: Overview, Discord, Schedule, Reminders, Status, Settings, with `aria-current` on the active item and a keyboard-operable mobile toggle that traps focus and closes on `Escape`
- [x] 3.8 `error.tsx` and `loading.tsx` for the dashboard segment; error copy names an unreachable API explicitly instead of showing a stack trace
- [x] 3.9 Verify: signed out → `/dashboard` redirects to `/login`; signed in → `/login` redirects to the dashboard; `/attendance` is reachable in both states

## 4. Admin profile

- [x] 4.1 `PUT /users/my-profile` endpoint function and its Zod schema (name 2–100, valid email, URL photo, bio ≤ 500)
- [x] 4.2 `actions/profile.ts` — omit blank fields entirely; map 400 to fields, 409 to the email field, 404 to the missing-profile-row explanation
- [x] 4.3 `app/(dashboard)/settings/page.tsx` — profile form with inline errors and a success toast, revalidating the path on save

## 5. Discord sync

- [x] 5.1 `lib/api/endpoints/discord.ts` — `getSyncStatus`, `triggerSync`
- [x] 5.2 `app/api/discord/sync-status/route.ts` — same-origin poll target
- [x] 5.3 `app/(dashboard)/discord/page.tsx` — server-rendered status panel: bot, member counts, last-sync timing/counts/error
- [x] 5.4 Health banner component rendering the three silent outages with the wording from the spec: `ingestionEnabled:false` (error + `reason` + Developer Portal link), `guardTripped` (warning, framed as the guard working), `bot.connected:false` (error naming everything that is down); mount it dashboard-wide
- [x] 5.5 `actions/discord.ts` — `triggerMemberSync`, treating 409 as "already running" and starting polling rather than erroring, and surfacing the 503 message
- [x] 5.6 Client sync control: disabled while `lastSync.running`, polls status every 5 s only while running, tears down interval and aborts in-flight requests on unmount
- [x] 5.7 `@bklit` chart for active-vs-departed member composition, colors from `chartCssVars`, with the same figures rendered as text

## 6. Channel schedule

- [x] 6.1 `lib/api/endpoints/schedule.ts` — `getSchedule`, `patchSchedule`, `openChannel`, `lockChannel`, all uncached
- [x] 6.2 `app/(dashboard)/schedule/page.tsx` — times, weekdays, enabled, `updatedBy`, next open/lock, last run, and live `channel.isOpen`, all rendered in Asia/Dhaka
- [x] 6.3 Explanatory states for `nextOpenAt`/`nextLockAt` being `null` and for `scheduler.processEnabled === false`
- [x] 6.4 Last-run panel that translates a `DiscordAPIError[50013]` into "the bot lacks `Manage Roles` on this channel"
- [x] 6.5 Schedule editor: time inputs + weekday checkboxes, **no cron field**, `timezone` never sent, only changed fields submitted
- [x] 6.6 Client-side guards mirroring the backend: block an empty patch, require ≥ 1 weekday, and enforce `closeTime > openTime` against the **merged** result using the loaded row as the base
- [x] 6.7 `actions/schedule.ts` — patch action returning the fresh payload and revalidating the page; surface the backend's explanatory 400 if it still rejects
- [x] 6.8 Manual open/lock behind an `AlertDialog` stating that an announcement embed will be posted and that the stored schedule is unchanged; handle 403 (message names the permission) and 503 (refresh the displayed state rather than leaving an optimistic value)

## 7. Reminder broadcasts

- [x] 7.1 `lib/api/endpoints/reminders.ts` — `getTargets`, `send`, `getHistory`, `getProgress`, `getRecipients`, `cancel`, `getQueueStatus`
- [x] 7.2 `app/api/reminders/[id]/progress/route.ts` and `app/api/reminders/status/route.ts` — same-origin poll targets (`params` is a Promise in Next 16)
- [x] 7.3 `app/(dashboard)/reminders/page.tsx` composing queue health, the composer and history, each in its own `<Suspense>` with a space-reserving skeleton
- [x] 7.4 Queue health panel polled at 10 s: worker state, `redisConnected` (disables sending, states that API/bot/ingestion/scheduler are unaffected), `queueDepth: null` reported as unreachable, and `lastFallback.missingPermission` as an error banner naming `Send Messages` on `#daily-update-reminder`
- [x] 7.5 Composer: Dhaka date picker defaulting to `dhakaYesterday()` and rejecting future dates; message textarea with a live counter against **1970** characters; send disabled until a preview exists for the selected date
- [x] 7.6 Target preview — fetch `/targets`, show `targetCount` with a bounded or virtualized slice, discard the preview when the date changes
- [x] 7.7 Confirmation dialog naming the date and exact recipient count; single-submit guard; queued confirmation states that delivery is paced and gives a `targetCount / dmPerSecond` estimate
- [x] 7.8 `actions/reminders.ts` — `sendReminder` posting an explicit `date`, treating 400/"nobody to remind" as success-adjacent, linking a 409 to the existing broadcast, explaining a 503 as queue-unavailable; redirect to the progress page on 202
- [x] 7.9 `app/(dashboard)/reminders/[id]/page.tsx` — server-render the first progress read and pass it as `initial`
- [x] 7.10 `ProgressView` client component — polls at 3 s only while `PENDING`/`PROCESSING`, bar driven by `delivered + dmClosed + failed` over `targetCount`, all four counts shown, time-remaining from `outstanding / dmPerSecond`, tolerates a failed tick, tears down on unmount
- [x] 7.11 Status labelling: "DMs closed — mentioned in channel", `CANCELLED` outstanding as "never attempted", `FAILED` explained as a stalled or crashed worker
- [x] 7.12 Recipient audit table — paginated, filterable by the four delivery statuses, `meta.total` driving the pager, no phone or email columns
- [x] 7.13 Cancel control for `PENDING`/`PROCESSING` behind a confirmation; on 200 replace the displayed progress with the returned payload and stop polling; on 409 show the message and refresh
- [x] 7.14 History table — paginated, newest first, `createdBy: null` rendered as unattributed
- [x] 7.15 `@bklit` chart of delivered / DMs-closed / failed per broadcast date, with the figures also available as text

## 8. Public attendance form

- [x] 8.1 `lib/validation/attendance.ts` — `normalizeDiscordUsername` (trim → strip leading `@` → lowercase) and the shared Zod schema: name 3–100 Unicode letters and spaces, phone `^(?:\+?880|0)1[3-9]\d{8}$`, email, username `/^(?!.*\.{2})[a-z0-9_.]{2,32}$/`
- [x] 8.2 Unit-test the username rule against `.rabbil`, `itzazad_`, `shahriarratul.` (all valid), `a..b`, `A_B`, a 1-character and a 33-character handle (all invalid), and `@Rakib_Dev` normalizing to `rakib_dev`
- [x] 8.3 `app/(public)/attendance/layout.tsx` — standalone layout, no session guard, no dashboard shell
- [x] 8.4 `DiscordHandleField` — 500 ms debounce, `AbortController` per keystroke, browser-direct call to `NEXT_PUBLIC_API_BASE_URL`, badge states idle/checking/malformed/verified/unknown/duplicate/error announced through a polite live region
- [x] 8.5 Branch verification on `data.verified`, never on HTTP status; distinguish a 400 malformed handle from a 200 `verified:false`; render avatar and display name when verified; handle 429 using `RateLimit-Reset`
- [x] 8.6 Username guidance visible before any error occurs, in the PRD's Bengali student-facing copy
- [x] 8.7 Form fields with visible labels, inline errors associated with their inputs, a phone format hint, and correct `inputMode`/`autoCapitalize`/`autoCorrect`/`spellCheck` attributes
- [x] 8.8 Submit handler — disabled while in flight, **no auto-retry**, submit stays enabled when verification failed for a network reason
- [x] 8.9 Outcome states: 201 success naming the date and member; 409 presented as success-adjacent; 404 as "not in the Discord server"; 400 mapped to fields with local copy; 429 with a wait time and entered values preserved
- [x] 8.10 Verify at 320 px width: no horizontal scroll, targets ≥ 44×44 px, correct mobile keyboards

## 9. Overview and gated daily status

- [x] 9.1 `lib/api/endpoints/daily-status.ts` — functions written to the §13 contract, each guarded so they are never called while the flag is off
- [x] 9.2 `app/(dashboard)/page.tsx` overview — health banners, and charts built only from data that exists today (member composition, broadcast outcomes, history trend)
- [x] 9.3 `app/(dashboard)/status/page.tsx` — when the flag is off, render the explanatory unavailable state and issue **no** request; assert no placeholder figures appear anywhere a real metric would
- [x] 9.4 Behind the flag: overview counts from the counts endpoint **only**, with absolute values and percentages
- [x] 9.5 Behind the flag: `@bklit` part-to-whole status chart plus a recent-days trend, each labelled rather than distinguished by color alone, with an explicit zero state
- [x] 9.6 Behind the flag: member table with date selection reflected in the URL, server-side pagination, status filter and search combining into one request
- [x] 9.7 Behind the flag: member detail view showing contact details, attendance time and that day's messages in Asia/Dhaka; state explicitly when there is no update; return focus to the originating row on dismiss
- [x] 9.8 Behind the flag: CSV/Excel export honouring the active date, filter and search; the control is absent, not disabled-and-broken, while the flag is off

## 10. Quality pass and verification

- [x] 10.1 Grep the repo for `toISOString()` on any date destined for the API, and for `Bearer ` in any header — both must return nothing
- [x] 10.2 Confirm every module touching the admin API imports `server-only`, and that no access token appears in any client bundle or serialized RSC payload
- [x] 10.3 Accessibility pass against `ui-ux-pro-max` `references/pro-rules.md`: contrast ≥ 4.5:1, visible focus rings, full keyboard operation of dialogs/tabs/menus/pagination, 44×44 px targets, `prefers-reduced-motion` honoured by chart animations
- [x] 10.4 Verify each confirmation gate actually blocks: dismissing manual open/lock or a reminder send sends no request
- [x] 10.5 Verify every poller stops — on terminal status, on unmount, and on navigation away mid-run
- [x] 10.6 `bun run lint` and `bun run build` clean, with no TypeScript errors under `strict`
- [ ] 10.7 Manual end-to-end against a running backend, in the deployment order from the design's migration plan; run the destructive paths (manual open/lock, a real send) only against a test guild
