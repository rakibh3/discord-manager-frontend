"use client";

import { CheckCircle2, XCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type {
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
  if (total <= 1 && failed === 0) return null;

  const variant =
    failed > 0 ? (posted === 0 ? "destructive" : "warning") : "success";

  return (
    <Alert variant={variant}>
      {failed > 0 ? <XCircle /> : <CheckCircle2 />}
      <AlertTitle>
        Posted in {posted} of {total} servers
        {alreadySent > 0 ? ` · ${alreadySent} already had today's message` : ""}
        {failed > 0 ? ` · ${failed} failed` : ""}
      </AlertTitle>
      <AlertDescription>
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
      </AlertDescription>
    </Alert>
  );
}
