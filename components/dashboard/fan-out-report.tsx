"use client";

import { AlertTriangle, CheckCircle2, DoorOpen, XCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatWallClock } from "@/lib/dhaka-date";
import type {
  AnnouncementChannelOutcome,
  AnnouncementSendResult,
  FanOutServer,
  FanOutSummary,
} from "@/lib/api/types";

/** The outcome of an action that fanned out across servers.
 *
 *  ⚠️ This exists because **partial success is HTTP 200**: an open, lock or
 *  announcement that worked in one server and hit `Missing Permissions` in
 *  another still resolves successfully. Reporting that as a plain success would
 *  leave a whole server's students silently unserved, so a failed entry is shown
 *  as a warning with the server named and its error verbatim. */
export function FanOutReport({
  summary,
  servers,
  action,
}: {
  summary: FanOutSummary;
  servers: FanOutServer<unknown>[];
  /** What was attempted, e.g. "Opening #daily-update". */
  action: string;
}) {
  // One server that worked is the ordinary case and needs no report.
  if (summary.failed === 0 && summary.total <= 1) return null;

  const failed = servers.filter((server) => !server.ok);

  if (failed.length === 0) {
    return (
      <Alert variant="success">
        <CheckCircle2 />
        <AlertTitle>
          {action} succeeded in all {summary.total} servers
        </AlertTitle>
        <AlertDescription>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {servers.map((server) => (
              <li key={server.guildId || server.label}>{server.label}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant={summary.succeeded === 0 ? "destructive" : "warning"}>
      <XCircle />
      <AlertTitle>
        {summary.succeeded === 0
          ? `${action} failed in every server`
          : `${action} reached ${summary.succeeded} of ${summary.total} servers`}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>
          The request itself succeeded, so nothing else will flag this. These
          servers were left unchanged:
        </span>
        <ul className="flex flex-col gap-1.5">
          {failed.map((server) => (
            <li
              key={server.guildId || server.label}
              className="flex flex-col gap-0.5"
            >
              <span className="font-medium">{server.label}</span>
              <code className="bg-muted text-muted-foreground overflow-x-auto rounded p-1.5 font-mono text-xs">
                {server.error ?? "No reason given."}
              </code>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

/** The announcement send's own envelope, which is deliberately not the
 *  `ok`/`failed` shape above: each server reports a dispatch **status**, and
 *  `already-sent` is neither a success nor a failure — it is the once-per-day
 *  claim doing its job. Collapsing it into either would be a lie in one
 *  direction or the other. */
export function AnnouncementReport({
  result,
}: {
  result: AnnouncementSendResult;
}) {
  const { total, posted, failed, alreadySent } = result.summary;
  const channel = result.channel;
  // A send that posted everywhere but could not open the channel anywhere is
  // still a broken evening, so the report has to render for it even when the
  // per-server list would have nothing to say.
  const channelFailed = channel.failed.length > 0;
  const unlocked = channel.locksAt === null && channel.opened.length > 0;

  if (total <= 1 && failed === 0 && !channelFailed && !unlocked) return null;

  const variant =
    failed > 0 || channelFailed
      ? posted === 0
        ? "destructive"
        : "warning"
      : unlocked
        ? "warning"
        : "success";

  return (
    <Alert variant={variant}>
      {/* A check mark over a warning-coloured alert reads as "fine" at a
          glance, which an unlockable window is not. */}
      {failed > 0 || channelFailed ? (
        <XCircle />
      ) : unlocked ? (
        <AlertTriangle />
      ) : (
        <CheckCircle2 />
      )}
      <AlertTitle>
        Posted in {posted} of {total} servers
        {alreadySent > 0 ? ` · ${alreadySent} already had today's message` : ""}
        {failed > 0 ? ` · ${failed} failed` : ""}
        {channelFailed
          ? ` · #daily-update did not open in ${channel.failed.length}`
          : ""}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <ul className="flex flex-col gap-1.5">
          {result.servers.map((server) => (
            <li key={server.guildId} className="flex flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{server.label}</span>
                <span className="text-xs">
                  {server.status === "posted"
                    ? `posted as attempt ${server.attempt}`
                    : server.status === "already-sent"
                      ? "already posted today — nothing sent"
                      : server.status === "disabled"
                        ? "the announcement is turned off"
                        : "failed"}
                </span>
              </span>
              {server.status === "failed" ? (
                <code className="bg-muted overflow-x-auto rounded p-1.5 font-mono text-xs">
                  {server.error}
                </code>
              ) : null}
            </li>
          ))}
        </ul>

        <ChannelOutcome channel={channel} />
      </AlertDescription>
    </Alert>
  );
}

/** The channel half of a send. The announcement and the window it opens are one
 *  action on the backend, so they are reported together: a post that landed in a
 *  channel that stayed shut told students to do something they cannot do. */
function ChannelOutcome({
  channel,
}: {
  channel: AnnouncementChannelOutcome;
}) {
  const opened = channel.opened.length;
  const alreadyOpen = channel.alreadyOpen.length;

  return (
    <div className="border-current/20 mt-1 flex flex-col gap-1.5 border-t pt-2 text-sm">
      <span className="flex items-center gap-1.5 font-medium">
        <DoorOpen aria-hidden className="size-3.5" />
        #daily-update
      </span>

      <span>
        {opened > 0
          ? `Opened in ${opened} server${opened === 1 ? "" : "s"}.`
          : "No channel was opened by this send."}
        {alreadyOpen > 0
          ? ` ${alreadyOpen} ${alreadyOpen === 1 ? "was" : "were"} already open and left untouched.`
          : ""}
        {channel.locksAt
          ? ` It locks at ${formatWallClock(channel.locksAt)}.`
          : opened > 0 || alreadyOpen > 0
            ? " No lock is scheduled, so it will stay open past midnight — where a post lands on tomorrow's record. Lock it by hand from the schedule screen."
            : ""}
      </span>

      {channel.failed.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span>
            The announcement went out here but the channel did{" "}
            <strong>not</strong> open — students can read it and cannot submit.
            This is usually a missing <code className="font-mono">Manage
            Roles</code> on the channel itself.
          </span>
          <ul className="flex flex-col gap-1">
            {channel.failed.map((server) => (
              <li key={server.guildId} className="flex flex-col gap-0.5">
                <span className="font-medium">{server.label}</span>
                <code className="bg-muted overflow-x-auto rounded p-1.5 font-mono text-xs">
                  {server.error ?? "No reason given."}
                </code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
