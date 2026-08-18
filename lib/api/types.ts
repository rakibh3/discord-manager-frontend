/**
 * Wire types for the backend, transcribed from `API_INTEGRATION.md` §7.1.
 *
 * These describe what the backend actually sends, not what we wish it sent —
 * every `| null` here is a value the API really produces and the UI has to
 * render something sensible for.
 */

/**
 * Every successful response is wrapped in this. The payload is **always** under
 * `data`; flags like `verified` are `data.verified`, never top level.
 *
 * `meta` is present only on paginated list endpoints and is omitted entirely
 * (not nulled) elsewhere. Note that *error* bodies have a different shape — no
 * `statusCode`, no `data` — and are handled in `lib/api/errors.ts`.
 */
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

/**
 * `GET /users/me` does **not** include `profile`; only `PUT /users/my-profile`
 * returns it. An admin inserted by hand rather than seeded may have no profile
 * row at all, which is what makes the profile update answer 404.
 */
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
  /**
   * The departure guard skipped a reconcile because a member fetch came back
   * suspiciously small. The directory is stale but intact — this is the guard
   * working, not a fault.
   */
  guardTripped: boolean;
  lastError: string | null;
};

export type DiscordSyncStatus = {
  bot: { connected: boolean; tag: string | null; guildId: string | null };
  members: { total: number; active: number; departed: number };
  lastSync: SyncState;
  dailyUpdate: {
    /**
     * `false` means the bot fell back to a login without the Message Content
     * intent: every message arrives empty, so no daily update is being
     * recorded at all. Silent, and catastrophic for the status dashboard.
     */
    ingestionEnabled: boolean;
    reason: string | null;
    channelId: string | null;
  };
};

/** `POST /discord/sync` answers 202 — nothing has happened yet. Poll status. */
export type SyncTriggerResult = {
  accepted: true;
  guildId: string;
  startedAt: string;
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

export type ChannelSchedulePayload = {
  schedule: {
    /** `HH:mm` wall clock, Asia/Dhaka. */
    openTime: string;
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
    lastRun: ScheduleLastRun | null;
  };
  /** `isOpen` is read live from Discord on every request, so never cache this. */
  channel: { id: string | null; isOpen: boolean };
};

export type ChannelToggleResult = {
  channelId: string | null;
  isOpen: boolean;
  announced: boolean;
};

/** A patch body. Every field optional, but an empty object is rejected (400). */
export type SchedulePatch = {
  openTime?: string;
  closeTime?: string;
  daysOfWeek?: number[];
  enabled?: boolean;
};

// ── Attendance announcement ──────────────────────────────────────────────────

/**
 * The only tokens a template body may contain. The backend rejects anything
 * else with a 400 that names the offender — left in the text an unknown
 * placeholder would reach ~5,000 students as literal characters.
 */
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
    /**
     * The **raw** body, placeholders unexpanded. This is what an editor binds
     * to — round-tripping `preview.content` back through a save would bake
     * today's date permanently into the stored template.
     */
    body: string;
    terminationDays: number;
    /**
     * Pings the entire guild every evening until turned off. The only way the
     * announcement can notify everyone: a literal `@everyone` typed into the
     * body is inert, because `allowedMentions` is built from this allowlist
     * alone and never parsed out of the text.
     */
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
    /** Where a missing `Send Messages` permission first becomes visible. */
    lastOutcome: {
      ranAt: string;
      trigger: "SCHEDULED" | "MANUAL";
      result: AnnouncementDispatchResult;
    } | null;
  };
  channel: { id: string | null };
  today: {
    /** `YYYY-MM-DD`, Dhaka. */
    date: string;
    posted: boolean;
    attempts: AnnouncementAttempt[];
  };
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

