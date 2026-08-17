## ADDED Requirements

### Requirement: Discord health overview

The system SHALL render `GET /api/discord/sync/status` as a health panel showing bot connection and tag, guild id, member totals (total / active / departed), and the last sync's timing, counts and error.

#### Scenario: Healthy state

- **WHEN** the bot is connected and the last sync succeeded
- **THEN** the panel shows the bot tag, the member counts, and when the last sync finished with its duration

#### Scenario: Member directory composition

- **WHEN** member counts are available
- **THEN** a chart from the `@bklit` registry shows the active-versus-departed split alongside the numeric totals

### Requirement: Silent outages are surfaced prominently

Three states in the status payload are invisible failures that no other screen reveals. Each SHALL be surfaced as a banner at the top of the dashboard, not buried in a detail panel, and each SHALL be worded to match its actual severity.

#### Scenario: Message Content intent missing

- **WHEN** `dailyUpdate.ingestionEnabled` is `false`
- **THEN** an error banner explains that no daily updates are being recorded and that every member will therefore appear as missing their update
- **AND** the payload's `reason` is shown along with a link to the Discord Developer Portal

#### Scenario: Departure guard tripped

- **WHEN** `lastSync.guardTripped` is `true`
- **THEN** a warning states that a reconcile was skipped because a member fetch came back suspiciously small, and that the directory is stale but intact
- **AND** the wording presents this as the guard working, not as a fault

#### Scenario: Bot disconnected

- **WHEN** `bot.connected` is `false`
- **THEN** an error banner states that sync, message ingestion, scheduled channel changes and reminder DMs are all down, while the REST API keeps serving
- **AND** controls that require the bot are disabled with that reason given

### Requirement: Manual member re-sync

The system SHALL provide a control that calls `POST /api/discord/sync`. The endpoint returns **202** before the work is done, so completion SHALL be determined by polling `GET /sync/status` until `lastSync.running` becomes `false`.

#### Scenario: Sync accepted

- **WHEN** the admin triggers a sync and receives 202
- **THEN** the UI shows the sync as running and begins polling status every 5 seconds
- **AND** the trigger control is disabled while `lastSync.running` is `true`

#### Scenario: Sync completes

- **WHEN** `lastSync.running` flips to `false`
- **THEN** polling stops
- **AND** the refreshed counts, duration and any `lastError` are shown

#### Scenario: Sync already running

- **WHEN** the trigger returns 409
- **THEN** the UI reports that a sync is already in progress and starts polling instead of treating it as an error

#### Scenario: Bot unavailable

- **WHEN** the trigger returns 503
- **THEN** the backend's message is shown, explaining that the bot is not connected or the guild could not be fetched

### Requirement: Polling stops when it is pointless

Status polling SHALL run only while a sync is in flight and SHALL be torn down when the component unmounts or the tab is hidden.

#### Scenario: Admin leaves the page mid-sync

- **WHEN** the admin navigates away while a sync is running
- **THEN** the polling interval and any in-flight request are cancelled
