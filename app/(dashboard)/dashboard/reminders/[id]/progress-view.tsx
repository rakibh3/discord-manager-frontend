"use client";

import { Ban, Mail } from "lucide-react";
import Link from "next/link";
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
import { formatDhaka } from "@/lib/dhaka-date";
import { WEEKDAY_SHORT } from "@/lib/period";
import {
  BROADCAST_STATUS_LABEL,
  broadcastStatusDescription,
  channelsLabel,
  EMAIL_STATE_DESCRIPTION,
  CRITERION_LABEL,
  estimateRemaining,
  isLive,
  reminderPeriodLabel,
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

/** Live broadcast progress. The first read is server-rendered, and polling runs
 *  only while the status is `PENDING` or `PROCESSING`. */
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

  // Adjust during render, not in an effect: a server re-render with fresher
  // progress supersedes polling without showing a stale frame first.
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
        const response = await fetch(`/api/reminders/${progress.id}/progress`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;
        setProgress((await response.json()) as ReminderProgress);
      } catch {
        // A failed tick leaves the last known progress on screen and the next
        // one retries; an error page would discard a live view of a long job.
      }
    }, POLL_INTERVAL_MS);

    // Terminal status, unmount, or navigation away mid-run.
    return () => {
      cancelled = true;
      clearInterval(timer);
      controller.abort();
    };
  }, [progress.id, progress.status]);

  // Both channels count toward "processed": a broadcast is finished when every
  // DM row AND every sendable email row has an outcome. NO_ADDRESS email rows
  // are settled from the start and are left out of both sides.
  const viaDiscord =
    !progress.channels || progress.channels.includes("DISCORD");
  const email = progress.email ?? null;
  const emailSendable = email ? email.total - email.no_address : 0;
  const emailSettled = email ? emailSendable - email.pending : 0;
  const dmProcessed = progress.delivered + progress.dmClosed + progress.failed;
  const processed = (viaDiscord ? dmProcessed : 0) + emailSettled;
  const toProcess = (viaDiscord ? progress.targetCount : 0) + emailSendable;
  const percent = toProcess > 0 ? Math.round((processed / toProcess) * 100) : 0;

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
          Broadcast for {reminderPeriodLabel(progress)}
          <Badge variant="outline">{channelsLabel(progress.channels)}</Badge>
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
            {processed.toLocaleString()} of {toProcess.toLocaleString()}{" "}
            {viaDiscord && email ? "DMs and emails" : email ? "emails" : ""}{" "}
            processed ({percent}%).
            {progress.uniqueRecipients !== undefined &&
            progress.uniqueRecipients !== progress.targetCount ? (
              <>
                {" "}
                Those are recipient rows across servers;{" "}
                {progress.uniqueRecipients.toLocaleString()} actual people were
                messaged, each exactly once.
              </>
            ) : null}
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

        {viaDiscord ? (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Count
              label="DMs delivered"
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
                progress.status === "CANCELLED"
                  ? "Never attempted"
                  : "Remaining"
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
        ) : null}

        {email ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium">
                Email
                {email.openRate !== null ? (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · {Math.round(email.openRate * 100)}% of delivered opened
                  </span>
                ) : null}
              </h2>
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/dashboard/reminders/emails?reminder=${progress.id}`}
                >
                  <Mail data-icon="inline-start" />
                  Open the email log
                </Link>
              </Button>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Count
                label="Delivered"
                value={email.delivered}
                color={CHART_COLORS.positive}
                hint={EMAIL_STATE_DESCRIPTION.delivered}
              />
              <Count
                label="Opened"
                value={email.opened}
                color={CHART_COLORS.positive}
                hint="Estimated from a tracking pixel."
              />
              <Count
                label="Not opened yet"
                value={email.not_opened}
                color={CHART_COLORS.neutral}
                hint="Delivered, no open recorded."
              />
              <Count
                label="Bounced or failed"
                value={email.bounced + email.failed}
                color={CHART_COLORS.negative}
                hint="Refused by the receiving server or by Mailtrap."
              />
              <Count
                label="Not registered"
                value={email.no_address}
                color={CHART_COLORS.caution}
                hint="No email address on record, so no email was sent."
              />
            </dl>
            {email.pending + email.awaiting > 0 ? (
              <p className="text-muted-foreground text-xs">
                {email.pending.toLocaleString()} still queued,{" "}
                {email.awaiting.toLocaleString()} sent and awaiting a delivery
                report from Mailtrap.
              </p>
            ) : null}
          </div>
        ) : null}

        {/*
          The rule the broadcast ran under, not a recomputation of it: members
          join and leave, so asking "who would this target now" gives a different
          answer than it did at send time. The stored rule is the only honest
          record of who was chosen and why.
        */}
        <dl className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Period</dt>
            <dd>{reminderPeriodLabel(progress)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Targeted</dt>
            <dd>
              {progress.criterion
                ? CRITERION_LABEL[progress.criterion].toLowerCase()
                : "no daily update"}
              {progress.minMissedDays && progress.minMissedDays > 1
                ? `, on at least ${progress.minMissedDays} days`
                : ""}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Weekdays counted</dt>
            <dd>
              {progress.daysOfWeek && progress.daysOfWeek.length > 0
                ? progress.daysOfWeek
                    .map((day) => WEEKDAY_SHORT[day])
                    .join(", ")
                : "Every day"}
            </dd>
          </div>
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