export type AnnouncementSendResult = {
  announcementDate: string;
  attempt: number;
  discordMessageId: string;
  unresolvedTargets: string[];
  channelId: string | null;
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

/**
 * ⚠️ Not reachable over HTTP yet. See `BACKEND_REQUIREMENTS.md` §2.
 *
 * The window governing when the public attendance form accepts submissions is
 * the `#daily-update` schedule, which today is readable only from the
 * **admin-only** `GET /api/schedule/daily-update`. Students have no credential,
 * so the homepage needs a public projection of the same row.
 *
 * `getAttendanceWindow()` fails **open** while the route is absent: the form
 * renders exactly as it does now, so shipping this ahead of the backend changes
 * nothing, and the gate switches itself on the moment the route appears.
 */
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

export type ReminderTarget = {
  memberId: string;
  discordUserId: string;
  discordUsername: string;
  displayName: string | null;
};

/** `targets` is **not** paginated — it can be thousands of rows. */
export type ReminderTargetsPayload = {
  date: string;
  targetCount: number;
  targets: ReminderTarget[];
};

export type ReminderQueued = {
  id: string;
  reminderDate: string;
  targetCount: number;
  queuedJobs: number;
  status: ReminderStatus;
};

/**
 * Read from the recipient rows rather than the session row's cached counters,
 * which is why the field names differ from `ReminderLogRow`. The invariant
 * `delivered + dmClosed + failed + outstanding === targetCount` holds, so a
 * progress bar can be driven straight from these.
 */
export type ReminderProgress = {
  id: string;
  reminderDate: string;
  message: string;
  status: ReminderStatus;
  targetCount: number;
  delivered: number;
  dmClosed: number;
  failed: number;
  /** Still `PENDING`. On a `CANCELLED` broadcast these were never attempted. */
  outstanding: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ReminderLogRow = {
  id: string;
  reminderDate: string;
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
  lastFallback: {
    reminderId: string;
    ranAt: string;
    ok: boolean;
    mentioned: number;
    error: string | null;
    /**
     * A silent failure: every DM delivered, and the channel announcement that
     * was supposed to catch the DM-closed members reached nobody.
     */
    missingPermission: boolean;
  } | null;
};

// ── Attendance (public) ──────────────────────────────────────────────────────

export type VerifiedMember = {
  id: string;
  discordUserId: string;
  discordUsername: string;
  displayName: string | null;
  avatarUrl: string | null;
};

/**
 * `GET /attendance/verify-user` answers **HTTP 200 even for an unknown
 * handle** — branch on `verified`, never on the status. `member` is always
 * `null` when `verified` is `false`; there is no partial disclosure.
 */
export type VerifyUserPayload = {
  verified: boolean;
  alreadySubmitted: boolean;
  attendanceDate: string;
  member: VerifiedMember | null;
};

export type SubmitAttendancePayload = {
  attendanceDate: string;
  submittedAt: string;
  member: VerifiedMember;
};

export type AttendanceSubmitInput = {
  name: string;
  phone: string;
  email: string;
  discordUsername: string;
};

// ── Daily status (API_INTEGRATION.md §8.8) ───────────────────────────────────

export type DailyStatus =
  | "COMPLETE"
  | "MISSING_UPDATE"
  | "MISSING_ATTENDANCE"
  | "MISSING_BOTH";

export type DailyStatusMember = {
  memberId: string;
  discordUserId: string;
  discordUsername: string;
  displayName: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  hasAttendance: boolean;
  hasDailyUpdate: boolean;
  status: DailyStatus;
  /** Asia/Dhaka instant of the attendance submission, `null` when absent. */
  attendanceSubmittedAt: string | null;
};

/** Alias for DailyStatusMember matching API_INTEGRATION.md naming */
export type DailyStatusRow = DailyStatusMember;

/**
 * The seven overview figures. They interlock and must agree, so they come from
 * this one endpoint only (`GET /api/daily-status/counts`).
 * Invariant: `bothComplete + missingUpdateOnly + missingAttendanceOnly + missingBoth === totalMembers`.
 */
export type DailyStatusCounts = {
  date: string;
  totalMembers: number;
  attendanceSubmitted: number;
  dailyUpdateSubmitted: number;
  bothComplete: number;
  missingUpdateOnly: number;
  missingAttendanceOnly: number;
  missingBoth: number;
};

export type DailyStatusMessage = {
  id: string;
  content: string;
  postedAt: string;
};

export type DailyStatusMemberDetail = DailyStatusMember & {
  messages: DailyStatusMessage[];
};

/** Alias for DailyStatusMemberDetail matching API_INTEGRATION.md naming */
export type MemberDailyStatus = DailyStatusMemberDetail;

export type DailyStatusQuery = {
  date: string;
  page?: number;
  limit?: number;
  status?: DailyStatus;
  search?: string;
};

/** Alias for AttendanceWindow matching API_INTEGRATION.md naming */
export type AttendanceWindowPayload = AttendanceWindow;
