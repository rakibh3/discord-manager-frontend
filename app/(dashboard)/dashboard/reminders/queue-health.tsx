"use client";

import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { ReminderQueueStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 10_000;

type Tone = "ok" | "warn" | "down";

/** One subsystem, one word. The detail lives in its tooltip. */
function StatusChip({
  tone,
  label,
  value,
  hint,
}: {
  tone: Tone;
  label: string;
  value: string;
  hint?: string;
}) {
  const Icon = tone === "ok" ? CircleCheck : tone === "warn" ? CircleAlert : CircleX;
  return (
    <span className="flex items-center gap-1.5 text-sm" title={hint}>
      <Icon
        aria-hidden
        className={cn(
          "size-4 shrink-0",
          tone === "ok" && "text-emerald-600 dark:text-emerald-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "down" && "text-destructive",
        )}
      />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

/** A problem worth acting on: one line, plus the exact fix when there is one. */
function Issue({ tone, children }: { tone: Exclude<Tone, "ok">; children: ReactNode }) {
  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded-md px-3 py-2 text-sm",
        tone === "down"
          ? "bg-destructive/10 text-destructive"
          : "bg-amber-500/10 text-amber-800 dark:text-amber-300",
      )}
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

/** Queue, worker, email and tracking health in one compact strip, polled every
 *  10 seconds. Healthy subsystems are a single word; only problems get a line
 *  of their own, and only while they are problems. */
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

  const { queueDepth, email, tracking } = status;
  // Emails were accepted but no tracking event ever arrived: every email reads
  // "not opened", which looks like real data. This is the alarm for that.
  const trackingSilent =
    tracking !== undefined &&
    tracking.sentEmails > 0 &&
    tracking.lastEventAt === null;

  const discordTone: Tone = !status.redisConnected
    ? "down"
    : status.workerRunning
      ? "ok"
      : "warn";
  const emailTone: Tone | null = email
    ? email.mail.configured && email.workerRunning
      ? "ok"
      : "warn"
    : null;
  const trackingTone: Tone | null = tracking
    ? tracking.webhookConfigured && !trackingSilent
      ? "ok"
      : "warn"
    : null;

  const busy = queueDepth
    ? queueDepth.waiting + queueDepth.active + queueDepth.delayed
    : 0;

  return (
    <Card className="py-4">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <StatusChip
            tone={discordTone}
            label="Discord"
            value={
              !status.redisConnected
                ? "Queue down"
                : status.workerRunning
                  ? `Ready · ${status.dmPerSecond}/s`
                  : "Worker stopped"
            }
            hint="DMs are paced deliberately — that pacing keeps the bot from being banned."
          />
          {email && emailTone ? (
            <StatusChip
              tone={emailTone}
              label="Email"
              value={
                !email.mail.configured
                  ? "Not set up"
                  : email.mail.sandbox
                    ? "Sandbox"
                    : email.workerRunning
                      ? `Ready · ${email.emailsPerSecond}/s`
                      : "Worker stopped"
              }
              hint={email.mail.fromEmail ?? undefined}
            />
          ) : null}
          {tracking && trackingTone ? (
            <StatusChip
              tone={trackingTone}
              label="Tracking"
              value={
                !tracking.webhookConfigured
                  ? "Off"
                  : trackingSilent
                    ? "No events yet"
                    : "On"
              }
            />
          ) : null}
          {queueDepth === null ? (
            <span className="text-muted-foreground text-sm">
              Queue depth unavailable
            </span>
          ) : busy > 0 || queueDepth.failed > 0 ? (
            <span className="text-muted-foreground text-sm tabular-nums">
              {queueDepth.waiting} waiting · {queueDepth.active} active
              {queueDepth.delayed ? ` · ${queueDepth.delayed} delayed` : ""}
              {queueDepth.failed ? ` · ${queueDepth.failed} failed` : ""}
            </span>
          ) : null}
        </div>

        <ul className="flex flex-col gap-2 empty:hidden">
          {!status.redisConnected ? (
            <Issue tone="down">
              <strong>Sending is off — Redis is unreachable.</strong> Everything
              else keeps working. Restore Redis; don&rsquo;t restart the server.
              {status.redisError ? ` (${status.redisError})` : null}
            </Issue>
          ) : null}
          {status.redisConnected && !status.workerRunning ? (
            <Issue tone="warn">
              The DM worker isn&rsquo;t running, so a broadcast would stay
              queued.
            </Issue>
          ) : null}
          {email && !email.mail.configured ? (
            <Issue tone="warn">
              Email reminders aren&rsquo;t set up. {email.mail.reason}
            </Issue>
          ) : null}
          {tracking && !tracking.webhookConfigured ? (
            <Issue tone="warn">
              Opens and deliveries can&rsquo;t be tracked until{" "}
              <code className="text-xs">MAILTRAP_WEBHOOK_SIGNING_SECRET</code>{" "}
              is set.
            </Issue>
          ) : trackingSilent ? (
            <Issue tone="warn">
              {tracking.sentEmails.toLocaleString()} email
              {tracking.sentEmails === 1 ? "" : "s"} sent, but Mailtrap
              hasn&rsquo;t reported anything yet — check the webhook on
              reminders.back2rise.site.
              {tracking.signatureRejections > 0
                ? ` ${tracking.signatureRejections} request(s) had a bad signature.`
                : null}
            </Issue>
          ) : null}
        </ul>
      </CardContent>
    </Card>
  );
}
