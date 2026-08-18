import { describe, expect, test } from "bun:test";

import {
  aggregateSyncState,
  announcementAttempts,
  combinedChannelState,
  latestAnnouncementOutcome,
  latestFallback,
  latestScheduleRun,
} from "@/lib/api/derive";
import type {
  AnnouncementPayload,
  DiscordServerStatus,
  ScheduleLastRun,
  SyncState,
} from "@/lib/api/types";

/** These cover the shapes `GET /discord/sync/status`, `/schedule/daily-update`,
 *  `/announcement/attendance` and `/reminders/status` actually return — verified
 *  against the running backend. The endpoints report **per server** and publish
 *  no combined figure, so every headline reading on screen is derived here. A
 *  regression in these is a blank panel or a crash, not a wrong number. */

const syncState = (over: Partial<SyncState> = {}): SyncState => ({
  running: false,
  startedAt: null,
  finishedAt: null,
  durationMs: null,
  fetched: 0,
  synced: 0,
  failed: 0,
  markedDeparted: 0,
  guardTripped: false,
  lastError: null,
  ...over,
});

const server = (
  guildId: string,
  over: Partial<DiscordServerStatus> = {},
): DiscordServerStatus => ({
  guildId,
  label: `Batch ${guildId}`,
  name: null,
  reachable: true,
  unreachableReason: null,
  discordMemberCount: 0,
  members: { total: 0, active: 0, departed: 0 },
  channels: {
    attendance: { id: null, verified: true, error: null },
    dailyUpdate: { id: null, verified: true, error: null },
    reminder: { id: null, verified: true, error: null },
  },
  verifiedAt: null,
  lastSync: syncState(),
  ...over,
});

describe("aggregateSyncState", () => {
  test("sums the work and keeps any server still running", () => {
    const merged = aggregateSyncState([
      server("1", { lastSync: syncState({ fetched: 10, synced: 8 }) }),
      server("2", {
        lastSync: syncState({ running: true, fetched: 5, synced: 1 }),
      }),
    ]);

    expect(merged.running).toBe(true);
    expect(merged.fetched).toBe(15);
    expect(merged.synced).toBe(9);
  });

  // One tripped guard is the entire signal, so it must survive the merge —
  // a healthy second server would otherwise hide a stale directory.
  test("one tripped guard survives", () => {
    const merged = aggregateSyncState([
      server("1", { lastSync: syncState({ guardTripped: true }) }),
      server("2"),
    ]);

    expect(merged.guardTripped).toBe(true);
  });

  test("an empty server list does not throw", () => {
    expect(aggregateSyncState([]).running).toBe(false);
  });
});

describe("combinedChannelState", () => {
  const chan = (guildId: string, isOpen: boolean | null) => ({
    guildId,
    label: guildId,
    channelId: "c",
    isOpen,
    lastRun: null,
  });

  test("open only when every server is open", () => {
    expect(combinedChannelState([chan("1", true), chan("2", true)]).isOpen).toBe(
      true,
    );
    expect(
      combinedChannelState([chan("1", true), chan("2", false)]).isOpen,
    ).toBe(false);
  });

  // The state a single badge would misreport, and the reason both buttons stay
  // live: the locked server has to be reachable from the same control.
  test("some open and some not is reported as mixed", () => {
    const state = combinedChannelState([chan("1", true), chan("2", false)]);
    expect(state.mixed).toBe(true);
    expect(state.openCount).toBe(1);
  });

  // `null` means the permission could not be read. Folding it into "locked"
  // would invite an admin to "fix" a channel that may already be open.
  test("an unreadable channel counts as unknown, not locked", () => {
    const state = combinedChannelState([chan("1", true), chan("2", null)]);
    expect(state.unknown).toBe(1);
    expect(state.isOpen).toBe(false);
  });
});

