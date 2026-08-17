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

// ── Daily status (contract only — see `lib/flags.ts`) ─────────────────────────

/**
 * ⚠️ Nothing below is reachable over HTTP today.
 *
 * `API_INTEGRATION.md` §13 records that `getDailyStatusPage()` and
 * `getDailyStatusCounts()` are written and tested in the backend's repository
 * layer but exposed by **no route** — any request would answer `API Not
 * Found!`. These types are written to the documented contract so the feature is
 * genuinely ready to switch on, and every call site is guarded by
 * `DAILY_STATUS_ENABLED` so none of them can fire while that is off.
 *
 * If the eventual endpoints differ, the rework is bounded to this block and
 * `lib/api/endpoints/daily-status.ts`.
 */
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

/**
 * The seven overview figures. They interlock and must agree, so they come from
 * this one endpoint only — assembling any of them from the reminder targets
 * list would produce numbers that quietly contradict each other.
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

export type DailyStatusQuery = {
  date: string;
  page?: number;
  limit?: number;
  status?: DailyStatus;
  search?: string;
};
