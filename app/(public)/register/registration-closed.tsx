import { CalendarClock, Clock } from "lucide-react";

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
    ? "Registration has not opened yet"
    : "Registration is closed";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock aria-hidden className="size-6" />
          {title}
        </CardTitle>
        <CardDescription className="text-base">
          {notYetOpen
            ? "The form will be available here once registration opens."
            : "This form is not accepting new registrations right now."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 text-base">
        {notYetOpen && opensAt ? (
          <div className="bg-muted/60 flex flex-col gap-1 rounded-md p-3">
            <p className="flex items-center gap-2 font-medium">
              <CalendarClock aria-hidden className="size-5" />
              Opens {formatDhaka(opensAt)}
            </p>
            {closesAt ? (
              <p className="text-muted-foreground text-sm">
                Closes {formatDhaka(closesAt)}
              </p>
            ) : null}
          </div>
        ) : null}

        {state === "closed" && closesAt ? (
          <p className="text-muted-foreground">
            Registration closed on <strong>{formatDhaka(closesAt)}</strong>.
          </p>
        ) : null}

        <p className="text-muted-foreground border-t pt-3 text-sm">
          {notYetOpen
            ? "Come back to this page when it opens — there is nothing you need to do before then."
            : "If you believe you should still be able to register, contact the program organisers."}
        </p>
      </CardContent>
    </Card>
  );
}
