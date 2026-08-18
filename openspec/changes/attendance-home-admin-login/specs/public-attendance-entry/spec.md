## ADDED Requirements

### Requirement: Site root serves the attendance form

The site root (`/`) SHALL render the public attendance submission form directly. It MUST NOT redirect to the dashboard, to a sign-in page, or to any other path.

#### Scenario: Anonymous visitor opens the bare domain

- **WHEN** a visitor with no session cookie requests `/`
- **THEN** the response is HTTP 200 and the body is the attendance submission form
- **AND** the browser address bar still reads `/` — no redirect occurred

#### Scenario: Signed-in admin opens the bare domain

- **WHEN** a visitor holding a valid `dm_access` cookie requests `/`
- **THEN** the response is the same attendance form served to anonymous visitors
- **AND** no dashboard chrome, navigation, or admin identity is rendered

### Requirement: The attendance form requires no session

The attendance surface SHALL be reachable identically with or without an admin session cookie. It MUST NOT invoke `requireSession()` and MUST NOT be matched by the proxy's authentication matcher.

#### Scenario: Expired session cookie present

- **WHEN** a visitor requests `/` carrying an expired or malformed `dm_access` cookie
- **THEN** the attendance form renders normally
- **AND** the visitor is not redirected to any sign-in page

#### Scenario: Proxy matcher excludes the root

- **WHEN** the proxy `config.matcher` is evaluated
- **THEN** `/` is not among the matched paths
- **AND** requests to `/` bypass the proxy's session and refresh logic entirely

### Requirement: Legacy `/attendance` URL resolves to the root

The path `/attendance` SHALL respond with an HTTP 308 permanent redirect to `/`, so that links already distributed in Discord continue to reach the form and resolve to one canonical URL.

#### Scenario: Student follows an old Discord link

- **WHEN** a visitor requests `/attendance`
- **THEN** the response is HTTP 308 with `Location: /`
- **AND** following the redirect renders the attendance form

#### Scenario: Query parameters survive the redirect

- **WHEN** a visitor requests `/attendance?foo=bar`
- **THEN** the redirect target preserves the query string

### Requirement: The public surface exposes no admin entry point

The attendance form and its layout SHALL contain no link, button, or hidden markup referencing the admin sign-in path or the dashboard. The admin login MUST be reachable only by typing its URL.

#### Scenario: Rendered homepage markup contains no admin path

- **WHEN** the HTML served at `/` is inspected
- **THEN** it contains no occurrence of `/login-admin`, `/login`, or `/dashboard`

### Requirement: Attendance page metadata reflects its new location

The root route SHALL carry the attendance page's own title and description metadata, since it is now the site's homepage rather than a nested page.

#### Scenario: Homepage document title

- **WHEN** a visitor loads `/`
- **THEN** the document title is the attendance title, not a dashboard or generic app title
