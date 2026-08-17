## ADDED Requirements

### Requirement: The daily-status feature is gated on backend availability

The per-member daily status view, the overview counts, search and filter, the member detail view and CSV/Excel export depend on endpoints that do not exist on the backend today — they live only in the repository layer and are exposed over no HTTP route. This capability SHALL ship its types and data-access functions written to the documented contract, and SHALL be disabled behind a single configuration flag that defaults to off.

#### Scenario: Flag is off

- **WHEN** the feature flag is disabled
- **THEN** the daily-status page renders an explanatory state saying the backend endpoints are not yet available
- **AND** no request is made to any non-existent path, so no `API Not Found!` 404 is ever produced

#### Scenario: Flag is on

- **WHEN** the flag is enabled after the backend ships the endpoints
- **THEN** the page reads live data through the same data-access functions with no further UI changes required

#### Scenario: Numbers are never fabricated

- **WHEN** the feature is disabled
- **THEN** no placeholder, sample or mock figures are displayed anywhere that a real metric would appear

### Requirement: Overview metrics come from one source

When enabled, the overview figures — total members, attendance submitted, daily update submitted, both complete, missing update only, missing attendance only, and missing both — SHALL all be read from the single counts endpoint. They interlock and must agree, so the frontend SHALL NOT assemble any of them from the reminder targets list or any other endpoint.

#### Scenario: Counts are displayed

- **WHEN** the counts read succeeds for a date
- **THEN** each figure is shown with both its absolute value and its percentage of the total

#### Scenario: A figure is requested from elsewhere

- **WHEN** a similar-looking number is available from the reminder targets endpoint
- **THEN** it is not substituted into the overview, because the two are computed differently and would disagree

### Requirement: Overview visualization

When enabled, the status breakdown SHALL be visualized with charts from the `@bklit` registry — a part-to-whole view of the four statuses for the selected day, and a trend over recent days — with the same figures also available as text.

#### Scenario: Status breakdown

- **WHEN** the overview renders for a date
- **THEN** a part-to-whole chart shows complete, missing update, missing attendance and missing both, each labelled rather than distinguished by color alone

#### Scenario: Zero state

- **WHEN** every count for a date is zero
- **THEN** the chart area shows an explicit empty state rather than an empty or misleading plot

### Requirement: Member status table

When enabled, the system SHALL list members for a selected Asia/Dhaka date with their status, paginated server-side, filterable by status, and searchable by name, phone, email or Discord username.

#### Scenario: Date selection

- **WHEN** the admin picks a previous date
- **THEN** the date is sent as an Asia/Dhaka `YYYY-MM-DD` value and the whole page reflects that day
- **AND** the selected date is reflected in the URL so the view can be shared and reloaded

#### Scenario: Filter and search combine

- **WHEN** a status filter and a search term are both active
- **THEN** both are sent to the server and the pager reflects the filtered total

#### Scenario: Large result sets

- **WHEN** the guild has thousands of members
- **THEN** rows are paginated or virtualized and never all rendered at once

### Requirement: Member detail view

When enabled, selecting a member SHALL show their name, phone, email, attendance submission time, and that day's Discord messages with timestamps, all rendered in Asia/Dhaka.

#### Scenario: Member with no update

- **WHEN** the selected member submitted attendance but posted no message
- **THEN** the detail view states that explicitly rather than showing an empty message area

#### Scenario: Dismissal restores focus

- **WHEN** the detail view is closed
- **THEN** focus returns to the row that opened it

### Requirement: Export

When enabled, the system SHALL export the currently filtered result set as CSV or Excel, honouring the active date, status filter and search term rather than exporting everything.

#### Scenario: Filtered export

- **WHEN** the admin exports while filtered to missing-update members for a date
- **THEN** the file contains exactly that filtered set

#### Scenario: Export while disabled

- **WHEN** the feature flag is off
- **THEN** the export control is absent rather than present and broken
