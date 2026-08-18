"use client";

import {
  AlertTriangle,
  AtSign,
  CheckCircle2,
  CircleSlash,
  Clock,
  Info,
  Megaphone,
} from "lucide-react";
import { useState } from "react";

import { AnnouncementEditor } from "./announcement-editor";
import { SendAnnouncement } from "./send-announcement";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AnnouncementPayload } from "@/lib/api/types";
import {
  dhakaTimeNow,
  dhakaWeekday,
  formatCivilDate,
  formatDhaka,
} from "@/lib/dhaka-date";
import {
  describeUnresolved,
  explainAnnouncementError,
} from "@/lib/validation/announcement";
import { formatWeekdays } from "@/lib/validation/schedule";

/**
 * Owns the displayed announcement state.
 *
 * A save and a send both return authoritative fresh payloads, so they replace
 * what is on screen directly rather than waiting for a revalidation round trip.
 * `initial` still wins whenever the server re-renders, so nothing here can
 * drift from the server's view.
 */
export function AnnouncementView({
  initial,
}: {
  initial: AnnouncementPayload;
}) {
  const [payload, setPayload] = useState(initial);

  // The server's view always wins. Adjusted during render so a revalidation
  // never shows one frame of the superseded state.
  const [seenInitial, setSeenInitial] = useState(initial);
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    setPayload(initial);
  }

  const { template, schedule, scheduler, channel, today } = payload;

  const lastOutcome = scheduler.lastOutcome;
  const failedOutcome =
    lastOutcome?.result.status === "failed" ? lastOutcome.result : null;
  const permissionHint = explainAnnouncementError(failedOutcome?.error ?? null);

  // No boot reconcile exists: a missed announcement is never posted late. If
  // today is a scheduled day whose time has passed with nothing posted, that
  // day needs a human — nothing else will notice.
  const missedToday =
    !today.posted &&
    schedule.enabled &&
    schedule.daysOfWeek.includes(dhakaWeekday()) &&
    dhakaTimeNow() > schedule.announceTime;

  const stuckAttempt = today.attempts.find(
    (attempt) => attempt.status === "SENDING",
  );

  return (
    <div className="flex flex-col gap-4">
      {/* A nightly guild-wide ping is the single most consequential setting on
          this screen, so it is stated before anything else rather than being
          buried as a switch in the editor below. */}
      {template.mentionEveryone ? (
        <Alert variant="warning">
          <AtSign />
          <AlertTitle>This announcement pings @everyone</AlertTitle>
          <AlertDescription>
            Every member of the server is notified each time it posts, and it
            stays that way until someone turns it off in the editor below.
            {template.updatedBy
              ? ` Last changed by ${template.updatedBy.name}.`
              : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {failedOutcome ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>The last announcement failed to post</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            {permissionHint ? <span>{permissionHint}</span> : null}
            {failedOutcome.notConnected ? (
              <span>
                The bot was not connected to Discord when this ran. Member sync
                and reminder DMs are affected too.
              </span>
            ) : null}
            <code className="bg-muted text-muted-foreground overflow-x-auto rounded p-2 font-mono text-xs">
              {failedOutcome.error}
            </code>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Timed post off on this process — explains an empty nextRunAt without
          implying the stored schedule is wrong. */}
      {!scheduler.processEnabled ? (
        <Alert variant="warning">
          <Info />
          <AlertTitle>Timed posting is off on this process</AlertTitle>
          <AlertDescription>
            <code className="font-mono text-xs">SCHEDULER_ENABLED</code> is
            false on the backend process serving this request, so the
            announcement will <strong>not</strong> post on schedule. The message
            and schedule below are still saved and still authoritative, and
            &ldquo;Send now&rdquo; still works.
          </AlertDescription>
        </Alert>
      ) : null}

      {missedToday ? (
        <Alert variant="warning">
          <Clock />
          <AlertTitle>Today&rsquo;s announcement has not been posted</AlertTitle>
          <AlertDescription>
            The scheduled time ({schedule.announceTime}) has passed and nothing
            went out. There is deliberately no catch-up — a missed announcement
            is never posted late — so today needs a manual send.
          </AlertDescription>
        </Alert>
      ) : null}

      {stuckAttempt ? (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>
            Attempt {stuckAttempt.attempt} is stuck mid-send
          </AlertTitle>
          <AlertDescription>
            It claimed today but never recorded a result, which means the
            backend crashed between the claim and the post. Whether a message
            actually reached the channel is unknown — check{" "}
            <code className="font-mono text-xs">#attendance</code> in Discord
            first, then use the forced send to recover the day if nothing is
            there.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Today
              <Badge variant={today.posted ? "secondary" : "outline"}>
                {today.posted ? "Posted" : "Not posted"}
              </Badge>
            </CardTitle>
            <CardDescription>
              {formatCivilDate(today.date)} · at most one post per day, enforced
              by the backend rather than by timing.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs">Next run</dt>
                <dd className="text-sm font-medium">
                  {scheduler.nextRunAt ? (
                    formatDhaka(scheduler.nextRunAt)
                  ) : (
                    <span className="text-muted-foreground font-normal">
                      Not scheduled —{" "}
                      {!schedule.enabled
                        ? "the announcement is turned off."
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
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs">Attempts today</dt>
                <dd className="text-sm font-medium">
                  {today.attempts.length}
                </dd>
              </div>
            </dl>

            <SendAnnouncement payload={payload} onRefreshed={setPayload} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attempts today</CardTitle>
            <CardDescription>
              Every send filed against {formatCivilDate(today.date)}, scheduled
              and manual alike. A failed attempt does not consume the day.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {today.attempts.length === 0 ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <CircleSlash aria-hidden className="size-4" />
                Nothing has been attempted today.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {today.attempts.map((attempt) => (
                  <li
                    key={attempt.attempt}
                    className="border-border flex flex-col gap-1.5 rounded-md border p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        Attempt {attempt.attempt}
                      </span>
                      <Badge
                        variant={
                          attempt.status === "POSTED"
                            ? "secondary"
                            : attempt.status === "FAILED"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {attempt.status === "SENDING"
                          ? "Sending"
                          : attempt.status === "POSTED"
                            ? "Posted"
                            : "Failed"}
                      </Badge>
                      <Badge variant="outline">
                        {attempt.trigger === "MANUAL" ? "Manual" : "Scheduled"}
                      </Badge>
                    </div>

                    <p className="text-muted-foreground text-xs">
                      {formatDhaka(attempt.createdAt)}
                      {attempt.discordMessageId ? (
                        <>
                          {" · message "}
                          <code className="font-mono">
                            {attempt.discordMessageId}
                          </code>
                        </>
                      ) : null}
                    </p>

                    {attempt.error ? (
                      <code className="bg-muted text-muted-foreground overflow-x-auto rounded p-2 font-mono text-xs">
                        {attempt.error}
                      </code>
                    ) : null}

                    {/* Dropped targets do not block a post, so they are only
                        ever visible here. A role deleted months ago would
                        otherwise silently stop being pinged. */}
                    {attempt.unresolvedTargets.length > 0 ? (
                      <p className="text-muted-foreground text-xs">
                        Dropped from this post:{" "}
                        {attempt.unresolvedTargets
                          .map(describeUnresolved)
                          .join("; ")}
                        .
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {lastOutcome && lastOutcome.result.status === "posted" ? (
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <CheckCircle2 aria-hidden className="size-3.5" />
                Last scheduler outcome: posted{" "}
                {formatDhaka(lastOutcome.ranAt)}.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone aria-hidden className="size-4" />
            Message and schedule
          </CardTitle>
          <CardDescription>
            Currently {schedule.enabled ? "enabled" : "disabled"}, posting at{" "}
            {schedule.announceTime} on {formatWeekdays(schedule.daysOfWeek)} (
            {schedule.timezone}). Last changed{" "}
            {formatDhaka(template.updatedAt)}
            {template.updatedBy
              ? ` by ${template.updatedBy.name}`
              : " (the admin who changed it has since been deleted)"}
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnnouncementEditor payload={payload} onUpdated={setPayload} />
        </CardContent>
      </Card>
    </div>
  );
}
