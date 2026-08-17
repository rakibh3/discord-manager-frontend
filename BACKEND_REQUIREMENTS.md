# Backend Work Required (Frontend → Backend)

Companion to `API_INTEGRATION.md`, which documents the backend as it exists. This is the other direction: what the **frontend needs**, and nothing else.

Verified against the running backend at `http://localhost:8000` and the source at `discord-manager/backend/src` on 2026-08-17.

| # | Item | Size |
| --- | --- | --- |
| 1 | `daily-status` module has no HTTP layer — **the whole feature is blocked** | One module, ~4 files |
| 2 | Names are English-only — tighten validation to match | One character class |
| 3 | Dead `DAILY_STATUS_ENABLED` line in backend `.env` | One line deleted |

---

## 1. The `daily-status` module needs an HTTP layer

### 1.1 Current state

`src/repositories/dailyStatus.repository.ts` is written, commented and tested. It exports:

```ts
export const dailyStatusRepository = {
  getDailyStatusPage,      // ({ date, status, search, page, limit, … }) => { rows, total }
  getDailyStatusCounts,    // (date, { includeDeparted? })            => DailyStatusCounts
  listMembersMissingUpdate,
};
```

No module exposes any of it. `src/app.ts` registers `auth`, `users`, `discord`, `schedule`, `reminders`, `attendance` — there is no `dailyStatus.routes.ts`. Confirmed live:

```
GET /api/daily-status/counts?date=2026-08-17  →  404  {"message":"API Not Found!"}
GET /api/daily-status?date=2026-08-17         →  404  {"message":"API Not Found!"}
GET /api/reminders/status   (control)         →  401  ← route exists, needs auth
```

**All the work is the HTTP layer.** No query work, no schema change, no migration.

### 1.2 Files to create

Matching the shape of `src/modules/schedule/` and `src/modules/reminder/`:

```
src/modules/dailyStatus/
  dailyStatus.validation.ts
  dailyStatus.service.ts
  dailyStatus.controller.ts
  dailyStatus.routes.ts
```

Plus one line in `src/app.ts`:

```ts
app.use('/api/daily-status', dailyStatusRouter);
```

All routes are `auth(UserRole.ADMIN)`. Validate query strings with `validateQuery`, not `validateRequest` (these are GETs — see `src/middlewares/validateRequest.ts`). Reuse `dhakaDateSchema` from `@/utils/dhakaDate` for `date`, and `pageQueryShape` from `reminder.validation.ts` for paging. Responses go through `sendResponse`, so the envelope and `meta` are automatic.

### 1.3 Two conversions the controller must do

The only places the frontend contract differs from the repository's internal shape. Both are one-liners; both are hard failures if missed.

**(a) `BigInt` → `number`.** `getDailyStatusCounts` returns every figure as `bigint` (raw `COUNT(*)`), and `JSON.stringify` **throws** on a `bigint` — `TypeError: Do not know how to serialize a BigInt`. That is a 500, not a wrong number. Wrap every count in `Number(...)`.

**(b) Two field renames.** The frontend is already built against these names:

| Repository field | API field |
| --- | --- |
| `bothCompleted` | `bothComplete` |
| `submittedAt` | `attendanceSubmittedAt` |

> Emitting the repository's own names instead is fine — say so and the frontend changes two lines. What must not happen is the two drifting apart silently, since a missing field renders as an empty cell rather than an error.

---

### 1.4 `GET /api/daily-status/counts?date=YYYY-MM-DD` 🔐

The seven overview figures. Straight passthrough of `getDailyStatusCounts(date)`.

**Query:** `date` — required, `YYYY-MM-DD`, a real calendar date.

```jsonc
{
  "success": true, "statusCode": 200,
  "message": "Daily status counts retrieved successfully",
  "data": {
    "date": "2026-08-17",          // echo the requested date back
    "totalMembers": 5187,
    "attendanceSubmitted": 4320,
    "dailyUpdateSubmitted": 3000,
    "bothComplete": 2800,
    "missingUpdateOnly": 1520,
    "missingAttendanceOnly": 200,
    "missingBoth": 667
  }
}
```

The four status buckets must sum to `totalMembers` — the frontend renders each as a percentage of the total and relies on that invariant. Don't let a second definition of any of these numbers appear elsewhere.

