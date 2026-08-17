## ADDED Requirements

### Requirement: Envelope unwrapping

The API client SHALL treat `{ success, statusCode, message, meta, data }` as the shape of every successful backend response and SHALL expose the payload from `data`. Callers that need pagination totals SHALL be able to read `meta` from the same call.

#### Scenario: Payload is nested under data

- **WHEN** an endpoint returns `{ "success": true, "statusCode": 200, "data": { "verified": true } }`
- **THEN** the client's `api()` helper resolves to `{ verified: true }`
- **AND** `apiRequest()` resolves to the full envelope so `meta` remains reachable

#### Scenario: Paginated list exposes meta

- **WHEN** `GET /reminders` returns `meta: { page: 1, limit: 50, total: 23 }`
- **THEN** the caller receives `total: 23` without a second request

### Requirement: Authorization header carries a bare token

The API client SHALL send the access token as the raw value of the `Authorization` header. It SHALL NOT prefix the token with `Bearer `.

#### Scenario: Authenticated request

- **WHEN** an authenticated request is sent
- **THEN** the header is `Authorization: <accessToken>` with no scheme prefix

#### Scenario: Anonymous request

- **WHEN** a request is marked anonymous (login, refresh, the public attendance routes)
- **THEN** no `Authorization` header is sent and no session lookup occurs

### Requirement: Error normalization across five shapes

The API client SHALL collapse every backend error response into a single `ApiError` carrying `status`, a human-usable `message`, and a list of field `issues`. It SHALL handle all five documented shapes: Zod validation, `AppError`, Prisma duplicate (P2002), Prisma not-found (P2025), and the auth middleware's self-written responses. It SHALL read the message from `errorMessage` when `message` is a generic label, and SHALL NOT expect `statusCode` inside any error body.

#### Scenario: Zod validation error

- **WHEN** the backend returns 400 with `errorDetails.issues[]`
- **THEN** `ApiError.isValidation` is `true`
- **AND** `fieldErrors()` returns a map keyed by the lowercased first character of each issue path, so `DiscordUsername` becomes `discordUsername`

#### Scenario: Prisma duplicate error

- **WHEN** the backend returns 409 with `message: "Duplicate Error"` and the useful text in `errorMessage`
- **THEN** `ApiError.message` is taken from `errorMessage`, not from `message`

#### Scenario: Non-JSON error body

- **WHEN** an error response body cannot be parsed as JSON
- **THEN** an `ApiError` is still produced with `message` of `Request failed with status <status>`

### Requirement: Title-cased validation messages are not rendered verbatim

The backend title-cases every word of Zod messages and field paths. The frontend SHALL map `errorDetails.issues[].path` to its own field copy and SHALL use the server message only as a fallback when no mapping exists.

#### Scenario: Known field with local copy

- **WHEN** an issue arrives with path `DiscordUsername` and a title-cased message
- **THEN** the form renders the frontend's own copy for that field

#### Scenario: Unknown field without local copy

- **WHEN** an issue arrives for a field the form does not know
- **THEN** the server's message is displayed unchanged as a fallback rather than being swallowed

### Requirement: Expired tokens are detected despite an HTTP 500

An expired or malformed access token is returned by the backend as **HTTP 500**, not 401. The client SHALL treat a 401, or a 500 whose message is one of `jwt expired`, `invalid signature`, `jwt malformed`, `invalid token`, as "needs refresh".

#### Scenario: Access token aged out

- **WHEN** a request fails with HTTP 500 and `message: "jwt expired"`
- **THEN** the client refreshes the token pair and retries the original request once
- **AND** the user never sees an error page

#### Scenario: Genuine server error

- **WHEN** a request fails with HTTP 500 and any other message
- **THEN** no refresh is attempted and the `ApiError` propagates

### Requirement: Single-flight token refresh

Refresh rotates the token pair and deletes the previous row, so two concurrent refreshes log the user out. The client SHALL serialize refresh through one in-flight promise per server instance. It SHALL send the refresh token as a `Cookie: refreshToken=<token>` header because the endpoint reads `req.cookies`, not the body, and SHALL read the rotated pair from the response body.

#### Scenario: Concurrent requests expire together

- **WHEN** three server-side reads fail with `jwt expired` in the same render pass
- **THEN** exactly one `POST /auth/refresh-token` is issued
- **AND** all three retries use the resulting access token

#### Scenario: Refresh rejected

- **WHEN** `POST /auth/refresh-token` returns a non-2xx response
- **THEN** the session is cleared and the request is redirected to `/login`

#### Scenario: Refresh attempted during a Server Component render

- **WHEN** a token expires while a Server Component renders and writing cookies is therefore not permitted
- **THEN** the failure to write cookies is caught and the user is redirected to `/login` rather than surfacing an unhandled error

### Requirement: Reads are uncached by default

Dashboard data is operational state. The client SHALL default every request to `cache: 'no-store'` and SHALL allow an explicit per-call override only where the change's caching table permits staleness.

#### Scenario: Default read

- **WHEN** a dashboard data function calls the client without a cache option
- **THEN** the underlying `fetch` runs with `cache: 'no-store'`

### Requirement: Asia/Dhaka civil dates

All `YYYY-MM-DD` values sent to or read from the backend are Asia/Dhaka calendar days. The frontend SHALL derive them with an `Intl.DateTimeFormat` pinned to `Asia/Dhaka` and SHALL NOT derive them from `toISOString()`. All rendered `DateTime` values SHALL be formatted in `Asia/Dhaka`.

#### Scenario: Viewer is in a different timezone

- **WHEN** an admin in UTC−5 loads the dashboard at 22:00 local, which is already the next day in Dhaka
- **THEN** `dhakaToday()` returns the Dhaka calendar day
- **AND** the dashboard shows the same day the backend is filing rows under

#### Scenario: Reminder default date

- **WHEN** the reminder composer opens
- **THEN** its default date is `dhakaYesterday()`, computed from the Dhaka civil date rather than the browser clock

### Requirement: The admin API is reached only from the server

Modules that call the admin API SHALL be marked `server-only`. The browser SHALL NOT hold the access token or call the backend's authenticated routes directly. Client components needing live data SHALL poll a same-origin Next route handler that proxies through the server client.

#### Scenario: Client component needs live progress

- **WHEN** a client component polls for reminder progress
- **THEN** it requests a same-origin `/api/...` route handler
- **AND** the access token never appears in a browser-visible response or bundle

#### Scenario: Accidental client import

- **WHEN** a client component imports the API client module
- **THEN** the build fails via `server-only` rather than shipping the token path to the browser
