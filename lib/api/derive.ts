import type {
  AnnouncementAttempt,
  AnnouncementOutcome,
  AnnouncementPayload,
  ChannelSchedulePayload,
  DiscordServerStatus,
  ReminderFallback,
  ReminderQueueStatus,
  ScheduleLastRun,
  SyncState,
} from "@/lib/api/types";

/** Combined readings over per-server payloads.
 *
 *  The backend reports sync state, channel state and announcement attempts
 *  **per configured server**, and deliberately publishes no combined figure —
 *  because a single flag would hide the one server that is failing while every
 *  other looks healthy. Where a screen still needs one headline value, it is
 *  derived here, once, and always alongside a count so it can say *"open in 1 of
 *  2"* rather than claiming a fact about a channel that does not exist. */

/** One sync reading over every server: the union of what is happening. */
export function aggregateSyncState(servers: DiscordServerStatus[]): SyncState {
  const states = servers.map((server) => server.lastSync).filter(Boolean);

  const pick = <T>(values: (T | null)[]): T | null =>
    values.find((value) => value !== null) ?? null;

  return {
    // Any server still syncing means the figures on screen are still climbing.
    running: states.some((state) => state.running),
    startedAt: pick(states.map((state) => state.startedAt)),
    finishedAt: pick(states.map((state) => state.finishedAt)),
    durationMs: pick(states.map((state) => state.durationMs)),
    fetched: states.reduce((sum, state) => sum + state.fetched, 0),
    synced: states.reduce((sum, state) => sum + state.synced, 0),
    failed: states.reduce((sum, state) => sum + state.failed, 0),
    markedDeparted: states.reduce((sum, state) => sum + state.markedDeparted, 0),
    // One tripped guard is the whole point of the flag, so it survives the merge.
    guardTripped: states.some((state) => state.guardTripped),
    lastError: pick(states.map((state) => state.lastError)),
  };
}

export type CombinedChannelState = {
  /** True only when every server that could be read is open. */
  isOpen: boolean;
  openCount: number;
  total: number;
  /** Some open, some not — the state a single badge would misreport. */
  mixed: boolean;
  /** Servers whose channel could not be read at all: unknown, not locked. */
  unknown: number;
};

export function combinedChannelState(
  servers: ChannelSchedulePayload["servers"],
): CombinedChannelState {
  const total = servers.length;
  const openCount = servers.filter((server) => server.isOpen === true).length;
  const unknown = servers.filter((server) => server.isOpen === null).length;

  return {
    isOpen: total > 0 && openCount === total,
    openCount,
    total,
    mixed: openCount > 0 && openCount < total,
    unknown,
  };
}

/** The most recent scheduled run across servers, for the summary panel. The
 *  per-server runs stay visible in the server list — this only answers "did the
 *  last scheduled open work at all". */
export function latestScheduleRun(
  scheduler: ChannelSchedulePayload["scheduler"],
): (ScheduleLastRun & { guildId: string }) | null {
  const runs = Object.entries(scheduler.lastRunByGuild ?? {}).map(
    ([guildId, run]) => ({ ...run, guildId }),
  );
  if (runs.length === 0) return null;

  // A failure outranks a later success: the failing server is the one that
  // needs acting on, and it is what this panel exists to surface.
  const failed = runs.filter((run) => !run.ok);
  const pool = failed.length > 0 ? failed : runs;

  return pool.reduce((latest, run) => (run.ranAt > latest.ranAt ? run : latest));
}

/** Every attempt filed today, across servers, newest last. Each is tagged with
 *  the server it belongs to, since two servers file attempt 1 independently. */
export function announcementAttempts(
  today: AnnouncementPayload["today"],
): (AnnouncementAttempt & { serverLabel: string; guildId: string })[] {
  return today.servers
    .flatMap((server) =>
      server.attempts.map((attempt) => ({
        ...attempt,
        serverLabel: server.label,
        guildId: server.guildId,
      })),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** The scheduler outcome worth showing: a failure if there is one, else the
 *  most recent. Same rule as `latestScheduleRun`, and for the same reason. */
export function latestAnnouncementOutcome(
  scheduler: AnnouncementPayload["scheduler"],
): (AnnouncementOutcome & { guildId: string }) | null {
  const outcomes = Object.entries(scheduler.lastOutcomeByGuild ?? {}).map(
    ([guildId, outcome]) => ({ ...outcome, guildId }),
  );
  if (outcomes.length === 0) return null;

  const failed = outcomes.filter(
    (outcome) => outcome.result.status === "failed",
  );
  const pool = failed.length > 0 ? failed : outcomes;

  return pool.reduce((latest, outcome) =>
    outcome.ranAt > latest.ranAt ? outcome : latest,
  );
}

/** The reminder fallback worth surfacing: a run whose channel announcement
 *  failed, if there is one, else the most recent.
 *
 *  The fallback runs once per server and is keyed per guild for the same reason
 *  everything else here is — a healthy server's success would otherwise hide the
 *  server where the members with closed DMs were never reached at all. */
export function latestFallback(
  queue: ReminderQueueStatus,
): (ReminderFallback & { guildId: string }) | null {
  const entries = Object.entries(queue.lastFallbackByGuild ?? {}).map(
    ([guildId, fallback]) => ({ ...fallback, guildId }),
  );
  if (entries.length === 0) return null;

  const broken = entries.filter((entry) => entry.missingPermission || !entry.ok);
  const pool = broken.length > 0 ? broken : entries;

  return pool.reduce((latest, entry) =>
    entry.ranAt > latest.ranAt ? entry : latest,
  );
}
