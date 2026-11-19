import { ArrowRight, CalendarClock, Clock, Lock } from "lucide-react";
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
import type { RegistrationWindow } from "@/lib/api/types";
import { formatDhaka } from "@/lib/dhaka-date";

/** What a visitor sees while registration is not accepting submissions — a
 *  meaningful message, not a 404, so "closed" is never misread as "broken". */
export function RegistrationClosed({
  registrationWindow,
}: {
  registrationWindow: RegistrationWindow;
}) {
  const { state, opensAt, closesAt } = registrationWindow;

  // Three different situations, and each promises something different: a
  // future opening can be named, a past closing can be named, and a form that
  // is simply switched off has no date to offer — inventing one would be a lie.
  const notYetOpen = state === "not-yet-open";
  const title = notYetOpen
    ? "Registration opens soon"
    : "Registration is closed";

  return (
    <Card accent={notYetOpen ? "yellow" : "coral"} className="gap-5 py-5 sm:py-6">
      <CardHeader className="border-border-muted border-b px-4 pb-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={notYetOpen ? "warning" : "destructive"}
            className="font-mono text-[11px]"
          >
            {notYetOpen ? (
              <Clock aria-hidden="true" />
            ) : (
              <Lock aria-hidden="true" />
            )}
            {notYetOpen ? "NOT OPEN YET" : "CLOSED"}
          </Badge>
        </div>

        <CardTitle className="mt-1">
          <h2 className="text-xl">{title}</h2>
        </CardTitle>
        <CardDescription className="text-sm">
          {notYetOpen
            ? "The enrolment form will unlock automatically at the scheduled time."
            : "This form is not accepting new registrations right now."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-4 text-sm sm:px-6">
        {notYetOpen && opensAt ? (
          <div className="border-foreground bg-highlight/20 flex flex-col gap-1.5 rounded-xl border-2 p-4">
            <p className="text-muted-foreground font-mono text-[11px] font-semibold uppercase">
              Scheduled window · Asia/Dhaka
            </p>
            <p className="font-heading flex items-center gap-2 text-base font-bold">
              <CalendarClock aria-hidden="true" className="size-5 shrink-0" />
              <span>Opens {formatDhaka(opensAt)}</span>
            </p>
            {closesAt ? (
              <p className="text-muted-foreground font-mono text-xs">
                Closes {formatDhaka(closesAt)}
              </p>
            ) : null}
          </div>
        ) : null}

        {state === "closed" && closesAt ? (
          <div className="border-foreground bg-muted/50 flex flex-col gap-1 rounded-xl border-2 p-4">
            <p className="text-muted-foreground font-mono text-[11px] font-semibold uppercase">
              Window ended · Asia/Dhaka
            </p>
            <p className="font-medium">
              Registration closed on{" "}
              <strong className="font-mono">{formatDhaka(closesAt)}</strong>.
            </p>
          </div>
        ) : null}

        <p className="text-muted-foreground leading-relaxed">
          {notYetOpen
            ? "Bookmark this page and come back once the window opens — there is nothing you need to do before then."
            : "If you believe you should still be able to register, please contact the program organisers."}
        </p>

        <div className="border-border-muted flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <span className="text-muted-foreground text-xs">
            Already enrolled in the cohort?
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">
              Go to Daily Attendance
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
