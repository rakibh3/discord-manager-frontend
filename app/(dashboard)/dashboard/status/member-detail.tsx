"use client";

import { useState } from "react";

import {
  DAILY_STATUS_DESCRIPTION,
  DAILY_STATUS_LABEL,
  RANGE_STATUS_DESCRIPTION,
  RANGE_STATUS_LABEL,
  rangeStatusBadgeVariant,
  statusBadgeVariant,
} from "./status-labels";
import { ServerBadges } from "@/components/dashboard/server-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  isRangeDetail,
  type DailyStatusAnyMemberDetail,
} from "@/lib/api/types";
import { formatCivilDate, formatDhaka } from "@/lib/dhaka-date";
import { formatPeriod, periodSearchParams, type Period } from "@/lib/period";

/** Per-person detail. `Dialog` traps focus and returns it to the triggering row
 *  on dismiss, so a keyboard user is not dropped at the top of a long table.
 *
 *  The endpoint describes the whole **person**, whichever server's member record
 *  the id names, and merges every server's messages into one timeline tagged
 *  with where each was posted. */
export function MemberDetail({
  memberId,
  period,
  label,
}: {
  memberId: string;
  period: Period;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<DailyStatusAnyMemberDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams(periodSearchParams(period));
      const response = await fetch(
        `/api/daily-status/members/${memberId}?${query.toString()}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Could not load this member.");
      setDetail((await response.json()) as DailyStatusAnyMemberDetail);
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
            Everything recorded for this person over {formatPeriod(period)}, in
            Asia/Dhaka, across every server they are in.
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
            {isRangeDetail(detail) ? (
              <>
                <Badge
                  variant={rangeStatusBadgeVariant(detail.rangeStatus)}
                  className="self-start"
                >
                  {RANGE_STATUS_LABEL[detail.rangeStatus]}
                </Badge>
                <p className="text-muted-foreground text-sm">
                  {RANGE_STATUS_DESCRIPTION[detail.rangeStatus]}
                </p>
              </>
            ) : (
              <>
                <Badge
                  variant={statusBadgeVariant(detail.status)}
                  className="self-start"
                >
                  {DAILY_STATUS_LABEL[detail.status]}
                </Badge>
                <p className="text-muted-foreground text-sm">
                  {DAILY_STATUS_DESCRIPTION[detail.status]}
                </p>
              </>
            )}

            <ServerBadges
              servers={detail.servers}
              serverCount={detail.serverCount}
            />

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

              {isRangeDetail(detail) ? (
                <>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">
                      Complete days
                    </dt>
                    <dd className="font-mono tabular-nums">
                      {detail.completeDays} of {detail.daysInRange}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">
                      Missed both
                    </dt>
                    <dd className="font-mono tabular-nums">
                      {detail.missedBothDays}
                    </dd>
                  </div>
                </>
              ) : (
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
              )}
            </dl>

            {isRangeDetail(detail) && detail.days.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Day by day</h3>
                <ul className="flex flex-col gap-1">
                  {detail.days.map((day) => (
                    <li
                      key={day.date}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {formatCivilDate(day.date)}
                      </span>
                      <Badge variant={statusBadgeVariant(day.status)}>
                        {DAILY_STATUS_LABEL[day.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground text-xs">
                  Weekdays excluded from the range are not listed — they were
                  never counted.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Messages in #daily-update</h3>
              {detail.messages.length === 0 ? (
                // Stated explicitly, rather than leaving an empty area that
                // reads as a loading failure.
                <p className="text-muted-foreground text-sm">
                  No daily update was posted in any server for this period.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {detail.messages.map((message) => (
                    <li
                      key={message.id}
                      className="bg-muted flex flex-col gap-1 rounded-md p-3"
                    >
                      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                        <time>{formatDhaka(message.postedAt)}</time>
                        {/* Which server it was posted in: one timeline, but a
                            message belongs to exactly one place. */}
                        {message.serverLabel ? (
                          <Badge variant="outline" className="font-normal">
                            {message.serverLabel}
                          </Badge>
                        ) : null}
                      </div>
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
