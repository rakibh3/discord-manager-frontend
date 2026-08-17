"use client";

import { Ban } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelBroadcast } from "@/actions/reminders";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { CHART_COLORS } from "@/components/viz/chart-tokens";
import type { ReminderProgress } from "@/lib/api/types";
import { formatCivilDate, formatDhaka } from "@/lib/dhaka-date";
import {
  BROADCAST_STATUS_LABEL,
  broadcastStatusDescription,
  estimateRemaining,
  isLive,
} from "@/lib/reminder-labels";

const POLL_INTERVAL_MS = 3000;

function Count({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: number;
  color: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border p-3">
      <dt className="flex items-center gap-2 text-xs">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-[2px]"
          style={{ background: color }}
        />
        {label}
      </dt>
      <dd className="font-mono text-xl font-semibold tabular-nums">
        {value.toLocaleString()}
      </dd>
      {hint ? (
        <p className="text-muted-foreground text-xs leading-snug">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Live broadcast progress.
 *
 * The first read is server-rendered and handed in as `initial`, so there is no
 * empty flash. Polling runs **only** while the status is `PENDING` or
 * `PROCESSING` and stops the moment it goes terminal — a completed broadcast
 * that keeps polling is a request every three seconds forever.
 */
export function ProgressView({
  initial,
  dmPerSecond,
}: {
  initial: ReminderProgress;
  dmPerSecond: number;
}) {
  const [progress, setProgress] = useState(initial);
  const [cancelling, startCancel] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Adjust state during render rather than in an effect: when the server
  // re-renders with fresher progress, it supersedes whatever polling last put
  // here. Doing this in an effect would render one frame of stale data first.
  const [seenInitial, setSeenInitial] = useState(initial);
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    setProgress(initial);
  }

  useEffect(() => {
    if (!isLive(progress.status)) return;

    const controller = new AbortController();
    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/reminders/${progress.id}/progress`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok || cancelled) return;
        setProgress((await response.json()) as ReminderProgress);
      } catch {
        // A failed tick leaves the last known progress on screen and the next
        // tick retries. An error page here would discard a live view of a
        // 40-minute job over one dropped request.
      }
    }, POLL_INTERVAL_MS);

    // Terminal status, unmount, or navigation away mid-run.
    return () => {
      cancelled = true;
      clearInterval(timer);
      controller.abort();
    };
  }, [progress.id, progress.status]);

  const processed = progress.delivered + progress.dmClosed + progress.failed;
  const percent =
    progress.targetCount > 0
      ? Math.round((processed / progress.targetCount) * 100)
      : 0;

  const live = isLive(progress.status);
  const estimate = live
    ? estimateRemaining(progress.outstanding, dmPerSecond)
    : null;

  const cancel = () => {
    startCancel(async () => {
      const result = await cancelBroadcast(progress.id);
      if (result.ok) {
        // The payload already shows CANCELLED, which also stops the poll.
        setProgress(result.progress);
        toast.success("Broadcast cancelled. Nothing further will be sent.");
      } else {
        toast.error(result.message);
        // A 409 means it finished on its own between render and click — pull
        // the true final state rather than leaving a stale "sending" view.
        try {
          const response = await fetch(
            `/api/reminders/${progress.id}/progress`,
            { cache: "no-store" },
          );
          if (response.ok) {
            setProgress((await response.json()) as ReminderProgress);
          }
        } catch {
          // Leave the last known state; the next page load reconciles it.
        }
      }
      setDialogOpen(false);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Broadcast for {formatCivilDate(progress.reminderDate)}
          <Badge
            variant={
              progress.status === "FAILED"
                ? "destructive"
                : progress.status === "COMPLETED"
                  ? "secondary"
                  : progress.status === "CANCELLED"
                    ? "outline"
                    : "default"
            }
          >
            {BROADCAST_STATUS_LABEL[progress.status]}
          </Badge>
        </CardTitle>
        <CardDescription>
          {broadcastStatusDescription(progress.status)}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {progress.status === "FAILED" ? (
          <Alert variant="destructive">
            <AlertTitle>This broadcast did not finish</AlertTitle>
            <AlertDescription>
              The queue drained while {progress.outstanding.toLocaleString()}{" "}
              recipient{progress.outstanding === 1 ? " was" : "s were"} still
              pending. That pattern points to a worker that stalled or crashed
              rather than to Discord rejecting messages — check the worker
              process and Redis on the backend before re-sending.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2">
          <Progress value={percent} aria-label="Delivery progress" />
          <p
            role="status"
            aria-live="polite"
            className="text-muted-foreground text-sm"
          >
            {processed.toLocaleString()} of{" "}
            {progress.targetCount.toLocaleString()} processed ({percent}%).
            {estimate ? (
              <>
                {" "}
                <strong className="text-foreground">
                  Roughly {estimate} remaining
                </strong>{" "}
                at {dmPerSecond} DM{dmPerSecond === 1 ? "" : "s"} per second —
                the bar moves slowly because delivery is paced deliberately, not
                because anything is stuck.
              </>
            ) : null}
          </p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Count
            label="Delivered"
            value={progress.delivered}
            color={CHART_COLORS.positive}
            hint="The direct message was accepted by Discord."
          />
          <Count
            label="DMs closed"
            value={progress.dmClosed}
            color={CHART_COLORS.caution}
            hint="Not a failure. These members have DMs off and are mentioned in #daily-update-reminder once the queue drains."
          />
          <Count
            label="Failed"
            value={progress.failed}
            color={CHART_COLORS.negative}
            hint="Discord rejected the message for some reason other than closed DMs."
          />
          <Count
            label={
              progress.status === "CANCELLED" ? "Never attempted" : "Remaining"
            }
            value={progress.outstanding}
            color={CHART_COLORS.neutral}
            hint={
              progress.status === "CANCELLED"
                ? "The broadcast was stopped before reaching these members. They were never messaged — this is not a failure."
                : "Still queued."
            }
          />
        </dl>

        <dl className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Queued</dt>
            <dd>{formatDhaka(progress.createdAt)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Started</dt>
            <dd>{formatDhaka(progress.startedAt)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Completed</dt>
            <dd>{formatDhaka(progress.completedAt)}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Message sent</h2>
          <p className="bg-muted text-muted-foreground rounded-md p-3 text-sm whitespace-pre-wrap">
            {progress.message}
          </p>
        </div>

        {live ? (
          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="self-start">
                <Ban data-icon="inline-start" />
                Cancel broadcast
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Stop this broadcast?</AlertDialogTitle>
                <AlertDialogDescription>
                  The{" "}
                  <strong>
                    {processed.toLocaleString()} member
                    {processed === 1 ? "" : "s"}
                  </strong>{" "}
                  already reached are unaffected — their messages have been
                  delivered and cannot be recalled.
                  <br />
                  <br />
                  The remaining{" "}
                  <strong>{progress.outstanding.toLocaleString()}</strong> will
                  never be attempted. They will not be messaged at all, and will
                  show as &ldquo;never attempted&rdquo; rather than as failures.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={cancelling}>
                  Keep sending
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={cancelling}
                  onClick={(event) => {
                    event.preventDefault();
                    cancel();
                  }}
                >
                  {cancelling ? <Spinner data-icon="inline-start" /> : null}
                  Stop the broadcast
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </CardContent>
    </Card>
  );
}
