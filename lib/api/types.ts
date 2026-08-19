/** Wire types transcribed from `API_INTEGRATION.md` §7.1 — every `| null` here
 *  is a value the API really produces and the UI has to render something for. */

/** Every successful response is wrapped in this; the payload is always under
 *  `data`. `meta` appears only on paginated lists. Error bodies differ. */
export type ApiResponse<T> = {
  success: boolean;
  statusCode: number;
  message?: string;
  meta?: PaginationMeta;
  data: T;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
};

// ── Multiple Discord servers (API_INTEGRATION.md §5A) ────────────────────────

/** The smallest reference to a configured server. Every row, message and
 *  fan-out result carries one, so the UI never has to look a guild ID up. */
export type ServerRef = { guildId: string; label: string };

/** `GET /api/discord/servers` — build every server filter from this rather than
 *  hard-coding IDs. A single-server deployment returns exactly one entry, which
 *  is the normal case rather than a separate mode. */
export type DiscordServer = ServerRef & {
  /** The live guild name; `null` while the bot cannot reach the guild. */
  name: string | null;
  reachable: boolean;
  unreachableReason: string | null;
};

/** One server's outcome inside a fan-out action. `ok: false` travels inside an
 *  HTTP 200 — a failure here is not an error status. */
export type FanOutServer<T> = ServerRef & {
  ok: boolean;
  value?: T;
  error?: string | null;
  channelId?: string | null;
};

/** ⚠️ `failed > 0` with `success: true` is the whole point of this shape. */
export type FanOutSummary = {
  total: number;
  succeeded: number;
  failed: number;
};

/** Optional on every payload: a deployment that predates the fan-out still
 *  answers with the flat single-server fields, which `lib/api/fan-out.ts`
 *  normalizes into this shape. */
export type FanOutFields<T> = {
  summary?: FanOutSummary;
  servers?: FanOutServer<T>[];
};

// ── Auth ─────────────────────────────────────────────────────────────────────

export type TokenPair = { accessToken: string; refreshToken: string };

/** Students are `discord_members` rows, not `users` — only admins can log in. */
export type UserRole = "ADMIN";

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BANNED";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  /** Bumped by every authenticated request, so this value is never cacheable. */
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminProfile = {
  id: string;
  userId: string;
  profilePhoto: string | null;
  bio: string | null;
  dateOfBirth: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
};

/** `GET /users/me` does **not** include `profile`; only `PUT /users/my-profile`
 *  returns it, and a hand-inserted admin may have no profile row at all. */
export type AdminUserWithProfile = AdminUser & { profile: AdminProfile | null };

// ── Discord ──────────────────────────────────────────────────────────────────

export type SyncState = {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  fetched: number;
  synced: number;
  failed: number;
  markedDeparted: number;
  /** The departure guard skipped a reconcile after a suspiciously small member
   *  fetch: the directory is stale but intact — the guard working, not a fault. */
  guardTripped: boolean;
  lastError: string | null;
};

export type MemberCounts = { total: number; active: number; departed: number };

/** Every server names its channels identically, so a swapped channel ID is
 *  invisible in configuration *and* in Discord. This check is the only place it
 *  shows up — when one server goes quiet, read `verified` first. */
export type ChannelVerification = {
  id: string | null;
  verified: boolean;
  /** The reason it failed verification; `null` when it verified. */
  error: string | null;
};

/** One configured server inside `GET /api/discord/sync/status`. */
export type DiscordServerStatus = ServerRef & {
  name: string | null;
  reachable: boolean;
  unreachableReason: string | null;
  /** What Discord reports live, against `members` which is what we stored. */
  discordMemberCount: number | null;
  members: MemberCounts;
  channels: {
    attendance: ChannelVerification;
    dailyUpdate: ChannelVerification;
    reminder: ChannelVerification;
  };
  verifiedAt: string | null;
  lastSync: SyncState;
};

/** ⚠️ There is **no top-level `lastSync`** and no `bot.guildId`: sync state is
 *  per server, because one server tripping its departure guard or failing
 *  channel verification leaves every other server looking perfectly healthy.
 *  Use `aggregateSyncState()` where a single combined reading is wanted. */
export type DiscordSyncStatus = {
  bot: {
    connected: boolean;
    tag: string | null;
    configuredServers: number;
    reachableServers: number;
  };
  /** Summed across every configured server. Counts memberships, not people. */
  members: MemberCounts;
  servers: DiscordServerStatus[];
  dailyUpdate: {
    /** `false` means the bot logged in without the Message Content intent, so
     *  no daily update is being recorded at all. Silent, and catastrophic. It is
     *  a property of the connection, so it is reported once rather than per
     *  server. */
    ingestionEnabled: boolean;
    reason: string | null;
  };
};

