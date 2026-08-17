"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { DailyStatusMemberDetail } from "@/lib/api/types";
import { formatDhaka } from "@/lib/dhaka-date";
import {
  DAILY_STATUS_DESCRIPTION,
  DAILY_STATUS_LABEL,
  statusBadgeVariant,
} from "./status-labels";

/**
 * Per-member detail.
 *
 * Focus management is handled by `Dialog`: it traps focus while open and
 * returns it to the trigger — the table row's own button — on dismiss, so a
 * keyboard user is put back exactly where they were rather than at the top of
 * a long table.
 */
export function MemberDetail({
  memberId,
  date,
  label,
}: {
  memberId: string;
  date: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<DailyStatusMemberDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/daily-status/members/${memberId}?date=${encodeURIComponent(date)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Could not load this member.");
      setDetail((await response.json()) as DailyStatusMemberDetail);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load this member.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && !detail) void load();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Everything recorded for this member on the selected day, in
            Asia/Dhaka.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Spinner /> Loading…
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        {detail ? (
          <div className="flex flex-col gap-4">
            <Badge variant={statusBadgeVariant(detail.status)} className="self-start">
              {DAILY_STATUS_LABEL[detail.status]}
            </Badge>
            <p className="text-muted-foreground text-sm">
              {DAILY_STATUS_DESCRIPTION[detail.status]}
            </p>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs">Name</dt>
                <dd>{detail.name ?? "Not recorded"}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs">Discord</dt>
                <dd className="font-mono text-xs">{detail.discordUsername}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs">Phone</dt>
                <dd>{detail.phone ?? "Not recorded"}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs">Email</dt>
                <dd className="break-all">{detail.email ?? "Not recorded"}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:col-span-2">
                <dt className="text-muted-foreground text-xs">
                  Attendance submitted
                </dt>
                <dd>
                  {detail.hasAttendance
                    ? formatDhaka(detail.attendanceSubmittedAt)
                    : "No attendance submitted for this day."}
                </dd>
              </div>
            </dl>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">
                Messages in #daily-update
              </h3>
              {detail.messages.length === 0 ? (
                // Stated explicitly, rather than leaving an empty area that
                // reads as a loading failure.
                <p className="text-muted-foreground text-sm">
                  This member posted no daily update on this day.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {detail.messages.map((message) => (
                    <li
                      key={message.id}
                      className="bg-muted flex flex-col gap-1 rounded-md p-3"
                    >
                      <time className="text-muted-foreground text-xs">
                        {formatDhaka(message.postedAt, "time")}
                      </time>
                      <p className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
