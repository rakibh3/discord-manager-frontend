"use client";

import { Lock, Unlock } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { lockChannelNow, openChannelNow } from "@/actions/schedule";
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
import type { ChannelSchedulePayload } from "@/lib/api/types";

/**
 * Manual open/lock, behind a confirmation.
 *
 * These are the two most outward-facing actions in the whole dashboard: each
 * changes who may post in `#daily-update` immediately and posts an announcement
 * embed that thousands of students see. There is no undo. The dialog names both
 * consequences, and says explicitly that the stored schedule is unchanged —
 * without that, an admin reasonably assumes a manual open has moved the
 * schedule and that the evening lock will not fire.
 */
export function ManualOverride({
  payload,
  onRefreshed,
}: {
  payload: ChannelSchedulePayload;
  onRefreshed: (next: ChannelSchedulePayload) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [openDialog, setOpenDialog] = useState<"open" | "lock" | null>(null);

  const run = (action: "open" | "lock") => {
    startTransition(async () => {
      const result =
        action === "open" ? await openChannelNow() : await lockChannelNow();

      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
        // Never leave an optimistic value on screen after a failure — a 403 or
        // 503 means the channel is in whatever state it was already in, and
        // showing the requested state would be a lie.
        if (result.refreshed) onRefreshed(result.refreshed);
      }
      setOpenDialog(null);
    });
  };

  const isOpen = payload.channel.isOpen;

  return (
    <div className="flex flex-wrap gap-2">
      <AlertDialog
        open={openDialog === "open"}
        onOpenChange={(next) => setOpenDialog(next ? "open" : null)}
      >
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={pending || isOpen}>
            <Unlock data-icon="inline-start" />
            Open channel now
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Open #daily-update now?</AlertDialogTitle>
            <AlertDialogDescription>
              This immediately lets every student post in the channel, and posts
              an <strong>announcement embed</strong> that everyone in the server
              can see. It cannot be un-posted.
              <br />
              <br />
              The stored schedule is <strong>not</strong> changed — the next
              scheduled lock at {payload.schedule.closeTime} still fires as
              normal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                // Keep the dialog mounted while the request is in flight so the
                // pending state is visible and a second click cannot land.
                event.preventDefault();
                run("open");
              }}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Open and announce
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={openDialog === "lock"}
        onOpenChange={(next) => setOpenDialog(next ? "lock" : null)}
      >
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={pending || !isOpen}>
            <Lock data-icon="inline-start" />
            Lock channel now
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lock #daily-update now?</AlertDialogTitle>
            <AlertDialogDescription>
              This immediately stops students posting, and posts an{" "}
              <strong>announcement embed</strong> that everyone in the server
              can see. Anyone part-way through writing an update will not be
              able to send it.
              <br />
              <br />
              The stored schedule is <strong>not</strong> changed — the next
              scheduled open at {payload.schedule.openTime} still fires as
              normal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                run("lock");
              }}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Lock and announce
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
