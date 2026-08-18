## ADDED Requirements

### Requirement: Admin sign-in lives at `/login-admin`

The admin sign-in form SHALL be served at `/login-admin`. It MUST remain fully functional at that path — rendering the credential form, submitting to the sign-in action, and landing the authenticated admin on `/dashboard`.

#### Scenario: Admin types the URL directly

- **WHEN** a visitor with no session requests `/login-admin`
- **THEN** the response is HTTP 200 and the body is the admin sign-in form

#### Scenario: Successful sign-in

- **WHEN** an admin submits valid credentials on `/login-admin`
- **THEN** session cookies are set
- **AND** the admin is redirected to `/dashboard`

#### Scenario: Already-authenticated admin visits the sign-in page

- **WHEN** a visitor holding a valid `dm_access` cookie requests `/login-admin`
- **THEN** the proxy redirects them to `/dashboard` without rendering the form

### Requirement: The `/login` path is retired

The path `/login` SHALL NOT resolve. It MUST return HTTP 404 and MUST NOT redirect to `/login-admin`, so that the retired path does not disclose the new location.

#### Scenario: Old bookmark is opened

- **WHEN** a visitor requests `/login`
- **THEN** the response status is 404
- **AND** the response contains no reference to `/login-admin`

#### Scenario: Proxy no longer matches the old path

- **WHEN** the proxy `config.matcher` is evaluated
- **THEN** `/login` is absent and `/login-admin` is present

### Requirement: The admin sign-in is excluded from search indexes

The `/login-admin` route SHALL declare `noindex, nofollow` robots metadata so the admin entry point is not discoverable through search engines.

#### Scenario: Crawler reads the sign-in page

- **WHEN** the HTML served at `/login-admin` is inspected
- **THEN** it contains robots metadata specifying both `noindex` and `nofollow`

### Requirement: All authentication redirects target `/login-admin`

Every code path that sends an unauthenticated or de-authenticated user to a sign-in page SHALL target `/login-admin`. No `/login` string may remain in the proxy, the session guard, the API client, or the auth actions.

#### Scenario: Unauthenticated dashboard request

- **WHEN** a visitor with no session cookie requests any `/dashboard/*` path
- **THEN** the proxy redirects them to `/login-admin`

#### Scenario: Session guard rejects the render

- **WHEN** `requireSession()` finds no usable access token during a dashboard render
- **THEN** it redirects to `/login-admin`

#### Scenario: Backend returns 401

- **WHEN** an API client request receives HTTP 401 from the backend
- **THEN** the client redirects to `/login-admin`

#### Scenario: Admin signs out

- **WHEN** the sign-out action completes
- **THEN** the admin is redirected to `/login-admin`

#### Scenario: Refresh token is dead

- **WHEN** the proxy's refresh attempt fails for a request outside the sign-in page
- **THEN** the stale refresh cookie is deleted
- **AND** the request is redirected to `/login-admin`

#### Scenario: Refresh succeeds while sitting on the sign-in page

- **WHEN** the proxy successfully refreshes tokens for a request to `/login-admin`
- **THEN** the refreshed cookies are written to the response
- **AND** the visitor is redirected to `/dashboard`

### Requirement: The sign-in page does not link to the public form

The admin sign-in page SHALL NOT link to the attendance form. The two surfaces remain unlinked in both directions.

#### Scenario: Sign-in page markup

- **WHEN** the HTML served at `/login-admin` is inspected
- **THEN** it contains no anchor targeting `/` or `/attendance`
