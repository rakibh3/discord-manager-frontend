"use client";

import { AtSign, Megaphone, RefreshCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { sendAnnouncementNow } from "@/actions/announcement";
import { DiscordMessage } from "@/components/dashboard/discord-message";
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
import type { AnnouncementPayload } from "@/lib/api/types";
import { formatCivilDate } from "@/lib/dhaka-date";

/**
 * Manual send, behind a confirmation that shows the real message.
 *
 * This is the most outward-facing action in the dashboard: it posts to a
 * channel roughly 5,000 students read and, when `mentionEveryone` is on, pings
 * all of them. There is no undo, so the dialog renders `preview.content`
 * verbatim — an admin confirming a send should be reading what students will
 * read, not a description of it.
 *
 * The forced send is a separate control rather than a checkbox inside the
 * first dialog. It is the only way past the once-per-day claim, and its correct
 * uses are narrow: recovering a day stuck mid-send, or a genuinely intended
 * second announcement. A *failed* attempt never consumes the day, so an
 * ordinary retry after fixing a permission needs the plain button, not this one.
 */
export function SendAnnouncement({
  payload,
  onRefreshed,
}: {
  payload: AnnouncementPayload;
  onRefreshed: (next: AnnouncementPayload) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"send" | "force" | null>(null);

  const run = (force: boolean) => {
    startTransition(async () => {
      const result = await sendAnnouncementNow(force);

      if (result.ok) {
        toast.success(result.message);
      } else if (result.alreadySent) {
        // Not an error the admin caused — the day-claim did its job and no
        // second message went out. Point at the way past it rather than
        // colouring this red.
        toast.warning(result.message, {
          description:
            "Nothing was posted. Use “Force a second post” if a second message today is genuinely intended.",
        });
      } else {
        toast.error(result.message);
      }

      // The attempt list on screen is stale either way now — a send that
      // failed still filed an attempt.
      if (result.refreshed) onRefreshed(result.refreshed);
      setDialog(null);
    });
  };

  const { preview, template, today } = payload;

  return (
    <div className="flex flex-wrap gap-2">
      <AlertDialog
        open={dialog === "send"}
        onOpenChange={(next) => setDialog(next ? "send" : null)}
      >
        <AlertDialogTrigger asChild>
          <Button disabled={pending || today.posted}>
            <Megaphone data-icon="inline-start" />
            {today.posted ? "Already posted today" : "Send now"}
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
                  This reaches everyone who reads the channel and{" "}
                  <strong>cannot be un-posted</strong>. The stored schedule is
                  not changed.
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
  );
}
