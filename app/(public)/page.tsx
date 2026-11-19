import {
  ArrowRight,
  CalendarClock,
  CheckSquare,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

import { DailyUpdateTemplateCard } from "./_components/daily-update-template-card";
import { AttendanceForm } from "./attendance-form";
import { WindowClosed } from "./window-closed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAttendanceWindow } from "@/lib/attendance-window";
import {
  dhakaToday,
  formatCivilDate,
  formatWallClock,
} from "@/lib/dhaka-date";
import { formatWeekdays } from "@/lib/validation/schedule";

/** Rendered per request: the header shows today's Dhaka date, and the submission
 *  window turns over on a wall clock, so neither may be prerendered. */
export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  // The Dhaka civil day, which is the day the backend files the row under —
  // not the browser's local date.
  const today = dhakaToday();

  // `null` means the window could not be determined, which falls through to the
  // form — `POST /attendance/submit` is where the real checks live.
  const attendanceWindow = await getAttendanceWindow();
  const closed = attendanceWindow !== null && !attendanceWindow.isOpen;
  const paused = attendanceWindow !== null && !attendanceWindow.enabled;

  const statusBadge = closed
    ? {
        variant: "destructive" as const,
        label: paused ? "PAUSED" : "WINDOW CLOSED",
      }
    : { variant: "success" as const, label: "WINDOW OPEN" };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Editorial Hero Strip */}
      <div className="border-foreground bg-card flex flex-col justify-between gap-4 rounded-2xl border-2 p-5 shadow-[4px_4px_0_0_var(--border-lilac)] sm:p-6 md:flex-row md:items-end">
        <div className="flex max-w-xl flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusBadge.variant} className="font-mono text-[11px]">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-current"
              />
              {statusBadge.label}
            </Badge>
            <span className="text-muted-foreground font-mono text-xs">
              {formatCivilDate(today)} · ASIA/DHAKA
            </span>
          </div>

          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Daily Attendance
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
            Check in once per day during the open window, then share your
            learning summary in{" "}
            <code className="text-foreground font-mono font-semibold">
              #daily-update
            </code>
            .
          </p>
        </div>

        {/* Right-hand Today's Window Metadata Pill */}
        <div className="border-foreground bg-muted/60 flex shrink-0 flex-col gap-1 rounded-xl border-2 px-4 py-3 md:min-w-56">
          <span className="text-muted-foreground flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            Today&apos;s window
          </span>
          {attendanceWindow ? (
            <>
              <span className="font-mono text-xs font-bold sm:text-sm">
                {formatWallClock(attendanceWindow.openTime)} –{" "}
                {formatWallClock(attendanceWindow.closeTime)}
              </span>
              <span className="text-muted-foreground font-mono text-[11px]">
                {formatWeekdays(attendanceWindow.daysOfWeek)} · Dhaka
              </span>
            </>
          ) : (
            <>
              <span className="font-mono text-xs font-bold sm:text-sm">
                {formatCivilDate(today)}
              </span>
              <span className="text-muted-foreground font-mono text-[11px]">
                Asia/Dhaka (UTC+6)
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main Split Grid: Form first in DOM so mobile lands straight on check-in */}
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-7">
          {closed ? (
            <WindowClosed attendanceWindow={attendanceWindow} />
          ) : (
            <AttendanceForm
              emailVerificationRequired={
                attendanceWindow?.emailVerificationRequired ?? false
              }
              closeTime={attendanceWindow?.closeTime ?? null}
            />
          )}
        </div>

        <aside
          aria-label="Daily routine guide"
          className="flex flex-col gap-5 lg:col-span-5"
        >
          {/* Card 1: Two-part Daily Routine */}
          <Card accent="yellow" size="sm">
            <CardHeader>
              <CardTitle>
                <h2 className="flex items-center gap-2 text-base">
                  <CheckSquare aria-hidden="true" className="size-4 shrink-0" />
                  <span>Two parts complete your day</span>
                </h2>
              </CardTitle>
              <CardDescription className="text-xs">
                Web attendance and Discord updates are tracked separately.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3.5 text-sm">
                <li className="flex items-start gap-3">
                  <span className="bg-border-lilac text-[#2D2B32] border-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border-2 font-mono text-xs font-bold shadow-[2px_2px_0_0_var(--shadow-color)]">
                    01
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-heading text-sm font-bold">
                      Submit web attendance
                    </span>
                    <span className="text-muted-foreground text-xs leading-relaxed">
                      Verify your enrolled email and Discord username here once
                      per day.
                    </span>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <span className="bg-border-sage text-[#2D2B32] border-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border-2 font-mono text-xs font-bold shadow-[2px_2px_0_0_var(--shadow-color)]">
                    02
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-heading text-sm font-bold">
                      Post in #daily-update
                    </span>
                    <span className="text-muted-foreground text-xs leading-relaxed">
                      Share your learning update in Discord before{" "}
                      {attendanceWindow
                        ? formatWallClock(attendanceWindow.closeTime)
                        : "the channel locks"}
                      .
                    </span>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* Card 2: Copyable #daily-update format (when open) or Register callout (when closed) */}
          {closed ? (
            <Card accent="sky" size="sm">
              <CardHeader>
                <CardTitle>
                  <h2 className="flex items-center gap-2 text-base">
                    <UserPlus aria-hidden="true" className="size-4 shrink-0" />
                    <span>New to the program?</span>
                  </h2>
                </CardTitle>
                <CardDescription className="text-xs">
                  Register once to join the roster and get your Discord invite.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/register">
                    Open Registration Form
                    <ArrowRight data-icon="inline-end" aria-hidden="true" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <DailyUpdateTemplateCard today={today} />
          )}
        </aside>
      </div>
    </div>
  );
}