**Past dates must work.** The trend chart calls this endpoint **7 times in parallel** (the selected day and the six before it) on every page load. Any date that fails is dropped from the chart rather than plotted as zero, so a date range restriction shows up as a silently short chart.

---

### 1.5 `GET /api/daily-status?date=&page=&limit=&status=&search=` 🔐

The member table. Wraps `getDailyStatusPage`.

| Param | Type | Rules |
| --- | --- | --- |
| `date` | string | **required**, `YYYY-MM-DD` |
| `page` | number | optional, integer ≥ 1, default 1 |
| `limit` | number | optional, integer 1–200, default 50 (frontend sends 50) |
| `status` | enum | optional — `COMPLETE` \| `MISSING_UPDATE` \| `MISSING_ATTENDANCE` \| `MISSING_BOTH` |
| `search` | string | optional — case-insensitive partial match on name, phone, email or Discord username |

`status` and `search` **combine** (AND), and both apply before paging.

```jsonc
{
  "success": true, "statusCode": 200,
  "message": "Daily status retrieved successfully",
  "meta": { "page": 1, "limit": 50, "total": 1520 },
  "data": [
    {
      "memberId": "…",
      "discordUserId": "…",
      "discordUsername": "rakib_dev",
      "displayName": "Rakib",                 // may be null
      "name": "Rakibul Hasan",                // from the attendance form, may be null
      "email": "rakib@example.com",           // may be null
      "phone": "01711000000",                 // may be null
      "hasAttendance": true,
      "hasDailyUpdate": false,
      "status": "MISSING_UPDATE",
      "attendanceSubmittedAt": "2026-08-17T14:22:31.000Z"  // ISO, null when absent
    }
  ]
}
```

`meta.total` must be the **filtered** total (`status` and `search` applied), not the guild size — it drives the pager. `status` per row must come from the same CASE rule as the counts aggregation, or a filtered page will disagree with the cards above it.

`includeDeparted`, `sortBy` and `sortDir` exist in the repository but the frontend does not send them. Expose them or don't; the defaults are correct either way.

---

### 1.6 `GET /api/daily-status/members/:memberId?date=YYYY-MM-DD` 🔐

One member's status plus that day's messages.

**Recommended:** add `getDailyStatusForMember(memberId, date)` to `dailyStatus.repository.ts` rather than composing the status in the service — same reason as above, one definition of the status rule.

Messages come from the existing `dailyUpdateRepository.listUpdatesByMemberAndDate(memberId, date)`, mapped `id → id`, `message → content`, `messageCreatedAt → postedAt` (ISO string). Use `messageCreatedAt`, the instant the message was *sent* — a message sent 23:58 and persisted 00:01 belongs to the day it was sent.

```jsonc
{
  "success": true, "statusCode": 200,
  "message": "Member daily status retrieved successfully",
  "data": {
    // …every field from the row shape in §1.5…
    "status": "COMPLETE",
    "messages": [
      { "id": "…", "content": "Today I finished…", "postedAt": "2026-08-17T18:40:12.000Z" }
    ]
  }
}
```

`messages: []` is correct and expected when the member posted nothing — the frontend states that explicitly. **404** if `memberId` is unknown.

---

### 1.7 `GET /api/daily-status/export?date=&status=&search=&format=csv|xlsx` 🔐

The filtered export — the only endpoint with no repository function behind it.

Same `date`, `status` and `search` as §1.5, plus `format` (`csv` — what the frontend requests — or `xlsx`). It must honour the **active filter**: an admin exporting "missing both, searching 'rahman'" expects exactly those rows.

Returns a file, *not* the JSON envelope:

```
Content-Type: text/csv; charset=utf-8
   (or application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
Content-Disposition: attachment; filename="daily-status-2026-08-17.csv"
```

Columns: `discordUsername`, `displayName`, `name`, `phone`, `email`, `status`, `hasAttendance`, `hasDailyUpdate`, `attendanceSubmittedAt`.

Two notes:

- `getDailyStatusPage` clamps `limit` to 500 internally, so a 5,000-member export needs a loop over pages or a dedicated unpaginated query. Stream rows as they are fetched rather than building the file in memory.
- Prefix any cell beginning with `=`, `+`, `-` or `@` with `'`. These rows carry user-submitted names, and a spreadsheet will otherwise execute them as formulas.

---

### 1.8 Turning it on

`DAILY_STATUS_ENABLED` is a **frontend** variable read by `frontend/lib/flags.ts`. The backend has no flag of its own — once the routes exist they are available.

