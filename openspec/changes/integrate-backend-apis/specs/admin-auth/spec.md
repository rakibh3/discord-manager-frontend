## ADDED Requirements

### Requirement: Admin login

The system SHALL provide a login form collecting email and password and submitting them to `POST /api/auth/login` through a Server Action. Only `ADMIN` accounts exist; students never log in.

#### Scenario: Valid credentials

- **WHEN** an active admin submits correct credentials
- **THEN** the token pair is read from the response **body**
- **AND** the session cookies are written
- **AND** the browser is redirected to the dashboard

#### Scenario: Submission in flight

- **WHEN** the form has been submitted and no response has arrived
- **THEN** the submit control is disabled and shows a pending label

### Requirement: Unknown email and wrong password are indistinguishable

An unknown email returns **404** (`Record not found`) and a wrong password returns **401**. The login form SHALL render one identical generic message for both, so the form cannot be used to enumerate which email addresses have accounts.

#### Scenario: Unknown email

- **WHEN** login fails with HTTP 404
- **THEN** the form shows "Incorrect email or password."

#### Scenario: Wrong password

- **WHEN** login fails with HTTP 401
- **THEN** the form shows the identical message, with no wording or timing difference

#### Scenario: Suspended or non-admin account

- **WHEN** login fails with HTTP 403
- **THEN** the backend's message is displayed directly, because 403 messages are written for humans and tell the admin what to do

### Requirement: Sessions live in Next-set httpOnly cookies

The backend sets its own `accessToken`/`refreshToken` cookies with `secure:false` combined with `sameSite:'none'`, a combination browsers reject. The frontend SHALL ignore those cookies entirely and SHALL write its own `httpOnly`, `sameSite:'lax'`, path-`/` cookies from the Next server, marked `secure` in production.

#### Scenario: Cookie lifetime

- **WHEN** session cookies are written
- **THEN** their `maxAge` is 7 days, matching the refresh token's database row expiry rather than the longer `JWT_REFRESH_EXPIRES_IN`

#### Scenario: Token never reaches client JavaScript

- **WHEN** a session is active
- **THEN** neither token is readable from `document.cookie` nor present in any client bundle or serialized payload

### Requirement: Authorization is enforced in the data access layer

`proxy.ts` SHALL perform an optimistic redirect based only on the presence of a session cookie, to avoid a flash of dashboard chrome. It SHALL NOT be treated as the authorization boundary. The authoritative check SHALL be `requireSession()`, called in the dashboard layout and by every authenticated data-access function, and memoized per render pass.

#### Scenario: No session cookie

- **WHEN** an anonymous visitor requests a dashboard route
- **THEN** `proxy.ts` redirects to `/login` before the page renders

#### Scenario: Forged or stale cookie present

- **WHEN** a request carries a session cookie that the backend rejects
- **THEN** `proxy.ts` lets it through, and `requireSession()` plus the client's refresh path redirect to `/login`
- **AND** no dashboard data is rendered

#### Scenario: Already signed in

- **WHEN** a visitor with a session cookie requests `/login`
- **THEN** they are redirected to the dashboard

#### Scenario: Repeated checks in one render

- **WHEN** the layout and three data functions each call `requireSession()` during one render pass
- **THEN** the cookie jar is read once

### Requirement: Logout is best-effort server-side and unconditional client-side

Logout SHALL call `POST /api/auth/logout` to delete the refresh row, and SHALL clear the local session cookies and redirect to `/login` regardless of whether that call succeeded.

#### Scenario: Backend unreachable during logout

- **WHEN** `POST /auth/logout` throws or times out
- **THEN** the local cookies are still cleared and the user still lands on `/login`

### Requirement: Public routes are exempt from the session guard

The attendance form and the login page SHALL be reachable without a session and SHALL NOT trigger `requireSession()`.

#### Scenario: Student opens the attendance form

- **WHEN** an unauthenticated visitor opens `/attendance`
- **THEN** the form renders normally with no redirect
