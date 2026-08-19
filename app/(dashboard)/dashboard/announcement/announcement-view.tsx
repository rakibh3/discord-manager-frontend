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
import {
  announcementAttempts,
  latestAnnouncementOutcome,
} from "@/lib/api/derive";
import type { AnnouncementPayload, AttendanceWindow } from "@/lib/api/types";
import {
  dhakaTimeNow,
  dhakaWeekday,
  formatCivilDate,
  formatDhaka,
  formatWallClock,
} from "@/lib/dhaka-date";
import {
  describeUnresolved,
  explainAnnouncementError,
} from "@/lib/validation/announcement";
import { formatWeekdays } from "@/lib/validation/schedule";

/** Owns the displayed announcement state: a save and a send both return fresh
 *  payloads that replace it directly, and `initial` wins on every server render. */
export function AnnouncementView({
  initial,
  channelWindow,
}: {
  initial: AnnouncementPayload;
  /** The `#daily-update` window, or `null` when it could not be read. Its
   *  `closeTime` bounds the announce time — the announcement opens the channel,
   *  so a time at or after the lock leaves no window to submit in. */
  channelWindow: AttendanceWindow | null;
}) {
  const [payload, setPayload] = useState(initial);

  // The server's view always wins. Adjusted during render so a revalidation
  // never shows one frame of the superseded state.
  const [seenInitial, setSeenInitial] = useState(initial);
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    setPayload(initial);
  }

  const { template, schedule, scheduler, today } = payload;

  // Attempts and channels are per server on the wire — there is no combined
  // list — so today's attempts are flattened here, each tagged with the server
  // it belongs to. Two servers file "attempt 1" independently.
  const servers = today.servers;
  const attempts = announcementAttempts(today);
  const lastOutcome = latestAnnouncementOutcome(scheduler);
  const postedCount = servers.filter((server) => server.posted).length;
  // `today.posted` is true only when *every* server has today's message, so a
  // partial evening is the case the headline badge has to be able to say.
  const partiallyPosted =
    servers.length > 1 && postedCount > 0 && postedCount < servers.length;

  const failedOutcome =
    lastOutcome?.result.status === "failed" ? lastOutcome.result : null;
  const permissionHint = explainAnnouncementError(failedOutcome?.error ?? null);

  // No boot reconcile exists, so a missed announcement is never posted late — a
  // scheduled day whose time has passed with nothing posted needs a human.
  const missedToday =
    !today.posted &&
    schedule.enabled &&
    schedule.daysOfWeek.includes(dhakaWeekday()) &&
    dhakaTimeNow() > schedule.announceTime;

  const stuckAttempt = attempts.find((attempt) => attempt.status === "SENDING");

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
            The scheduled time ({formatWallClock(schedule.announceTime)}) has
            passed and nothing
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
              <Badge
                variant={
                  partiallyPosted
                    ? "warning"
                    : today.posted
                      ? "secondary"
                      : "outline"
                }
              >
                {partiallyPosted
                  ? `Posted in ${postedCount} of ${servers.length}`
                  : today.posted
                    ? "Posted"
                    : "Not posted"}
              </Badge>
            </CardTitle>
            <CardDescription>
              {formatCivilDate(today.date)} · at most one post per day{" "}
              {servers.length > 1 ? "per server " : ""}, enforced by the backend
              rather than by timing.
              {servers.length > 1
                ? " Each server takes its own day-claim, so a failure in one never consumes another's day."
                : null}
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
                <dt className="text-muted-foreground text-xs">
                  {servers.length === 1 ? "Channel ID" : "Channels"}
                </dt>
                <dd className="font-mono text-sm">
                  {servers.length === 1
                    ? (servers[0]?.channelId ?? "—")
                    : `${servers.length} servers`}
                </dd>
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
                <dd className="text-sm font-medium">{attempts.length}</dd>
              </div>
            </dl>

            {servers.length > 1 ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Per server</h3>
                <ul className="flex flex-col gap-1.5">
                  {servers.map((server) => (
                    <li
                      key={server.guildId}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span>{server.label}</span>
                      <div className="flex items-center gap-2">
                        {server.lastOutcome?.result.status === "failed" ? (
                          <span className="text-destructive text-xs">
                            {server.lastOutcome.result.error}
                          </span>
                        ) : null}
                        <Badge variant={server.posted ? "secondary" : "outline"}>
                          {server.posted ? "Posted" : "Not posted"}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <SendAnnouncement
              payload={payload}
              channelWindow={channelWindow}
              onRefreshed={setPayload}
            />
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
            {attempts.length === 0 ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <CircleSlash aria-hidden className="size-4" />
                Nothing has been attempted today.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {attempts.map((attempt) => (
                  <li
                    key={`${attempt.guildId}-${attempt.attempt}`}
                    className="border-border flex flex-col gap-1.5 rounded-md border p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        Attempt {attempt.attempt}
                      </span>
                      {/* Which server filed it: each takes its own day-claim,
                          so attempt numbers repeat across servers. */}
                      {servers.length > 1 ? (
                        <Badge variant="outline" className="font-normal">
                          {attempt.serverLabel}
                        </Badge>
                      ) : null}
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
            {formatWallClock(schedule.announceTime)} on{" "}
            {formatWeekdays(schedule.daysOfWeek)} (
            {schedule.timezone}). Last changed{" "}
            {formatDhaka(template.updatedAt)}
            {template.updatedBy
              ? ` by ${template.updatedBy.name}`
              : " (the admin who changed it has since been deleted)"}
            . The post time is also when{" "}
            <code className="font-mono text-xs">#daily-update</code> opens
            {channelWindow
              ? `, and it locks at ${formatWallClock(channelWindow.closeTime)}`
              : null}
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnnouncementEditor
            payload={payload}
            channelWindow={channelWindow}
            onUpdated={setPayload}
          />
        </CardContent>
      </Card>
    </div>
  );
}