/** `POST /discord/sync` answers 202 — nothing has happened yet. Poll status.
 *  Takes an optional `guildId` (singular) to sync one server. */
export type SyncTriggerResult = {
  /** Guild IDs whose sync actually started. */
  accepted: string[];
  /** Servers left alone, each with the reason — a sync already running, or a
   *  guild that could not be fetched. Not an error: the others still ran. */
  skipped: { guildId: string; reason: string }[];
  startedAt?: string;
};

// ── Schedule ─────────────────────────────────────────────────────────────────

export type ScheduleLastRun = {
  action: "open" | "lock" | "reconcile";
  trigger: "schedule" | "reconcile" | "manual";
  ranAt: string;
  ok: boolean;
  /** Where a missing `Manage Roles` permission first becomes visible. */
  error: string | null;
};

/** One configured server's live `#daily-update` state. Flat, not nested: this
 *  is exactly the shape `GET /api/schedule/daily-update` returns. */
export type ScheduleServerState = ServerRef & {
  channelId: string | null;
  /** Read live from Discord per request. ⚠️ `null` means it could not be read —
   *  unknown, which is not the same as locked and must not render as one. */
  isOpen: boolean | null;
  lastRun: ScheduleLastRun | null;
};

/** ⚠️ There is **no top-level `channel`**: one schedule drives every server, but
 *  each channel is opened and locked separately and they can disagree. The
 *  combined reading is derived from `servers[]`, never reported as a fact. */
export type ChannelSchedulePayload = {
  schedule: {
    /** `HH:mm` wall clock, Asia/Dhaka. **Read-only.** It mirrors the attendance
     *  announcement's `announceTime` — the channel opens at the moment the
     *  announcement is posted — and moves only when that time is changed at
     *  `PATCH /announcement/attendance`. Sending it here is a 400, not a silent
     *  no-op, so a form can never report a save that did not move the window. */
    openTime: string;
    /** Always `"ANNOUNCEMENT"`. Present so the open-time field can be rendered
     *  non-editable from the payload itself rather than from a hard-coded rule. */
    openTimeSource: "ANNOUNCEMENT";
    closeTime: string;
    /** 0 = Sunday … 6 = Saturday. */
    daysOfWeek: number[];
    enabled: boolean;
    /** Reported back to us, never sent — Zod strips it silently. */
    timezone: "Asia/Dhaka";
    updatedAt: string;
    updatedBy: { id: string; name: string; email: string } | null;
  };
  scheduler: {
    /** `SCHEDULER_ENABLED` on the serving process. Manual open/lock still work. */
    processEnabled: boolean;
    running: boolean;
    /** `null` when no task is registered — a disabled schedule, or a non-scheduling process. */
    nextOpenAt: string | null;
    nextLockAt: string | null;
    /** Keyed by guild ID, for the same reason the state is: one server's
     *  success must not overwrite another's missing-permission failure. */
    lastRunByGuild: Record<string, ScheduleLastRun>;
  };
  servers: ScheduleServerState[];
};

/** `POST /schedule/daily-update/open` and `/lock` fan out to every configured
 *  server. ⚠️ Partial success is HTTP 200 — read `summary.failed`, never the
 *  status code alone. */
export type ChannelToggleResult = {
  isOpen: boolean;
  summary: FanOutSummary;
  servers: (FanOutServer<{ announced: boolean }> & {
    channelId: string | null;
  })[];
};

/** A patch body. Every field optional, but an empty object is rejected (400).
 *
 *  ⚠️ No `openTime`: it follows the announcement time and the backend **rejects**
 *  the field outright. Move it at `PATCH /announcement/attendance` instead. */
export type SchedulePatch = {
  closeTime?: string;
  daysOfWeek?: number[];
  enabled?: boolean;
};

// ── Attendance announcement ──────────────────────────────────────────────────

/** The only tokens a template body may contain; anything else is a 400. Left in,
 *  an unknown placeholder would reach ~5,000 students as literal characters. */
export type AnnouncementPlaceholder =
  | "{{date}}"
  | "{{close_time}}"
  | "{{daily_update_channel_id}}"
  | "{{attendance_form_link}}"
  | "{{termination_day}}";

export type ResolvedMentions = {
  roleIds: string[];
  userIds: string[];
  /** Entries that no longer resolve, as `role:<id>` / `user:<handle>`. */
  unresolved: string[];
};

