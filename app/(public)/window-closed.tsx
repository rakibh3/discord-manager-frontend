import {
  ArrowRight,
  CalendarClock,
  Clock,
  Lock,
  PauseCircle,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AttendanceWindow } from "@/lib/api/types";
import { formatDhaka, formatWallClock } from "@/lib/dhaka-date";
import { formatWeekdays } from "@/lib/validation/schedule";

/** What a student sees outside the submission window — a meaningful message,
 *  not a 404, so "closed" is never misread as "broken". */
export function WindowClosed({
  attendanceWindow,
}: {
  attendanceWindow: AttendanceWindow;
}) {
  // A disabled schedule is a different situation from "outside today's hours":
  // there is no next opening to name, so promising one would be a lie.
  const paused = !attendanceWindow.enabled;

  return (
    <Card accent="coral" className="gap-5 py-5 sm:py-6">
      <CardHeader className="border-border-muted border-b px-4 pb-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="destructive" className="font-mono text-[11px]">
            {paused ? (
              <PauseCircle aria-hidden="true" />
            ) : (
              <Lock aria-hidden="true" />
            )}
            {paused ? "ATTENDANCE PAUSED" : "OUTSIDE WINDOW"}
          </Badge>
        </div>

        <CardTitle className="mt-1">
          <h2 className="text-xl">
            {paused ? "Attendance is paused" : "Attendance is closed right now"}
          </h2>
        </CardTitle>
        <CardDescription className="text-sm">
          {paused
            ? "An administrator has paused the daily attendance schedule."
            : "This form only accepts submissions during the scheduled evening window."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-4 text-sm sm:px-6">
        {paused ? (
          <p className="text-muted-foreground leading-relaxed">
            It will be announced in the Discord server when daily attendance
            resumes — there is nothing you need to do in the meantime.
          </p>
        ) : (
          <>
            <dl className="border-foreground bg-muted/50 grid gap-3 rounded-xl border-2 p-4 sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground flex items-center gap-1.5 font-mono text-[11px] uppercase">
                  <Clock aria-hidden="true" className="size-3.5" />
                  Daily hours
                </dt>
                <dd className="font-mono text-sm font-bold">
                  {formatWallClock(attendanceWindow.openTime)} –{" "}
                  {formatWallClock(attendanceWindow.closeTime)}
                </dd>
              </div>

              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground font-mono text-[11px] uppercase">
                  Active days
                </dt>
                <dd className="font-medium">
                  {formatWeekdays(attendanceWindow.daysOfWeek)} · Asia/Dhaka
                </dd>
              </div>
            </dl>

            {attendanceWindow.nextOpenAt ? (
              <div className="border-foreground bg-highlight/20 flex items-center gap-3 rounded-xl border-2 p-3.5">
                <CalendarClock
                  aria-hidden="true"
                  className="size-5 shrink-0"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground font-mono text-[11px] font-semibold uppercase">
                    Opens next (Asia/Dhaka)
                  </span>
                  <strong className="font-mono text-sm">
                    {formatDhaka(attendanceWindow.nextOpenAt)}
                  </strong>
                </div>
              </div>
            ) : null}
          </>
        )}

        <p className="text-muted-foreground leading-relaxed">
          Both web attendance and your{" "}
          <code className="text-foreground font-mono font-semibold">
            #daily-update
          </code>{" "}
          post must be submitted within the same window. If anything is unclear,
          ask in the Discord server.
        </p>

        <div className="border-border-muted flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <span className="text-muted-foreground text-xs">
            Haven&apos;t registered for the cohort yet?
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link href="/register">
              Go to Registration
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
