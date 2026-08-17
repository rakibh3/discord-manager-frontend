## ADDED Requirements

### Requirement: Target preview precedes every send

The system SHALL require a dry run against `GET /api/reminders/targets?date=YYYY-MM-DD` before a broadcast can be sent, and SHALL show the resulting `targetCount` in the confirmation. The preview uses the same query as the send, so the two cannot disagree.

#### Scenario: Preview is loaded

- **WHEN** the admin picks a date
- **THEN** the target count for that date is fetched and displayed
- **AND** the send control stays disabled until a preview for the currently-selected date exists

#### Scenario: Date changed after preview

- **WHEN** the admin changes the date after previewing
- **THEN** the stale preview is discarded and the send control is disabled again

#### Scenario: Large target list

- **WHEN** the preview returns thousands of targets, which the endpoint returns unpaginated
- **THEN** the UI shows `targetCount` with a bounded preview slice or a virtualized list, and never renders thousands of rows unvirtualized

#### Scenario: Future date rejected

- **WHEN** the admin selects a date in the future, judged in Asia/Dhaka
- **THEN** the date control prevents it before a request is sent

### Requirement: Sending a broadcast is explicit, dated and confirmed

`POST /api/reminders/send` DMs thousands of people and cannot be undone. `date` SHALL always be sent explicitly and SHALL never be inferred, because an inferred date near midnight would remind the wrong day's members. The send SHALL be gated behind a confirmation that names the date and the exact recipient count.

#### Scenario: Confirmed send

- **WHEN** the admin confirms a send for a previewed date
- **THEN** `date` and `message` are posted
- **AND** on 202 the admin is taken to that broadcast's progress view

#### Scenario: Message length

- **WHEN** the admin composes the message
- **THEN** a live counter shows the remaining characters against the **1970**-character cap, and submission is blocked past it
- **AND** the cap is explained as Discord's 2000-character limit minus the fixed reminder heading

#### Scenario: Empty message

- **WHEN** the message is blank or whitespace only
- **THEN** submission is blocked before a request is sent

#### Scenario: Nobody to remind

- **WHEN** the send returns 400 because every member already submitted
- **THEN** the UI presents this as a success-adjacent outcome — there is nobody to remind — not as a red error

#### Scenario: Broadcast already running for that date

- **WHEN** the send returns 409
- **THEN** the backend's message, which includes the existing broadcast's id, is shown
- **AND** the UI links to that existing broadcast's progress view

#### Scenario: Redis unavailable

- **WHEN** the send returns 503
- **THEN** the UI states that the reminder queue is unreachable, that the broadcast was auto-cancelled so the date is not left blocked, and that the API, bot, ingestion and channel scheduler are unaffected

#### Scenario: Double submission

- **WHEN** the confirm control is activated twice in quick succession
- **THEN** only one request is issued

### Requirement: Delivery has not happened when the send returns

A 202 means the jobs were queued, nothing more. Delivery is paced at `dmPerSecond`, so a full guild takes roughly 40 minutes. The UI SHALL state this at the moment of queuing rather than implying the reminders were sent.

#### Scenario: Queued confirmation copy

- **WHEN** a broadcast is queued
- **THEN** the confirmation says delivery is paced and running in the background, and gives an estimate derived from `targetCount / dmPerSecond`

### Requirement: Live progress polling

The system SHALL render progress from `GET /api/reminders/:id`, server-rendering the first read so there is no empty flash, then polling every 2–3 seconds through a same-origin route handler while the status is `PENDING` or `PROCESSING`. Polling SHALL stop as soon as the status is terminal.

#### Scenario: Progress bar

- **WHEN** progress is displayed
- **THEN** the bar is driven by `delivered + dmClosed + failed` against `targetCount`, which the four counts are guaranteed to sum to
- **AND** each of the four counts is also shown numerically

#### Scenario: Slow-moving bar is explained

