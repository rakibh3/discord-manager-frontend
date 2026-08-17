## ADDED Requirements

### Requirement: Public attendance form

The system SHALL serve an unauthenticated form at `/attendance` collecting exactly four fields — full name, phone number, email and Discord username — outside the dashboard's session guard and app shell. Calls from this page SHALL go browser-direct to the backend using the public base URL, because verification fires on a keystroke debounce and routing it through the Next server would double latency for an endpoint that is public by design.

#### Scenario: Anonymous access

- **WHEN** a student with no session opens `/attendance`
- **THEN** the form renders with no redirect and no dashboard navigation

#### Scenario: Mobile use

- **WHEN** the form is used on a phone
- **THEN** every field and control is usable at 320 px width with targets of at least 44×44 px, and inputs declare appropriate types and input modes so the correct keyboard appears

### Requirement: Discord username validation matches the backend exactly

The username SHALL be normalized by trimming, stripping leading `@`, and lowercasing, then validated against `/^(?!.*\.{2})[a-z0-9_.]{2,32}$/`. A leading or trailing `_` or `.` is **valid** and SHALL NOT be rejected — an earlier stricter rule locked out 5.3% of real members.

#### Scenario: Leading or trailing separator

- **WHEN** the student enters `.rabbil`, `itzazad_` or `shahriarratul.`
- **THEN** the value passes client-side validation and is verified against the server

#### Scenario: Input is normalized before use

- **WHEN** the student types `@Rakib_Dev` with surrounding whitespace
- **THEN** `rakib_dev` is what is verified and submitted
- **AND** the student's own typing is not rewritten under their cursor

#### Scenario: Consecutive dots

- **WHEN** the entered handle contains `..`
- **THEN** it is rejected client-side with a format message and no request is sent

### Requirement: Debounced, abortable live verification

Verification SHALL call `GET /api/attendance/verify-user` no sooner than 500 ms after typing stops, and SHALL abort any in-flight verification when a new keystroke arrives, so a stale response can never overwrite a newer one. The per-IP budget is 60 requests per minute.

#### Scenario: Student types continuously

- **WHEN** a student types a 12-character handle without pausing
- **THEN** at most one verification request is issued

#### Scenario: Out-of-order responses

- **WHEN** a slow response for an earlier handle arrives after a newer request has started
- **THEN** the earlier response is discarded and does not change the displayed badge

#### Scenario: Rate limited

- **WHEN** verification returns 429
- **THEN** the UI says verification is temporarily unavailable, uses `RateLimit-Reset` to say when to retry, and still permits submission

### Requirement: Verification outcomes branch on the payload, not the status

`verify-user` answers **HTTP 200 even for an unknown handle**. The form SHALL branch on `data.verified` and SHALL distinguish a malformed handle (400) from a handle that is simply not in the server (200 with `verified: false`).

#### Scenario: Member found

- **WHEN** `verified` is `true` and `alreadySubmitted` is `false`
- **THEN** a verified badge shows the member's display name and avatar

#### Scenario: Not a server member

- **WHEN** `verified` is `false`
- **THEN** the form says the username was not found in the Discord server and suggests checking the spelling or joining first
- **AND** no partial member data is displayed, since `member` is always `null` in this case

#### Scenario: Already submitted today

- **WHEN** `alreadySubmitted` is `true`
- **THEN** the form states that attendance for that date is already recorded, presented as reassurance rather than an error

#### Scenario: Malformed handle rejected by the server

- **WHEN** verification returns 400
- **THEN** the message tells the student to fix what they typed, distinctly from the not-in-server case

### Requirement: Verification is an affordance, not a gate

If verification cannot complete for a network or rate-limit reason, the student SHALL still be able to submit. `POST /api/attendance/submit` re-runs every check server-side and is the real enforcement point.

#### Scenario: Verification request fails

- **WHEN** the verification call errors or times out
- **THEN** the form says it could not verify right now and that the student may still submit
- **AND** the submit control remains enabled

### Requirement: Field validation mirrors the backend

The form SHALL validate before submitting: name trimmed to 3–100 characters of Unicode letters and spaces; phone matching `^(?:\+?880|0)1[3-9]\d{8}$`; a valid email; and the username rule above.

#### Scenario: Bengali name accepted

- **WHEN** the student enters a name in Bengali script
- **THEN** it passes validation, because the rule is Unicode letters and not ASCII

#### Scenario: Phone prefixes

- **WHEN** the student enters `01711000000`, `+8801711000000` or `8801711000000`
- **THEN** all three are accepted and submitted exactly as typed
- **AND** a format hint showing `01711000000` is visible before an error occurs

#### Scenario: Errors are placed at the field

- **WHEN** validation fails
- **THEN** each message appears next to its input and is programmatically associated with it, not only in a summary at the top

### Requirement: Submission outcomes

The form SHALL disable submission while a request is in flight and SHALL NOT auto-retry a failed submission, because the entire budget is 5 attempts per 15 minutes per IP.

#### Scenario: Successful submission

- **WHEN** submission returns 201
- **THEN** a success state confirms the attendance date and the verified member, and the form is not left in a resubmittable state

#### Scenario: Already submitted

- **WHEN** submission returns 409
- **THEN** the outcome is presented as success-adjacent — the attendance is recorded — and the backend's message naming the date is shown

#### Scenario: Not in the server on the write path

- **WHEN** submission returns 404
- **THEN** the message says the student is not in the Discord server, distinct from the 400 "check what you typed" case

#### Scenario: Rate limited

- **WHEN** submission returns 429
- **THEN** the form states how long to wait using `RateLimit-Reset`, does not retry automatically, and does not clear the entered values

#### Scenario: Validation rejected server-side

- **WHEN** submission returns 400 with field issues
- **THEN** each issue is mapped to its input using the form's own copy rather than the title-cased server text

### Requirement: Username guidance

The form SHALL show, near the username field, how to find a Discord username — the lowercase handle after the `@` on the profile — so students do not enter their display name.

#### Scenario: Guidance is available before an error

- **WHEN** the form first renders
- **THEN** the guidance is visible or reachable without first triggering a validation failure
