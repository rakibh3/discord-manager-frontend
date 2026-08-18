"use client";

import { AlertTriangle, CircleSlash, Info } from "lucide-react";
import { useState } from "react";

import { ManualOverride } from "./manual-override";
import { ScheduleEditor } from "./schedule-editor";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ChannelSchedulePayload } from "@/lib/api/types";
import { formatDhaka, formatWallClock } from "@/lib/dhaka-date";
import { explainScheduleError, formatWeekdays } from "@/lib/validation/schedule";

/**
 * Owns the displayed schedule state.
 *
 * A `PATCH` and a manual open/lock both return authoritative fresh payloads, so
 * they replace what is on screen directly rather than waiting for a
 * revalidation round trip. `initial` still wins whenever the server re-renders,
 * so nothing here can drift from the server's view.
 */
export function ScheduleView({ initial }: { initial: ChannelSchedulePayload }) {
  const [payload, setPayload] = useState(initial);

  // The server's view always wins over a locally-held payload. Adjusted during
  // render so a revalidation never shows one frame of the superseded state.
  const [seenInitial, setSeenInitial] = useState(initial);
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    setPayload(initial);
  }

  const { schedule, scheduler, channel } = payload;
  const permissionHint = explainScheduleError(scheduler.lastRun?.error ?? null);

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
              <Badge variant={channel.isOpen ? "secondary" : "outline"}>
                {channel.isOpen ? "Open" : "Locked"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Read live from Discord on every page load, so this reflects manual
              permission edits made in Discord as well as anything done here.
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
                <dt className="text-muted-foreground text-xs">Channel ID</dt>
                <dd className="font-mono text-sm">{channel.id ?? "—"}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs">
                  Scheduler process
                </dt>
                <dd className="text-sm font-medium">
                  {scheduler.running ? "Running" : "Not running"}
                </dd>
              </div>
            </dl>

            <ManualOverride payload={payload} onRefreshed={setPayload} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Last run</CardTitle>
            <CardDescription>
              The first place a permission problem becomes visible. If the
              channel stops opening, this is what to read.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {scheduler.lastRun ? (
              <>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">Action</dt>
                    <dd className="text-sm font-medium capitalize">
                      {scheduler.lastRun.action} (
                      {scheduler.lastRun.trigger})
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">Ran at</dt>
                    <dd className="text-sm font-medium">
                      {formatDhaka(scheduler.lastRun.ranAt)}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">Outcome</dt>
                    <dd className="text-sm font-medium">
                      {scheduler.lastRun.ok ? "Succeeded" : "Failed"}
                    </dd>
                  </div>
                </dl>

                {scheduler.lastRun.error ? (
                  <Alert variant="destructive">
                    <AlertTriangle />
                    <AlertTitle>The last run failed</AlertTitle>
                    <AlertDescription className="flex flex-col gap-2">
                      {permissionHint ? <span>{permissionHint}</span> : null}
                      <code className="bg-muted text-muted-foreground overflow-x-auto rounded p-2 font-mono text-xs">
                        {scheduler.lastRun.error}
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

      <Card>
        <CardHeader>
          <CardTitle>Stored schedule</CardTitle>
          <CardDescription>
            Currently {schedule.enabled ? "enabled" : "disabled"}, opening at{" "}
            {formatWallClock(schedule.openTime)} and locking at{" "}
            {formatWallClock(schedule.closeTime)} on{" "}
            {formatWeekdays(schedule.daysOfWeek)} ({schedule.timezone}). Last
            changed {formatDhaka(schedule.updatedAt)}
            {schedule.updatedBy
              ? ` by ${schedule.updatedBy.name}`
              : " (the admin who changed it has since been deleted)"}
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduleEditor payload={payload} onUpdated={setPayload} />
        </CardContent>
      </Card>
    </div>
  );
}