export type AnnouncementAttemptStatus = "SENDING" | "POSTED" | "FAILED";

export type AnnouncementAttempt = {
  attempt: number;
  /** Stuck on `SENDING` means a crash between the day-claim and the post. */
  status: AnnouncementAttemptStatus;
  trigger: "SCHEDULED" | "MANUAL";
  discordMessageId: string | null;
  unresolvedTargets: string[];
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnnouncementDispatchResult =
  | {
      status: "posted";
      announcementDate: string;
      attempt: number;
      messageId: string;
      unresolvedTargets: string[];
    }
  | {
      status: "already-sent";
      announcementDate: string;
      attempt: number;
      postedAt: string;
    }
  | { status: "disabled" }
  | {
      status: "failed";
      announcementDate: string;
      error: string;
      missingPermission: boolean;
      notConnected: boolean;
    };

export type AnnouncementPayload = {
  template: {
    /** The **raw** body, placeholders unexpanded — round-tripping
     *  `preview.content` back through a save would bake today's date in. */
    body: string;
    terminationDays: number;
    /** Pings the entire guild every evening until turned off. A literal
     *  `@everyone` in the body is inert; `allowedMentions` uses this flag alone. */
    mentionEveryone: boolean;
    mentionRoleIds: string[];
    mentionUsernames: string[];
    updatedAt: string;
    updatedBy: { id: string; name: string; email: string } | null;
  };
  schedule: {
    /** `HH:mm` wall clock, Asia/Dhaka. */
    announceTime: string;
    /** 0 = Sunday … 6 = Saturday. */
    daysOfWeek: number[];
    enabled: boolean;
    /** Reported back to us, never sent — Zod strips it silently. */
    timezone: "Asia/Dhaka";
  };
  preview: {
    /** Exactly what would be posted right now, mention line included. */
    content: string;
    length: number;
    limit: 2000;
    /** Read from the `#daily-update` schedule, not stored on the template. */
    closeTime: string;
    mentions: ResolvedMentions;
  };
  supportedPlaceholders: AnnouncementPlaceholder[];
  scheduler: {
    /** `SCHEDULER_ENABLED` on the serving process. Manual send still works. */
    processEnabled: boolean;
    running: boolean;
    nextRunAt: string | null;
    /** Where a missing `Send Messages` permission first becomes visible, keyed
     *  per guild — a single slot would let a healthy server's success overwrite
     *  the failing server's reason. */
    lastOutcomeByGuild: Record<string, AnnouncementOutcome>;
  };
  /** ⚠️ There is **no top-level `channel`** and **no `today.attempts`**: both
   *  are per server, since each server has its own channel and its own
   *  once-per-day claim. */
  today: {
    /** `YYYY-MM-DD`, Dhaka. */
    date: string;
    /** ⚠️ True only when **every** configured server has today's message. */
    posted: boolean;
    servers: AnnouncementServerToday[];
  };
};

export type AnnouncementOutcome = {
  ranAt: string;
  trigger: "SCHEDULED" | "MANUAL";
  result: AnnouncementDispatchResult;
};

export type AnnouncementServerToday = ServerRef & {
  posted: boolean;
  channelId: string | null;
  attempts: AnnouncementAttempt[];
  lastOutcome: AnnouncementOutcome | null;
};

export type AnnouncementPreview = {
  content: string;
  length: number;
  limit: 2000;
  withinLimit: boolean;
  closeTime: string;
  mentions: ResolvedMentions;
  supportedPlaceholders: AnnouncementPlaceholder[];
};

/** The manual send fans out across every configured server unless `guildIds`
 *  narrows it. ⚠️ Partial success is HTTP 200 — read `summary.failed`. Each
 *  server takes its own day-claim, so one failure never consumes another's day. */
/** ⚠️ Its own envelope, **not** the `ok`/`summary.succeeded` shape the channel
 *  toggles use: each server reports a dispatch `status`, because "already sent"
 *  is neither a success nor a failure — it is the day-claim working. Partial
 *  success is HTTP 200; a total failure is the only error status. */
export type AnnouncementSendResult = {
  announcementDate: string;
  summary: {
    total: number;
    posted: number;
    failed: number;
    alreadySent: number;
  };
  servers: (ServerRef & AnnouncementDispatchResult)[];
  /** The submission window this send **opened**. Sending the announcement and
   *  opening `#daily-update` are one action on the backend: a message telling
   *  students to submit into a channel they cannot post in would be worse than
   *  no message at all. Read this after every send — a server can appear under
   *  `failed` here while its post succeeded. */
  channel: AnnouncementChannelOutcome;
};

/** The channel half of a send. Guild IDs, not labels — pair them against
 *  `servers[]` (or `GET /discord/servers`) to name them on screen. */
export type AnnouncementChannelOutcome = {
  /** Guild IDs whose `#daily-update` this send opened. */
  opened: string[];
  /** Already open, so not re-edited — a forced second send does not post a
   *  second "Channel is OPEN" embed. */
  alreadyOpen: string[];
  /** ⚠️ The announcement went out and the channel did **not** open. Those
   *  students can read the message and cannot act on it — usually a missing
   *  `Manage Roles`. */
  failed: { guildId: string; label: string; error: string | null }[];
  /** `HH:mm` the lock job will close it, or `null` when the channel schedule is
   *  disabled — meaning nothing will lock it and it stays open past midnight,
   *  where a post lands on the *next* day's record. */
  locksAt: string | null;
};

/** A patch body. Every field optional, but an empty object is rejected (400). */
export type AnnouncementPatch = {
  body?: string;
  terminationDays?: number;
  mentionEveryone?: boolean;
  mentionRoleIds?: string[];
  mentionUsernames?: string[];
  announceTime?: string;
  daysOfWeek?: number[];
  enabled?: boolean;
};

/** Body for `POST /announcement/attendance/preview`. Both fields optional. */
export type AnnouncementPreviewRequest = {
  body?: string;
  terminationDays?: number;
};

// ── Attendance window (public — see `lib/attendance-window.ts`) ───────────────

/** ⚠️ Not reachable over HTTP yet (`BACKEND_REQUIREMENTS.md` §2) — the window is
 *  admin-only today, so `getAttendanceWindow()` fails open until the route ships. */
export type AttendanceWindow = {
  /** Whether the window is open *right now*, per the schedule. */
  isOpen: boolean;
  /** Today's Dhaka civil date, `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm` wall clock, Asia/Dhaka. */
  openTime: string;
  closeTime: string;
  /** 0 = Sunday … 6 = Saturday. */
  daysOfWeek: number[];
  /** `false` means the schedule is paused — the window never opens. */
  enabled: boolean;
  timezone: "Asia/Dhaka";
  /** Instant the window next opens; `null` when the schedule is disabled. */
  nextOpenAt: string | null;
  /** Instant the current window closes; `null` when it is not open. */
  closesAt: string | null;
  /** Whether attendance submissions require an enrolled student email match. */
  emailVerificationRequired?: boolean;
};

// ── Reminders ────────────────────────────────────────────────────────────────

export type ReminderStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

export type ReminderDeliveryStatus =
  | "PENDING"
  | "DELIVERED"
  | "DM_CLOSED"
  | "FAILED";

/** Which failure targets a person. ⚠️ `MISSING_UPDATE` is the default on
 *  purpose: it is exactly what a broadcast meant before ranges existed, and
 *  making `MISSING_BOTH` universal would silently stop reminding a student who
 *  files attendance and never posts an update. */
export type ReminderCriterion = "MISSING_UPDATE" | "MISSING_BOTH";

/** One **member record**, not one person: an account behind in two servers
 *  appears twice here, which is the per-server audit trail. The queue collapses
 *  them into one DM per account before anything is sent. */
export type ReminderTarget = {
  memberId: string;
  guildId: string;
  discordUserId: string;
  discordUsername: string;
  displayName: string | null;
  /** How many counted days this member failed the criterion. */
  missedDays: number;
};

/** The period every reminder payload echoes back. A single-date send stores the
 *  same date at both ends; **`reminderDate` no longer exists**. */
export type ReminderPeriod = {
  reminderStartDate: string;
  reminderEndDate: string;
  criterion: ReminderCriterion;
  minMissedDays: number;
  /** ⚠️ `null` (or empty, on a history row) means **every day counted** — the
   *  opposite of the channel schedule, where an empty weekday set is invalid. */
  daysOfWeek: number[] | null;
};

/** `targets` is **not** paginated — it can be thousands of rows. */
export type ReminderTargetsPayload = {
  mode?: PeriodMode;
  /** Date mode echo. */
  date?: string;
  /** Range mode echo. */
  from?: string;
  to?: string;
  daysInRange?: number;
  daysOfWeek?: number[] | null;
  criterion?: ReminderCriterion;
  minMissedDays?: number;
  /** Recipient rows — the per-server audit trail. */
  targetCount: number;
  /** People actually DMed. One account gets exactly one DM however many
   *  servers targeted it, so this can be lower than `targetCount`. */
  uniqueRecipients?: number;
  targets: ReminderTarget[];
};

/** Body for `POST /api/reminders/send`. Exactly one of `date` or `from`/`to`. */
export type ReminderSendInput = {
  date?: string;
  from?: string;
  to?: string;
  daysOfWeek?: number[];
  criterion?: ReminderCriterion;
  minMissedDays?: number;
  message: string;
  /** Omitted means every configured server. */
  guildIds?: string[];
};

/** `POST /reminders/send` answers 202 with the period it resolved — the same
 *  echo the preview returns, not the stored `reminderStartDate` pair. */
export type ReminderQueued = {
  id: string;
  mode?: PeriodMode;
  date?: string;
  from?: string;
  to?: string;
  daysInRange?: number;
  daysOfWeek?: number[] | null;
  criterion?: ReminderCriterion;
  minMissedDays?: number;
  targetCount: number;
  queuedJobs: number;
  status: ReminderStatus;
};

/** Read from the recipient rows, not the session row's cached counters, so
 *  `delivered + dmClosed + failed + outstanding === targetCount` holds. */
export type ReminderProgress = ReminderPeriod & {
  id: string;
  message: string;
  status: ReminderStatus;
  targetCount: number;
  uniqueRecipients?: number;
  delivered: number;
  dmClosed: number;
  failed: number;
  /** Still `PENDING`. On a `CANCELLED` broadcast these were never attempted. */
  outstanding: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ReminderLogRow = ReminderPeriod & {
  id: string;
  message: string;
  targetCount: number;
  sentCount: number;
  failedCount: number;
  status: ReminderStatus;
  createdById: string | null;
  /** `null` when the admin account was deleted — the audit row survives on purpose. */
  createdBy: { id: string; name: string; email: string } | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

/** No phone or email here by design — this is the delivery audit. */
export type ReminderRecipientRow = {
  id: string;
  memberId: string;
  status: ReminderDeliveryStatus;
  errorMessage: string | null;
  sentAt: string | null;
  member: {
    discordUserId: string;
    discordUsername: string;
    displayName: string | null;
  };
};

export type ReminderQueueStatus = {
  workerRunning: boolean;
  workerEnabled: boolean;
  /** `false` → `POST /send` will 503. Everything else keeps working. */
  redisConnected: boolean;
  redisError: string | null;
  /** Delivery pacing. Drives the time-remaining estimate. */
  dmPerSecond: number;
  /** `null` means the queue object could not be reached, not "zero jobs". */
  queueDepth: {
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
  } | null;
  /** ⚠️ Keyed per guild, not a single slot: the fallback runs once per server,
   *  and one healthy server's success must not overwrite the server where the
   *  channel announcement reached nobody. */
  lastFallbackByGuild: Record<string, ReminderFallback>;
};

export type ReminderFallback = {
  reminderId: string;
  ranAt: string;
  ok: boolean;
  mentioned: number;
  error: string | null;
  /** A silent failure: every DM delivered, but the channel announcement meant
   *  to catch the DM-closed members reached nobody. */
  missingPermission: boolean;
};

// ── Attendance (public) ──────────────────────────────────────────────────────

export type VerifiedMember = {
  id: string;
  discordUserId: string;
  discordUsername: string;
  displayName: string | null;
  avatarUrl: string | null;
};

/** `GET /attendance/verify-user` answers **200 even for an unknown handle** —
 *  branch on `verified`. `member` is always `null` when `verified` is false. */
export type VerifyUserPayload = {
  verified: boolean;
  /** ⚠️ True only when **every** server the handle is in already has today's
   *  row — someone in two servers who submitted in one still has work to do. */
  alreadySubmitted: boolean;
  attendanceDate: string;
  member: VerifiedMember | null;
  servers?: (ServerRef & { alreadySubmitted: boolean })[];
};

/** `GET /attendance/verify-email` answers **200 even for an unrecognised
 *  address** — branch on `verified`. The same "always 200" rule as `/verify-user`,
 *  the same `data.verified` shape, but answers whether the address is on the
 *  enrolled roster rather than whether a handle is in a server.
 *
 *  `emailVerificationRequired` says whether the roster gate is currently armed.
 *  When it is `false`, every well-formed address returns `verified: true` —
 *  the form should not nag about a check that is not happening. */
export type VerifyEmailPayload = {
  verified: boolean;
  attendanceDate: string;
  emailVerificationRequired: boolean;
};

export type SubmitAttendancePayload = {
  attendanceDate: string;
  submittedAt: string;
  member: VerifiedMember;
  /** One row is written per server, in a single transaction. The student
   *  submits once; the form never asks them to pick a server. */
  servers?: (ServerRef & { recorded: boolean })[];
};

export type AttendanceSubmitInput = {
  name: string;
  phone: string;
  email: string;
  discordUsername: string;
};

// ── Daily status (API_INTEGRATION.md §8.8, §5A) ──────────────────────────────

export type DailyStatus =
  | "COMPLETE"
  | "MISSING_UPDATE"
  | "MISSING_ATTENDANCE"
  | "MISSING_BOTH";

/** The three-bucket rollup a range collapses to, derived from `completeDays`. */
export type RangeStatus = "ALL_COMPLETE" | "PARTIAL" | "NONE";

/** Which figure the request was answered in. Echoed on every payload so the
 *  shape is never inferred from the presence of a field. */
export type PeriodMode = "date" | "range";

/** Every row is one PERSON, not one server membership: a student in two servers
 *  posting an update in either is COMPLETE in both, and is one row here. */
type DailyStatusPerson = {
  /** The representative member record — resolves to the whole person, whichever
   *  server's record it names. Use it for `/members/:memberId`. */
  memberId: string;
  /** Every member record behind this row, aligned with `servers`. */
  memberIds?: string[];
  discordUserId: string;
  discordUsername: string;
  displayName: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  /** Every server this person is in — narrowed by a `guildId` filter. */
  servers?: ServerRef[];
  /** How many servers hold the account **in total**, never narrowed. So
   *  `servers.length === 1 && serverCount === 2` inside a filtered view means
   *  "also in another server". */
  serverCount?: number;
};

export type DailyStatusMember = DailyStatusPerson & {
  hasAttendance: boolean;
  hasDailyUpdate: boolean;
  status: DailyStatus;
  /** Asia/Dhaka instant of the attendance submission, `null` when absent. */
  attendanceSubmittedAt: string | null;
};

/** In range mode the single-day status is replaced by counts over the span.
 *  ⚠️ `incompleteDays` and `missedBothDays` are different numbers, and there is
 *  deliberately no field called `missedDays`. */
export type DailyStatusRangeMember = DailyStatusPerson & {
  /** Counted days — the denominator of everything below. */
  daysInRange: number;
  attendanceDays: number;
  /** Days they posted a daily update, in **any** server. */
  updateDays: number;
  completeDays: number;
  /** `daysInRange - completeDays`. */
  incompleteDays: number;
  /** Neither attendance nor an update. What the reminder threshold acts on. */
  missedBothDays: number;
  missedUpdateDays: number;
  rangeStatus: RangeStatus;
  /** The most recent submission inside the range, or `null`. */
  attendanceSubmittedAt?: string | null;
};

export type DailyStatusRow = DailyStatusMember | DailyStatusRangeMember;

/** Narrowing helper — range rows carry counts, date rows carry a status. */
export function isRangeRow(
  row: DailyStatusRow,
): row is DailyStatusRangeMember {
  return "rangeStatus" in row;
}

/** The seven single-date overview figures. They count **people**. */
export type DailyStatusFigures = {
  totalMembers: number;
  attendanceSubmitted: number;
  dailyUpdateSubmitted: number;
  bothComplete: number;
  missingUpdateOnly: number;
  missingAttendanceOnly: number;
  missingBoth: number;
};

/** Range figures count **person-days**, and are named differently on purpose. */
export type DailyStatusRangeFigures = {
  totalMembers: number;
  allCompleteMembers: number;
  partialMembers: number;
  noneMembers: number;
  attendanceDays: number;
  updateDays: number;
  completeDays: number;
  missedBothDays: number;
};

/** ⚠️ `byServer` does **not** sum to the combined totals, and that is not a bug:
 *  the combined figures count people, `byServer` counts memberships. Show them
 *  as two readings, never as a total and its parts. */
export type DailyStatusCounts = DailyStatusFigures & {
  mode?: "date";
  date: string;
  byServer?: (ServerRef & DailyStatusFigures)[];
};

export type DailyStatusRangeCounts = DailyStatusRangeFigures & {
  mode?: "range";
  from: string;
  to: string;
  /** Echoed with its denominator, because `daysOfWeek` is an admin assertion
   *  rather than a record of when the channel was actually open. */
  daysInRange: number;
  /** `null` means every day in the span counted. */
  daysOfWeek?: number[] | null;
  byServer?: (ServerRef & DailyStatusRangeFigures)[];
};

export type DailyStatusAnyCounts = DailyStatusCounts | DailyStatusRangeCounts;

export function isRangeCounts(
  counts: DailyStatusAnyCounts,
): counts is DailyStatusRangeCounts {
  return "daysInRange" in counts;
}

export type DailyStatusMessage = {
  id: string;
  content: string;
  postedAt: string;
  /** Where it was posted. Both servers' messages merge into one timeline. */
  guildId?: string;
  serverLabel?: string;
};

/** One counted day inside a range detail, so a person's span can be read day
 *  by day rather than only as a total. */
export type DailyStatusDay = {
  date: string;
  hasAttendance: boolean;
  hasDailyUpdate: boolean;
  status: DailyStatus;
};

export type DailyStatusMemberDetail = DailyStatusMember & {
  messages: DailyStatusMessage[];
};

export type DailyStatusRangeMemberDetail = DailyStatusRangeMember & {
  messages: DailyStatusMessage[];
  /** Weekdays excluded by `daysOfWeek` are absent from this array. */
  days: DailyStatusDay[];
};

export type DailyStatusAnyMemberDetail =
  | DailyStatusMemberDetail
  | DailyStatusRangeMemberDetail;

export function isRangeDetail(
  detail: DailyStatusAnyMemberDetail,
): detail is DailyStatusRangeMemberDetail {
  return "rangeStatus" in detail;
}

/** Alias kept for readers following API_INTEGRATION.md naming. */
export type MemberDailyStatus = DailyStatusMemberDetail;

/** Sorting. The last three are range-only; using one in date mode is a 400. */
export type DailyStatusSortBy =
  | "discordUsername"
  | "name"
  | "status"
  | "missedBothDays"
  | "completeDays"
  | "rangeStatus";

export type DailyStatusQuery = {
  /** Exactly one of `date` or the `from`/`to` pair — sending both is a 400. */
  date?: string;
  from?: string;
  to?: string;
  /** Range mode only. `0` is Sunday, as everywhere else. */
  daysOfWeek?: number[];
  /** Omitted means every configured server. */
  guildId?: string;
  page?: number;
  limit?: number;
  /** Date mode only. */
  status?: DailyStatus;
  /** Range mode only. */
  rangeStatus?: RangeStatus;
  /** Range mode only — the same threshold the reminder send uses. */
  minMissedBothDays?: number;
  search?: string;
  sortBy?: DailyStatusSortBy;
  sortDir?: "asc" | "desc";
};

/** Alias for AttendanceWindow matching API_INTEGRATION.md naming */
export type AttendanceWindowPayload = AttendanceWindow;

// ── Roster (API_INTEGRATION.md §8.6A) ────────────────────────────────────────

export type RosterStatusFilter = "active" | "inactive" | "all";

export type RosterEntry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RosterQuery = {
  search?: string;
  status?: RosterStatusFilter;
  page?: number;
  limit?: number;
};

export type RosterImportRejectedRow = {
  rowNumber: number;
  reason: string;
};

export type RosterImportDuplicateAddress = {
  email: string;
  rowNumbers: number[];
};

export type RosterImportResult = {
  importId: string;
  fileName: string;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  duplicates: number;
  duplicateRowsCollapsed: number;
  rejectedRows: RosterImportRejectedRow[];
  duplicateAddresses: RosterImportDuplicateAddress[];
  batchFailures?: unknown[];
};

export type RosterImportHistoryItem = {
  id: string;
  fileName: string;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  duplicates: number;
  duplicateRowsCollapsed: number;
  rejectedRowsCount?: number;
  rejectedRows?: RosterImportRejectedRow[];
  duplicateAddresses?: RosterImportDuplicateAddress[];
  importedAt?: string;
  createdAt?: string;
  importedBy?: { id: string; name: string; email: string } | null;
  uploadedBy?: { id: string; name: string; email: string } | null;
};

export type RosterSettings = {
  enforceEmail: boolean;
  activeEntries: number;
  updatedAt: string | null;
  updatedBy: { id: string; name: string; email: string } | null;
};

export type UpdateRosterEntryInput = {
  name?: string;
  email?: string;
  phone?: string | null;
};

export type UpdateRosterSettingsInput = {
  enforceEmail: boolean;
};

// ── Roster engagement (API_INTEGRATION.md §8.6A "The roster engagement read model") ──

/** The denominator is ENROLMENT, not Discord membership. Roster totals will not
 *  equal dashboard totals — that is two different questions, not a bug. */
export type RosterStatus =
  | "COMPLETE"
  | "MISSING_UPDATE"
  | "MISSING_ATTENDANCE"
  | "MISSING_BOTH"
  | "NEVER_LINKED";

export type RosterRangeStatus = "ALL_COMPLETE" | "PARTIAL" | "NONE" | "NEVER_LINKED";

export type RosterPairingState = "all" | "paired" | "unpaired";

/** `entryId` is the roster row's id; `discordUserId` is the linked account (or
 *  `null` when unpaired). Paired and unpaired rows both appear — the list is
 *  one row per enrolled person, never per server membership. */
export type RosterStatusEntryBase = {
  entryId: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  /** `null` for unpaired enrollees — outreach happens by email outside this system. */
  discordUserId: string | null;
  linkedAt: string | null;
  /** The roster does not have a `guildId`: it is global, not per server. */
  servers: ServerRef[];
  /** How many configured servers hold the account. Always the unfiltered total. */
  serverCount: number;
  /** Discord account details, or `null` when the entry is unpaired. */
  discordUsername: string | null;
  displayName: string | null;
  /** Whether the linked account is currently in the guild right now. */
  isInGuild: boolean | null;
};

export type RosterStatusDateEntry = RosterStatusEntryBase & {
  hasAttendance: boolean;
  hasDailyUpdate: boolean;
  /** Unpaired enrollees read `NEVER_LINKED`, never one of the four buckets. */
  status: RosterStatus;
};

export type RosterStatusRangeEntry = RosterStatusEntryBase & {
  /** Counted days — the denominator of everything below. */
  daysInRange: number;
  attendanceDays: number;
  /** Days they posted a daily update, in **any** server. */
  updateDays: number;
  completeDays: number;
  /** `daysInRange - completeDays`. */
  incompleteDays: number;
  /** Neither attendance nor an update. The reminder threshold acts on this. */
  missedBothDays: number;
  missedUpdateDays: number;
  /** Unpaired enrollees read `NEVER_LINKED`, never `ALL_COMPLETE`/`PARTIAL`/`NONE`. */
  rangeStatus: RosterRangeStatus;
};

export type RosterStatusEntry = RosterStatusDateEntry | RosterStatusRangeEntry;

export function isRosterRangeEntry(
  entry: RosterStatusEntry,
): entry is RosterStatusRangeEntry {
  return "rangeStatus" in entry;
}

export type RosterStatusSortBy = "name" | "email" | "status" | "linkedAt";

export type RosterStatusQuery = {
  /** Exactly one of `date` or the `from`/`to` pair — sending both is a 400. */
  date?: string;
  from?: string;
  to?: string;
  daysOfWeek?: number[];
  pairingState?: RosterPairingState;
  /** Date mode only. */
  status?: RosterStatus;
  search?: string;
  sortBy?: RosterStatusSortBy;
  sortDir?: "asc" | "desc";
  page?: number;
  limit?: number;
};

/** Date-mode counts: enrolled / paired / unpaired + the four-bucket rollup. */
export type RosterStatusDateFigures = {
  enrolled: number;
  paired: number;
  unpaired: number;
  bothComplete: number;
  missingUpdateOnly: number;
  missingAttendanceOnly: number;
  missingBoth: number;
};

/** Range-mode counts are person-day totals, named differently on purpose. */
export type RosterStatusRangeFigures = {
  enrolled: number;
  paired: number;
  unpaired: number;
  allComplete: number;
  partial: number;
  none: number;
  attendanceDays: number;
  updateDays: number;
  completeDays: number;
  missedBothDays: number;
};

export type RosterStatusDateCountsPayload = {
  meta: {
    mode: "date";
    date: string;
    from?: string;
    to?: string;
    daysInRange?: number;
    daysOfWeek?: number[] | null;
  };
  counts: RosterStatusDateFigures;
};

export type RosterStatusRangeCountsPayload = {
  meta: {
    mode: "range";
    date?: string;
    from: string;
    to: string;
    daysInRange?: number;
    daysOfWeek?: number[] | null;
  };
  counts: RosterStatusRangeFigures;
};

export type RosterStatusCountsPayload =
  | RosterStatusDateCountsPayload
  | RosterStatusRangeCountsPayload;

/** Narrowing helper — mirror of `isRangeCounts` for the roster figures. The
 *  `meta.mode` echo is what we read, not any field on the counts object. */
export function isRosterRangeCounts(
  payload: RosterStatusCountsPayload,
): payload is RosterStatusRangeCountsPayload {
  return payload.meta.mode === "range";
}

