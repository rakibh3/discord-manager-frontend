"use client";

import { Lock, Unlock } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { lockChannelNow, openChannelNow } from "@/actions/schedule";
import { FanOutReport } from "@/components/dashboard/fan-out-report";
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
import { combinedChannelState } from "@/lib/api/derive";
import type {
  ChannelSchedulePayload,
  FanOutServer,
  FanOutSummary,
} from "@/lib/api/types";
import { formatWallClock } from "@/lib/dhaka-date";

/** Manual open/lock, behind a confirmation: each changes who may post in
 *  `#daily-update` and posts an embed. The dialog says the schedule is unchanged.
 *
 *  ⚠️ Both fan out across **every** configured server, and a request that worked
 *  in one and failed in another still answers HTTP 200 — so the outcome is
 *  reported from the per-server results rather than from the call resolving. */
export function ManualOverride({
  payload,
  onRefreshed,
}: {
  payload: ChannelSchedulePayload;
  onRefreshed: (next: ChannelSchedulePayload) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [openDialog, setOpenDialog] = useState<"open" | "lock" | null>(null);
  const [report, setReport] = useState<{
    action: string;
    summary: FanOutSummary;
    servers: FanOutServer<{ announced: boolean }>[];
  } | null>(null);

  const servers = payload.servers;
  const serverCount = servers.length;
  const scope =
    serverCount > 1 ? `all ${serverCount} configured servers` : "the server";

  const run = (action: "open" | "lock") => {
    startTransition(async () => {
      const result =
        action === "open" ? await openChannelNow() : await lockChannelNow();

      if (result.ok) {
        // A partial success is not a success story: it is shown as a warning,
        // and the servers left behind stay on screen after the toast is gone.
        if (result.partial) toast.warning(result.message);
        else toast.success(result.message);

        setReport({
          action: action === "open" ? "Opening #daily-update" : "Locking #daily-update",
          summary: result.summary,
          servers: result.servers,
        });
      } else {
        toast.error(result.message);
        setReport(null);
        // Never leave an optimistic value on screen after a failure — a 403 or
        // 503 means the channel is still in whatever state it was.
        if (result.refreshed) onRefreshed(result.refreshed);
      }
      setOpenDialog(null);
    });
  };

  // There is no single channel state — it is derived, and it is only safe to
  // disable a button when every server agrees. While they disagree both stay
  // live, so the server that missed out can be brought into line.
  const { isOpen, mixed, unknown } = combinedChannelState(servers);
  // A channel that could not be read is unknown, not locked: disabling the
  // button on it would strand the one server nobody can see.
  const undecided = mixed || unknown > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <AlertDialog
          open={openDialog === "open"}
          onOpenChange={(next) => setOpenDialog(next ? "open" : null)}
        >
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={pending || (isOpen && !undecided)}>
              <Unlock data-icon="inline-start" />
              Open channel now
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Open #daily-update in {scope}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This immediately lets every student post in the channel, and
                posts an <strong>announcement embed</strong> that everyone in{" "}
                {serverCount > 1 ? "each server" : "the server"} can see. It
                cannot be un-posted.
                <br />
                <br />
                The stored schedule is <strong>not</strong> changed — the next
                scheduled lock at {formatWallClock(payload.schedule.closeTime)}{" "}
                still fires as normal.
                {serverCount > 1 ? (
                  <>
                    <br />
                    <br />
                    If it succeeds in some servers and fails in others, that is
                    reported here rather than as an error — the per-server
                    outcome is shown after the run.
                  </>
                ) : null}
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
            <Button variant="outline" disabled={pending || (!isOpen && !undecided)}>
              <Lock data-icon="inline-start" />
              Lock channel now
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Lock #daily-update in {scope}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This immediately stops students posting, and posts an{" "}
                <strong>announcement embed</strong> that everyone in{" "}
                {serverCount > 1 ? "each server" : "the server"} can see. Anyone
                part-way through writing an update will not be able to send it.
                <br />
                <br />
                The stored schedule is <strong>not</strong> changed — the next
                scheduled open at {formatWallClock(payload.schedule.openTime)}{" "}
                still fires as normal.
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

      {report ? (
        <FanOutReport
          action={report.action}
          summary={report.summary}
          servers={report.servers}
        />
      ) : null}
    </div>
  );
}
