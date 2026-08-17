## ADDED Requirements

### Requirement: Signed-in admin identity

The system SHALL read the signed-in admin from `GET /api/users/me` and display their name and email in the app shell. Because every authenticated request bumps `lastActiveAt`, this read SHALL NOT be cached across requests; it SHALL be memoized per render pass so the layout and the header share one call.

#### Scenario: Header renders identity

- **WHEN** any dashboard page renders
- **THEN** the header shows the admin's name and email from `/users/me`

#### Scenario: Layout and header both need the admin

- **WHEN** two server components in one render pass request the current admin
- **THEN** exactly one `GET /users/me` request is issued

### Requirement: Profile editing

The system SHALL provide a settings form submitting `name`, `email`, `profilePhoto` and `bio` to `PUT /api/users/my-profile`. Every field is optional; the form SHALL omit blank fields rather than sending empty strings, since blanks would fail the backend's URL and length rules.

#### Scenario: Partial update

- **WHEN** the admin changes only their bio and submits
- **THEN** the request body contains only `bio`
- **AND** on success the affected page is revalidated so the header shows fresh values

#### Scenario: Client-side validation before submit

- **WHEN** the admin enters a name shorter than 2 characters, a bio over 500 characters, or a malformed photo URL
- **THEN** the form blocks submission and shows the error next to the offending field

### Requirement: Profile error handling

The form SHALL distinguish the three documented failure modes and render copy specific to each.

#### Scenario: Validation rejection

- **WHEN** the backend returns 400 with field issues
- **THEN** each issue is mapped to its input and displayed inline

#### Scenario: Email already taken

- **WHEN** the backend returns 409 `Duplicate Error`
- **THEN** the email field shows that the address already belongs to another account

#### Scenario: Missing profile row

- **WHEN** the backend returns 404 because the admin account has no `profiles` row
- **THEN** the form explains that the account is missing its profile record and that photo and bio cannot be saved until it is created, rather than showing a bare "not found"
