"use client";

import { AlertTriangle, CircleSlash, Info } from "lucide-react";
import { useState } from "react";

import { ManualOverride } from "./manual-override";
import { ScheduleEditor } from "./schedule-editor";
import { ServerChannels } from "./server-channels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  combinedChannelState,
  latestScheduleRun,
} from "@/lib/api/derive";
import type { ChannelSchedulePayload } from "@/lib/api/types";
import { formatDhaka, formatWallClock } from "@/lib/dhaka-date";
import { explainScheduleError, formatWeekdays } from "@/lib/validation/schedule";

/** Owns the displayed schedule state: PATCH and manual open/lock return fresh
 *  payloads that replace it directly, and `initial` wins on every server render. */
export function ScheduleView({ initial }: { initial: ChannelSchedulePayload }) {
  const [payload, setPayload] = useState(initial);

  // The server's view always wins over a locally-held payload. Adjusted during
  // render so a revalidation never shows one frame of the superseded state.
  const [seenInitial, setSeenInitial] = useState(initial);
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    setPayload(initial);
  }

  const { schedule, scheduler } = payload;
  const servers = payload.servers;
  // There is no single channel: the payload reports one per server. The headline
  // badge is therefore a summary, and says so — claiming "Open" while one server
  // is locked would be a lie the admin cannot see through.
  const channelState = combinedChannelState(servers);
  const { openCount, mixed } = channelState;
  // A failure outranks a later success here, because the failing server is the
  // one that needs acting on.
  const lastRun = latestScheduleRun(scheduler);
  const permissionHint = explainScheduleError(lastRun?.error ?? null);

  return (
    <div className="flex flex-col gap-4">
      {/* Timed jobs off on this process — not a fault, but it explains why
          nextOpenAt/nextLockAt are empty and why nothing fires. */}
      {!scheduler.processEnabled ? (
        <Alert variant="warning">
          <Info />
          <AlertTitle>Timed jobs are off on this process</AlertTitle>
          <AlertDescription>
            <code className="font-mono text-xs">SCHEDULER_ENABLED</code> is
            false on the backend process serving this request, so the channel
            will <strong>not</strong> open or lock on schedule. The stored
            schedule below is still saved and still authoritative — and the
            manual open and lock controls still work.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Channel state
              <Badge
                variant={
                  mixed
                    ? "warning"
                    : channelState.isOpen
                      ? "secondary"
                      : "outline"
                }
              >
                {mixed
                  ? `Open in ${openCount} of ${servers.length}`
                  : channelState.isOpen
                    ? "Open"
                    : "Locked"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Live from Discord.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs">Next open</dt>
                <dd className="text-sm font-medium">
                  {scheduler.nextOpenAt ? (
                    formatDhaka(scheduler.nextOpenAt)
                  ) : (
                    <span className="text-muted-foreground font-normal">
                      Not scheduled —{" "}
                      {!schedule.enabled
                        ? "the schedule is disabled."
                        : !scheduler.processEnabled
                          ? "this process is not scheduling."
                          : "no task is registered."}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs">Next lock</dt>
                <dd className="text-sm font-medium">
                  {scheduler.nextLockAt ? (
                    formatDhaka(scheduler.nextLockAt)
                  ) : (
                    <span className="text-muted-foreground font-normal">
                      Not scheduled —{" "}
                      {!schedule.enabled
                        ? "the schedule is disabled."
                        : !scheduler.processEnabled
                          ? "this process is not scheduling."
                          : "no task is registered."}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs">
                  {servers.length === 1 ? "Channel ID" : "Channels"}
                </dt>
                <dd className="font-mono text-sm">
                  {servers.length === 1
                    ? (servers[0]?.channelId ?? "—")
                    : `${servers.length} servers`}
                </dd>
              </div>
              {/* Only worth a line when it is wrong. */}
              {!scheduler.running ? (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-xs">Scheduler</dt>
                  <dd className="text-sm font-medium">Not running</dd>
                </div>
              ) : null}
            </dl>

            <ManualOverride payload={payload} onRefreshed={setPayload} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Last run</CardTitle>
            <CardDescription>
              Check here first if the channel stops opening.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {lastRun ? (
              <>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">Action</dt>
                    <dd className="text-sm font-medium capitalize">
                      {lastRun.action} (
                      {lastRun.trigger})
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">Ran at</dt>
                    <dd className="text-sm font-medium">
                      {formatDhaka(lastRun.ranAt)}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">Outcome</dt>
                    <dd className="text-sm font-medium">
                      {lastRun.ok ? "Succeeded" : "Failed"}
                    </dd>
                  </div>
                </dl>

                {lastRun.error ? (
                  <Alert variant="destructive">
                    <AlertTriangle />
                    <AlertTitle>The last run failed</AlertTitle>
                    <AlertDescription className="flex flex-col gap-2">
                      {permissionHint ? <span>{permissionHint}</span> : null}
                      <code className="bg-muted text-muted-foreground overflow-x-auto rounded p-2 font-mono text-xs">
                        {lastRun.error}
                      </code>
                    </AlertDescription>
                  </Alert>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <CircleSlash aria-hidden className="size-4" />
                No scheduled run has happened since this process started.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <ServerChannels payload={payload} onRefreshed={setPayload} />

      <Card>
        <CardHeader>
          <CardTitle>Stored schedule</CardTitle>
          <CardDescription>
            {schedule.enabled
              ? `${formatWallClock(schedule.openTime)}–${formatWallClock(schedule.closeTime)} · ${formatWeekdays(schedule.daysOfWeek)}`
              : "Paused"}
            {" · last changed "}
            {formatDhaka(schedule.updatedAt)}
            {schedule.updatedBy ? ` by ${schedule.updatedBy.name}` : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduleEditor payload={payload} onUpdated={setPayload} />
        </CardContent>
      </Card>
    </div>
  );
}