1. Ship the routes.
2. Confirm `GET /api/daily-status/counts?date=…` returns 200 with an admin token.
3. Set `DAILY_STATUS_ENABLED=true` in `frontend/.env.local` and restart the frontend.

**No frontend code changes at any point.** Types, endpoint functions, counts cards, part-to-whole chart, 7-day trend, server-paginated table with filter and search, member detail dialog and export proxy are all written against the contracts above. Until step 3 the page renders a "not yet available" state and issues no request.

---

## 2. Names are English-only — tighten validation to match

**File:** `src/modules/attendance/attendance.validation.ts:53`

Students enter their full name in **English (Latin letters) only**; Bengali script is not accepted on this field. The current rule is Unicode-wide (`/^[\p{L}\s]+$/u`) and is self-inconsistent besides: `\p{L}` matches Bengali consonants but not the vowel signs (`া` `ি` `ু` `ঃ`), which are marks (`\p{M}`) — so it rejects `রাকিবুল হাসান` while accepting a consonant-only `রকব`.

```ts
.regex(/^[A-Za-z\s]+$/, {
  // English-only by product decision. The message names the script, because
  // "only letters" reads as nonsense to a student who just typed their own
  // name in their own alphabet.
  error: 'Full name must use English letters and spaces only',
}),
```

Tests to update (the first two previously asserted the opposite):

```ts
expect(schema.safeParse({ name: 'রাকিবুল হাসান', … }).success).toBe(false);
expect(schema.safeParse({ name: 'মোঃ আবির',      … }).success).toBe(false);
expect(schema.safeParse({ name: 'Rakibul Hasan', … }).success).toBe(true);
expect(schema.safeParse({ name: 'Rakib 2',       … }).success).toBe(false); // digits still rejected
```

The frontend already enforces `^[A-Za-z\s]+$` and says so in the field hint before anything is typed, so nothing is broken meanwhile — it simply refuses input the backend would accept. Apostrophes and hyphens (`D'Souza`, `Abdur-Rahman`) are rejected by both the old and new rules; widen on both sides together if they show up in real submissions.

---

## 3. Remove the dead `.env` line

`backend/.env:46` contains `DAILY_STATUS_ENABLED=true`. Nothing under `backend/src/` reads it (confirmed by grep) — it gates the frontend, not the routes, and leaving it there will convince the next person the feature is on when it is not. Delete the line.

---

## Verification checklist

Against a running backend with an admin token (`Authorization: <token>` — **bare, no `Bearer` prefix**):

- [ ] `GET /api/daily-status/counts?date=<today>` → 200, seven figures, all JSON **numbers** not strings
- [ ] The four buckets sum to `totalMembers`
- [ ] The same call for a date 6 days ago → 200 (the trend needs it)
- [ ] `GET /api/daily-status?date=<today>&limit=5` → 200, `meta.total` present
- [ ] `…&status=MISSING_UPDATE` → `meta.total` drops to the filtered count, and matches `missingUpdateOnly` from the counts endpoint
- [ ] `…&search=<partial username>` → narrows, case-insensitively, and combines with `status`
- [ ] `GET /api/daily-status/members/<id>?date=<today>` → 200 with `messages: []` for a member who posted nothing
- [ ] `GET /api/daily-status/members/<unknown-id>?date=<today>` → 404
- [ ] `GET /api/daily-status/export?date=<today>&format=csv` → CSV attachment honouring `status`/`search`
- [ ] All routes → 401 without a token
- [ ] `POST /api/attendance/submit` accepts `name: "Rakibul Hasan"`, rejects `name: "রাকিবুল হাসান"` with 400 (item 2)
- [ ] `grep -rn DAILY_STATUS_ENABLED backend/` returns nothing (item 3)

---

## Reference

- `API_INTEGRATION.md` §13 — the original record that these routes do not exist
- `src/repositories/dailyStatus.repository.ts` — the query layer, already done
- `src/modules/reminder/` — closest analogue: date query, pagination, `meta`
- `src/modules/schedule/` — closest analogue for admin-only route structure
- `src/middlewares/validateRequest.ts` — `validateQuery` for GET, `validateRequest` for body
- `src/utils/dhakaDate.ts` — `dhakaDateSchema`, `getDhakaDate`
- `src/utils/sendResponse.ts` — the envelope and `meta` shape
