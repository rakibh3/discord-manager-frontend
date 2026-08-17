## ADDED Requirements

### Requirement: Schedule and scheduler state are displayed

The system SHALL render `GET /api/schedule/daily-update` showing the stored open and close times, the active weekdays, whether the schedule is enabled, who last changed it and when, the next open and lock instants, the last run's outcome, and the channel's live open/closed state. All times SHALL be rendered in Asia/Dhaka.

#### Scenario: Live channel state is never cached

- **WHEN** the schedule page loads
- **THEN** the read runs uncached, because `channel.isOpen` is read live from Discord on every request and an admin may have flipped the overwrite by hand

#### Scenario: No next transition registered

- **WHEN** `nextOpenAt` or `nextLockAt` is `null`
- **THEN** the UI states that no transition is scheduled and why — the schedule is disabled, or this process is not scheduling — rather than rendering an empty value

#### Scenario: Scheduler disabled on this process

- **WHEN** `scheduler.processEnabled` is `false`
- **THEN** a notice explains that timed jobs are off on this process while the manual open and lock controls still work

### Requirement: Permission failures are diagnosable from the schedule page

`scheduler.lastRun.error` is where a missing `Manage Roles` permission first appears. The system SHALL display the last run's action, trigger, time and error, and SHALL translate a `DiscordAPIError[50013]` into a plain statement of the missing permission.

#### Scenario: Last scheduled open failed on permissions

- **WHEN** `lastRun.ok` is `false` and its error contains `50013`
- **THEN** the panel states that the bot lacks `Manage Roles` on the channel and that the channel will not open until it is granted

### Requirement: Schedule editing

The system SHALL provide an editor submitting `PATCH /api/schedule/daily-update` with any subset of `openTime`, `closeTime`, `daysOfWeek` and `enabled`. Times SHALL be entered through a time control and days through weekday checkboxes. A cron expression field SHALL NOT be exposed anywhere in the UI, and `timezone` SHALL never be sent.

#### Scenario: Times and days are edited

- **WHEN** the admin sets the open time, close time and weekday selection and saves
- **THEN** only the changed fields are sent
- **AND** the response payload — which already reflects the change and the reloaded scheduler — replaces the displayed state without a page reload

#### Scenario: Nothing changed

- **WHEN** the admin saves without changing anything
- **THEN** the form does not submit, because the backend rejects an empty patch with 400

#### Scenario: Close time not after open time

- **WHEN** the admin sets a close time that is not strictly later than the open time, judged against the stored values the change would merge into
- **THEN** the form blocks submission and explains the rule before a request is sent
- **AND** if the backend rejects it anyway, its explanatory 400 message is displayed

#### Scenario: At least one weekday

- **WHEN** the admin clears every weekday checkbox
- **THEN** the form blocks submission and states that at least one day is required

### Requirement: Manual open and lock require confirmation

`POST /api/schedule/daily-update/open` and `.../lock` force the channel state immediately and post an announcement embed that thousands of students see. Each SHALL be placed behind an explicit confirmation dialog naming the consequence. The stored schedule is untouched, and the UI SHALL say so.

#### Scenario: Admin confirms an override

- **WHEN** the admin activates the manual open control
- **THEN** a dialog states that an announcement embed will be posted to the channel and that the next scheduled transition still fires
- **AND** the request is sent only after explicit confirmation

#### Scenario: Admin dismisses the dialog

- **WHEN** the confirmation is dismissed
- **THEN** no request is sent and the channel state is unchanged

#### Scenario: Bot lacks Manage Roles

- **WHEN** the override returns 403
- **THEN** the backend's message, which names the permission to grant, is displayed directly

#### Scenario: Bot not connected

- **WHEN** the override returns 503
- **THEN** the UI reports that the bot is not connected or the permission edit failed, and the displayed channel state is refreshed rather than left showing an optimistic value
