## ADDED Requirements

### Requirement: A public page lets a visitor register while registration is open

The system SHALL serve a registration page that requires no session. While registration is open it SHALL present a form with a name, an email address, a phone number and a Discord username, each with a visible label. When the window state cannot be read, the page SHALL present the form.

#### Scenario: Registration open

- **WHEN** a visitor opens the registration page while registration is open
- **THEN** the form is shown, and the closing time is stated when one is set

#### Scenario: Window unreadable

- **WHEN** the window state cannot be read because the backend is unreachable
- **THEN** the form is shown

#### Scenario: No session

- **WHEN** a visitor with no admin session opens the registration page
- **THEN** the page renders without a redirect to the login page

### Requirement: Outside the window the page explains why the form is unavailable

The system SHALL replace the form with a message when registration is not open. The message SHALL distinguish registration that has not opened yet, naming the opening time, from registration that has closed, and SHALL NOT state a date when none is stored.

#### Scenario: Not yet open

- **WHEN** a visitor opens the page before the stored opening
- **THEN** the page states that registration has not opened yet and when it opens

#### Scenario: Closed

- **WHEN** a visitor opens the page after the stored closing
- **THEN** the page states that registration is closed and when it closed

#### Scenario: Switched off

- **WHEN** an administrator has registration switched off
- **THEN** the page states that registration is closed and names no date

### Requirement: The form validates input before submitting

The system SHALL validate the four fields in the browser with the same rules the backend applies, show each problem next to its field, and send no request while a field is invalid. It SHALL submit the normalized values.

#### Scenario: Empty submit

- **WHEN** a visitor submits the form with every field empty
- **THEN** each field shows its own message and no request is sent

#### Scenario: Malformed phone

- **WHEN** the phone is not a Bangladeshi mobile number
- **THEN** the phone field shows a message with an example and no request is sent

#### Scenario: Values normalized

- **WHEN** a visitor enters an email with surrounding spaces and capitals, a phone with a country code, and a username with a leading `@`
- **THEN** the submitted values are the trimmed lowercased email, the local phone form, and the lowercased username without the `@`

### Requirement: The submission goes directly from the browser to the backend

The system SHALL send the registration from the visitor's browser to the backend, and SHALL NOT route it through the application server.

#### Scenario: Submit

- **WHEN** a visitor submits a valid form
- **THEN** the browser sends the request to the backend's public registration endpoint

### Requirement: Every submission outcome is reported distinctly

The system SHALL report each outcome of a submission in its own terms, keep the entered values after any failure, and move focus to the message after a failure.

#### Scenario: Accepted

- **WHEN** the backend accepts the registration
- **THEN** the form is replaced by a confirmation naming the registrant and the address, and stating that a welcome email is on its way when one will be sent

#### Scenario: Already registered

- **WHEN** the backend answers that the address is already registered
- **THEN** a notice says so and that no further action is needed, without presenting it as an error

#### Scenario: Window closed since the page loaded

- **WHEN** the backend answers that registration is not open
- **THEN** a message says registration is not open

#### Scenario: Rate limited

- **WHEN** the backend answers that too many attempts were made
- **THEN** a message asks the visitor to wait, and the entered values remain in the form

#### Scenario: Backend rejects a field

- **WHEN** the backend answers with a validation error naming a field
- **THEN** that field shows the application's own message for it

#### Scenario: Network failure

- **WHEN** the request cannot reach the backend
- **THEN** a message says the server could not be reached and the entered values remain

### Requirement: Administrators control the registration window from the dashboard

The system SHALL provide a dashboard page, requiring an admin session, on which an administrator can switch registration on or off, set or clear the opening and closing date and time, choose whether registrations are added to the roster automatically, choose whether welcome emails are sent, and set the Discord invite link. The page SHALL show the stored state of the form, and SHALL save only the settings that changed.

#### Scenario: Stored state shown

- **WHEN** an administrator opens the page
- **THEN** it shows whether the form is open now, not open yet, closed, or switched off, as stored

#### Scenario: Unsaved change

- **WHEN** an administrator changes a setting without saving
- **THEN** the stored state shown does not change, and saving is available

#### Scenario: Invalid window

- **WHEN** an administrator sets a date without its time, or a closing at or before the opening
- **THEN** the problem is shown and nothing is saved

#### Scenario: Save

- **WHEN** an administrator saves a valid change
- **THEN** only the changed settings are sent, and the page reflects the saved values

#### Scenario: Settings unreadable

- **WHEN** the settings cannot be read
- **THEN** the page shows an error rather than a form filled with placeholder values

### Requirement: The dashboard reports whether welcome emails can be sent

The system SHALL warn on the dashboard page when the backend cannot send mail, naming what is missing; when sandbox mode is diverting mail to a test inbox; and when the email queue is unavailable. While emails cannot be sent, the controls that send them SHALL be disabled with the reason stated in text.

#### Scenario: Mail not configured

- **WHEN** welcome emails are enabled and the backend reports mail is not configured
- **THEN** a warning names the missing settings, and the resend and retry controls are disabled with that reason

#### Scenario: Sandbox mode

- **WHEN** the backend reports sandbox mode
- **THEN** a warning states that emails go to a test inbox and not to registrants

### Requirement: Administrators can review and act on registrations

The system SHALL list registrations with name, email, phone, Discord username, roster status, welcome-email status and registration time, with search, a roster filter, an email-status filter and paging. A failed welcome email SHALL show its reason. An administrator SHALL be able to add one or all pending registrations to the roster, resend one welcome email, retry all unsent emails after confirming the number, and download the filtered list as CSV.

#### Scenario: Failed email

- **WHEN** a registration's welcome email failed
- **THEN** its row shows the failure reason in text

#### Scenario: Filter

- **WHEN** an administrator filters by email status and searches
- **THEN** only matching registrations are listed, and the address bar carries the filters

#### Scenario: Add all pending

- **WHEN** an administrator adds all pending registrations to the roster
- **THEN** the result states how many were added and how many could not be because of a removed roster entry

#### Scenario: Retry unsent

- **WHEN** an administrator retries unsent emails
- **THEN** a confirmation states how many emails will be sent before anything is queued

#### Scenario: Export

- **WHEN** an administrator downloads the CSV with filters applied
- **THEN** the file contains the registrations matching those filters

#### Scenario: Export without a session

- **WHEN** the export address is requested without an admin session
- **THEN** no data is returned
