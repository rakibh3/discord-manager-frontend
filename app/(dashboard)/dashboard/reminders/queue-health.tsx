"use client";

import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ReminderQueueStatus } from "@/lib/api/types";

const POLL_INTERVAL_MS = 10_000;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-mono text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Queue and worker health, polled every 10 seconds. `redisConnected: false`
 *  means sending is down but the bot, ingestion and scheduler are unaffected. */
export function QueueHealthPanel({
  initial,
}: {
  initial: ReminderQueueStatus;
}) {
  const [status, setStatus] = useState(initial);

  // A fresher server render supersedes the last polled value. Adjusted during
  // render rather than in an effect, so no stale frame is shown first.
  const [seenInitial, setSeenInitial] = useState(initial);
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    setStatus(initial);
  }

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const response = await fetch("/api/reminders/status", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;
        setStatus((await response.json()) as ReminderQueueStatus);
      } catch {
        // A dropped tick keeps the last known values on screen; the next tick
        // retries. Queue health is not worth an error banner every 10 seconds.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      controller.abort();
    };
  }, []);

  const { queueDepth } = status;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Queue health
          <Badge variant={status.redisConnected ? "secondary" : "destructive"}>
            {status.redisConnected ? "Redis connected" : "Redis unreachable"}
          </Badge>
          <Badge variant={status.workerRunning ? "secondary" : "outline"}>
            {status.workerRunning
              ? "Worker running"
              : status.workerEnabled
                ? "Worker stopped"
                : "Worker disabled"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Refreshes every 10 seconds. Delivery is paced at{" "}
          {status.dmPerSecond} DM{status.dmPerSecond === 1 ? "" : "s"} per
          second — that pacing is what keeps the bot from being banned.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {!status.redisConnected ? (
          <Alert variant="destructive">
            <AlertTitle>Sending is unavailable</AlertTitle>
            <AlertDescription>
              The reminder queue&rsquo;s Redis connection is down, so{" "}
              <strong>a send will be rejected with 503</strong> and the send
              control is disabled.
              <br />
              <br />
              Everything else keeps working normally — the API, the Discord bot,
              daily-update message ingestion and the channel scheduler are all
              unaffected. <strong>Do not restart the server</strong>; that would
              take down the parts that are fine. Restore Redis instead.
              {status.redisError ? (
                <>
                  {" "}
                  Reported error: <em>{status.redisError}</em>
                </>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        {status.redisConnected && !status.workerRunning ? (
          <Alert variant="warning">
            <AlertTitle>
              {status.workerEnabled
                ? "The worker is not running"
                : "The worker is disabled on this process"}
            </AlertTitle>
            <AlertDescription>
              Jobs can still be queued, but nothing will be delivered until a
              worker picks them up. A broadcast queued now would sit at{" "}
              <strong>Queued</strong> indefinitely.
            </AlertDescription>
          </Alert>
        ) : null}

        <dl className="grid gap-3 sm:grid-cols-4">
          {queueDepth ? (
            <>
              <Stat label="Waiting" value={queueDepth.waiting.toLocaleString()} />
              <Stat label="Active" value={queueDepth.active.toLocaleString()} />
              <Stat label="Delayed" value={queueDepth.delayed.toLocaleString()} />
              <Stat label="Failed jobs" value={queueDepth.failed.toLocaleString()} />
            </>
          ) : (
            // `null` means the queue object could not be reached; rendering
            // zeros would read as "the queue is empty", the opposite meaning.
            <div className="text-muted-foreground sm:col-span-4 text-sm">
              Queue depth is unavailable — the queue could not be reached, so
              there is no count to show. This is not the same as an empty queue.
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