- **WHEN** a large broadcast is in flight
- **THEN** an estimated time remaining is shown from `outstanding / dmPerSecond`, so a bar that barely moves reads as the rate limiter working rather than as a stall

#### Scenario: Terminal status reached

- **WHEN** the status becomes `COMPLETED`, `CANCELLED` or `FAILED`
- **THEN** polling stops and the final counts remain displayed

#### Scenario: A poll fails

- **WHEN** one poll request errors
- **THEN** the last known progress stays on screen and the next tick retries, without surfacing an error page

### Requirement: Statuses are labelled by what they mean operationally

The UI SHALL translate each status and delivery outcome into wording that does not misattribute blame.

#### Scenario: DMs closed

- **WHEN** a recipient's status is `DM_CLOSED`
- **THEN** it is labelled "DMs closed — mentioned in channel" and counted separately from failures

#### Scenario: Cancelled broadcast

- **WHEN** a broadcast's status is `CANCELLED`
- **THEN** its `outstanding` recipients are labelled "never attempted", not "failed" or "pending"

#### Scenario: Failed broadcast

- **WHEN** a broadcast's status is `FAILED`
- **THEN** the UI states that the queue drained while recipients were still pending, indicating a stalled or crashed worker that needs investigation

### Requirement: Recipient audit

The system SHALL provide a paginated recipient list from `GET /api/reminders/:id/recipients`, filterable by `PENDING`, `DELIVERED`, `DM_CLOSED` and `FAILED`, showing each member's Discord username, display name, outcome, error message and sent time.

#### Scenario: Filtering and paging

- **WHEN** the admin filters by `DM_CLOSED` and moves to page 2
- **THEN** the request carries `status`, `page` and `limit`, and the total from `meta` drives the pager

#### Scenario: Contact details absent

- **WHEN** the recipient list renders
- **THEN** no phone or email is shown, because this is the delivery audit and the backend deliberately does not expose them

### Requirement: Broadcast history

The system SHALL list past broadcasts from `GET /api/reminders`, newest first, paginated, showing date, status, target and sent and failed counts, who created it, and its timings.

#### Scenario: Deleted creator

- **WHEN** `createdBy` is `null` because the admin account was deleted
- **THEN** the row renders as an unattributed broadcast rather than blank or "undefined"

#### Scenario: Outcome trend

- **WHEN** history is displayed
- **THEN** a chart from the `@bklit` registry plots delivered, DMs-closed and failed counts per broadcast date, with its data also available as text

### Requirement: Cancelling an in-flight broadcast

The system SHALL offer cancellation via `POST /api/reminders/:id/cancel` for broadcasts that are `PENDING` or `PROCESSING`, behind a confirmation explaining that recipients already reached are unaffected and the remainder will never be attempted.

#### Scenario: Cancel succeeds

- **WHEN** cancellation returns 200
- **THEN** the returned payload, already showing `CANCELLED`, replaces the displayed progress and polling stops

#### Scenario: Already finished

- **WHEN** cancellation returns 409 because the broadcast is already terminal
- **THEN** the backend's message is shown and the displayed status is refreshed

### Requirement: Queue and worker health

The system SHALL display `GET /api/reminders/status` on the reminders page, polled every 10 seconds, showing worker state, Redis connectivity, the configured DM rate, and queue depth.

#### Scenario: Redis down

- **WHEN** `redisConnected` is `false`
- **THEN** the panel states that sending is unavailable and will return 503, and explicitly says the API, bot, ingestion and scheduler keep working so nobody restarts the server
- **AND** the send control is disabled with that reason given

#### Scenario: Queue unreachable

- **WHEN** `queueDepth` is `null`
- **THEN** the UI reports that the queue could not be reached rather than rendering zeros

#### Scenario: Fallback announcement blocked

- **WHEN** `lastFallback.missingPermission` is `true`
- **THEN** an error banner states that the channel announcement reached nobody — precisely the members whose DMs were closed — and that the bot needs `Send Messages` on `#daily-update-reminder`
