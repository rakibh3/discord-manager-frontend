"use client";

import { AtSign, DoorOpen, Megaphone, RefreshCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { sendAnnouncementNow } from "@/actions/announcement";
import { DiscordMessage } from "@/components/dashboard/discord-message";
import { AnnouncementReport } from "@/components/dashboard/fan-out-report";
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
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type {
  AnnouncementPayload,
  AnnouncementSendResult,
  AttendanceWindow,
} from "@/lib/api/types";
import { formatCivilDate, formatWallClock } from "@/lib/dhaka-date";

/** Manual send, behind a confirmation that renders `preview.content` verbatim —
 *  it posts to ~5,000 students with no undo. Forced send is a separate control.
 *
 *  The send also **opens `#daily-update`** in the servers it posts to, so the
 *  confirmation names that second effect: it is a permission change on a channel
 *  thousands of students read, and it is not undone by the post being deleted. */
export function SendAnnouncement({
  payload,
  channelWindow,
  onRefreshed,
}: {
  payload: AnnouncementPayload;
  /** The `#daily-update` window this send will open, or `null` when it could
   *  not be read. Used to name the lock time in the confirmation. */
  channelWindow: AttendanceWindow | null;
  onRefreshed: (next: AnnouncementPayload) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"send" | "force" | null>(null);
  const [report, setReport] = useState<AnnouncementSendResult | null>(null);

  const run = (force: boolean) => {
    startTransition(async () => {
      const result = await sendAnnouncementNow(force);

      if (result.ok) {
        // ⚠️ A send that reached some servers and not others still resolves
        // successfully, so a partial result is announced as a warning and the
        // servers left out stay on screen after the toast is gone.
        if (result.partial) toast.warning(result.message);
        else toast.success(result.message);
        setReport(result.result);
      } else if (result.alreadySent) {
        // Not an error the admin caused — the day-claim did its job and no
        // second message went out, so point at the way past it instead.
        toast.warning(result.message, {
          description:
            "Nothing was posted. Use “Force a second post” if a second message today is genuinely intended.",
        });
      } else {
        toast.error(result.message);
        setReport(null);
      }

      // The attempt list on screen is stale either way now — a send that
      // failed still filed an attempt.
      if (result.refreshed) onRefreshed(result.refreshed);
      setDialog(null);
    });
  };

  const { preview, template, today } = payload;
  const servers = today.servers ?? [];
  const pendingServers = servers.filter((server) => !server.posted);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
      <AlertDialog
        open={dialog === "send"}
        onOpenChange={(next) => setDialog(next ? "send" : null)}
      >
        <AlertDialogTrigger asChild>
          <Button disabled={pending || today.posted}>
            <Megaphone data-icon="inline-start" />
            {today.posted
              ? "Already posted today"
              : pendingServers.length > 0 && servers.length > 1
                ? `Send to ${pendingServers.length} remaining server${pendingServers.length === 1 ? "" : "s"}`
                : "Send now"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Post this to #attendance now?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-3">
                <span>
                  This posts to <strong>#attendance in every configured
                  server</strong>, reaches everyone who reads the channel, and{" "}
                  <strong>cannot be un-posted</strong>. The stored schedule is
                  not changed. If it succeeds in some servers and fails in
                  others the request still succeeds — the per-server outcome is
                  shown afterwards.
                </span>

                <span className="flex items-start gap-2">
                  <DoorOpen aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <span>
                    It also <strong>opens #daily-update</strong> wherever it
                    posts, so students can submit straight away
                    {channelWindow?.closeTime
                      ? ` until ${formatWallClock(channelWindow.closeTime)}`
                      : null}
                    . Tomorrow still opens at the scheduled time — this does not
                    move it.
                    {channelWindow?.enabled === false
                      ? " The channel schedule is turned off, so nothing will lock it again: it has to be locked by hand."
                      : null}
                  </span>
                </span>

                {template.mentionEveryone ? (
                  <span className="text-warning flex items-start gap-2 font-medium">
                    <AtSign aria-hidden className="mt-0.5 size-4 shrink-0" />
                    This message pings <strong>@everyone</strong> — every member
                    of the server is notified.
                  </span>
                ) : null}

                <span>Exactly what will be posted:</span>
                <DiscordMessage
                  content={preview.content}
                  className="max-h-64 overflow-auto text-left"
                />

                {preview.mentions.unresolved.length > 0 ? (
                  <span className="text-muted-foreground text-xs">
                    {preview.mentions.unresolved.length} mention target(s) no
                    longer resolve and will be dropped from this post.
                  </span>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                run(false);
              }}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Post to #attendance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={dialog === "force"}
        onOpenChange={(next) => setDialog(next ? "force" : null)}
      >
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={pending}>
            <RefreshCcw data-icon="inline-start" />
            Force a second post
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Post a second message today?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-3">
                <span>
                  This bypasses the once-per-day guard and posts a{" "}
                  <strong>real second message</strong> to #attendance for{" "}
                  {formatCivilDate(today.date)}, filed as the next attempt.
                </span>
                <span>
                  You only need this to recover a day stuck mid-send, or when a
                  second announcement is genuinely intended. A send that{" "}
                  <strong>failed</strong> did not consume the day — retry with
                  the ordinary button instead, or this will post twice.
                </span>
                <span>
                  A channel that is already open is left alone, so this will not
                  post a second &ldquo;Channel is OPEN&rdquo; embed on top of
                  the second message.
                </span>

                {template.mentionEveryone ? (
                  <span className="text-warning flex items-start gap-2 font-medium">
                    <AtSign aria-hidden className="mt-0.5 size-4 shrink-0" />
                    This message pings <strong>@everyone</strong> — a second
                    guild-wide notification tonight.
                  </span>
                ) : null}

                <DiscordMessage
                  content={preview.content}
                  className="max-h-64 overflow-auto text-left"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                run(true);
              }}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Post a second message
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>

      {report ? <AnnouncementReport result={report} /> : null}
    </div>
  );
}