describe("latestScheduleRun", () => {
  const run = (ranAt: string, ok: boolean): ScheduleLastRun => ({
    action: "open",
    trigger: "schedule",
    ranAt,
    ok,
    error: ok ? null : "Missing Permissions",
  });

  // The failing server is the one that needs acting on, so it outranks a later
  // success — otherwise the healthy server buries it.
  test("a failure outranks a more recent success", () => {
    const picked = latestScheduleRun({
      processEnabled: true,
      running: true,
      nextOpenAt: null,
      nextLockAt: null,
      lastRunByGuild: {
        "1": run("2026-08-18T10:00:00.000Z", false),
        "2": run("2026-08-18T12:00:00.000Z", true),
      },
    });

    expect(picked?.guildId).toBe("1");
    expect(picked?.ok).toBe(false);
  });

  test("no runs recorded is null, not a crash", () => {
    expect(
      latestScheduleRun({
        processEnabled: false,
        running: false,
        nextOpenAt: null,
        nextLockAt: null,
        lastRunByGuild: {},
      }),
    ).toBeNull();
  });
});

describe("announcementAttempts", () => {
  const attempt = (n: number, createdAt: string) => ({
    attempt: n,
    status: "POSTED" as const,
    trigger: "MANUAL" as const,
    discordMessageId: null,
    unresolvedTargets: [],
    error: null,
    createdAt,
    updatedAt: createdAt,
  });

  // Each server takes its own day-claim, so "attempt 1" exists once per server
  // and the flattened list has to keep them apart.
  test("flattens every server's attempts and tags each with its server", () => {
    const today: AnnouncementPayload["today"] = {
      date: "2026-08-18",
      posted: false,
      servers: [
        {
          guildId: "1",
          label: "Batch A",
          channelId: null,
          posted: true,
          attempts: [attempt(1, "2026-08-18T12:00:00.000Z")],
          lastOutcome: null,
        },
        {
          guildId: "2",
          label: "Batch B",
          channelId: null,
          posted: false,
          attempts: [attempt(1, "2026-08-18T11:00:00.000Z")],
          lastOutcome: null,
        },
      ],
    };

    const flat = announcementAttempts(today);
    expect(flat).toHaveLength(2);
    expect(flat[0].serverLabel).toBe("Batch B");
    expect(flat.map((a) => a.attempt)).toEqual([1, 1]);
  });

  test("no servers yields no attempts", () => {
    expect(
      announcementAttempts({ date: "2026-08-18", posted: false, servers: [] }),
    ).toEqual([]);
  });
});

describe("latestAnnouncementOutcome and latestFallback", () => {
  test("a failed post outranks a later success", () => {
    const picked = latestAnnouncementOutcome({
      processEnabled: true,
      running: true,
      nextRunAt: null,
      lastOutcomeByGuild: {
        "1": {
          ranAt: "2026-08-18T10:00:00.000Z",
          trigger: "SCHEDULED",
          result: {
            status: "failed",
            announcementDate: "2026-08-18",
            error: "Missing Access",
            missingPermission: true,
            notConnected: false,
          },
        },
        "2": {
          ranAt: "2026-08-18T12:00:00.000Z",
          trigger: "SCHEDULED",
          result: {
            status: "posted",
            announcementDate: "2026-08-18",
            attempt: 1,
            messageId: "m",
            unresolvedTargets: [],
          },
        },
      },
    });

    expect(picked?.guildId).toBe("1");
  });

  // The silent failure: every DM delivered, but the channel announcement meant
  // to catch the DM-closed members reached nobody.
  test("a fallback that lost its permission is the one surfaced", () => {
    const picked = latestFallback({
      workerRunning: true,
      workerEnabled: true,
      redisConnected: true,
      redisError: null,
      dmPerSecond: 2,
      queueDepth: null,
      lastFallbackByGuild: {
        "1": {
          reminderId: "r1",
          ranAt: "2026-08-18T10:00:00.000Z",
          ok: true,
          mentioned: 3,
          error: null,
          missingPermission: false,
        },
        "2": {
          reminderId: "r2",
          ranAt: "2026-08-18T09:00:00.000Z",
          ok: false,
          mentioned: 0,
          error: "Missing Permissions",
          missingPermission: true,
        },
      },
    });

    expect(picked?.guildId).toBe("2");
    expect(picked?.missingPermission).toBe(true);
  });

  test("nothing recorded is null", () => {
    expect(
      latestFallback({
        workerRunning: false,
        workerEnabled: false,
        redisConnected: false,
        redisError: null,
        dmPerSecond: 2,
        queueDepth: null,
        lastFallbackByGuild: {},
      }),
    ).toBeNull();
  });
});
