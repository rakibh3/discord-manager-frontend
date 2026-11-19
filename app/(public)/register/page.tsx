import {
  CalendarClock,
  Check,
  Mail,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import type { Metadata } from "next";

import { RegistrationClosed } from "./registration-closed";
import { RegistrationForm } from "./registration-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDhaka } from "@/lib/dhaka-date";
import { readRegistrationWindow } from "@/lib/registration-window";

export const metadata: Metadata = {
  title: "Student Registration",
  description:
    "Register once for the program to join the enrolment roster and receive your Discord invite link.",
};

/** Rendered per request: whether the form is open turns over on a wall clock
 *  and on an admin's switch, so it may not be prerendered. */
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  // `null` means the window could not be determined, which falls through to
  // the form — `POST /registration/submit` is where the real check lives.
  const registrationWindow = await readRegistrationWindow();
  const closed = registrationWindow !== null && !registrationWindow.isOpen;
  const notYetOpen = registrationWindow?.state === "not-yet-open";

  const statusBadge = closed
    ? notYetOpen
      ? { variant: "warning" as const, label: "OPENS SOON" }
      : { variant: "destructive" as const, label: "CLOSED" }
    : { variant: "success" as const, label: "REGISTRATION OPEN" };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Editorial Hero Strip */}
      <div className="border-foreground bg-card flex flex-col justify-between gap-4 rounded-2xl border-2 p-5 shadow-[4px_4px_0_0_var(--border-yellow)] sm:p-6 md:flex-row md:items-end">
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
              STEP 0 · ONE-TIME ENROLMENT
            </span>
          </div>

          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Student Registration
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
            Sign up once to join the cohort roster. We&apos;ll email your
            Discord server invite and automatically link your account when you
            join.
          </p>
        </div>

        {/* Right-hand Dhaka Window Metadata Pill */}
        <div className="border-foreground bg-muted/60 flex shrink-0 flex-col gap-1 rounded-xl border-2 px-4 py-3 md:min-w-56">
          <span className="text-muted-foreground flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            Registration window
          </span>
          {notYetOpen && registrationWindow?.opensAt ? (
            <span className="font-mono text-xs font-bold sm:text-sm">
              Opens {formatDhaka(registrationWindow.opensAt)}
            </span>
          ) : registrationWindow?.closesAt ? (
            <span className="font-mono text-xs font-bold sm:text-sm">
              {closed ? "Closed " : "Closes "}
              {formatDhaka(registrationWindow.closesAt)}
            </span>
          ) : (
            <span className="font-mono text-xs font-bold sm:text-sm">
              {closed ? "Currently closed" : "Open now"}
            </span>
          )}
          <span className="text-muted-foreground font-mono text-[11px]">
            Asia/Dhaka (UTC+6)
          </span>
        </div>
      </div>

      {/* Main Split Grid: Form first in DOM so mobile lands directly on it */}
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-7">
          {closed ? (
            <RegistrationClosed registrationWindow={registrationWindow} />
          ) : (
            <RegistrationForm closesAt={registrationWindow?.closesAt ?? null} />
          )}
        </div>

        <aside
          aria-label="Registration guide"
          className="flex flex-col gap-5 lg:col-span-5"
        >
          {/* Card 1: How Enrolment Works */}
          <Card accent="lilac" size="sm">
            <CardHeader>
              <CardTitle>
                <h2 className="flex items-center gap-2 text-base">
                  <Sparkles aria-hidden="true" className="size-4 shrink-0" />
                  <span>How enrolment works</span>
                </h2>
              </CardTitle>
              <CardDescription className="text-xs">
                Three quick steps from sign-up to daily check-ins.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3.5 text-sm">
                <li className="flex items-start gap-3">
                  <span className="bg-highlight text-highlight-foreground border-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border-2 font-mono text-xs font-bold shadow-[2px_2px_0_0_var(--shadow-color)]">
                    01
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-heading text-sm font-bold">
                      Submit your details once
                    </span>
                    <span className="text-muted-foreground text-xs leading-relaxed">
                      Your email becomes your permanent enrolment identity on
                      the cohort roster.
                    </span>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <span className="bg-border-lilac text-[#2D2B32] border-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border-2 font-mono text-xs font-bold shadow-[2px_2px_0_0_var(--shadow-color)]">
                    02
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-heading text-sm font-bold">
                      Check your welcome email
                    </span>
                    <span className="text-muted-foreground text-xs leading-relaxed">
                      We send your Discord server invite link right after
                      registration (check Spam if needed).
                    </span>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <span className="bg-border-sage text-[#2D2B32] border-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border-2 font-mono text-xs font-bold shadow-[2px_2px_0_0_var(--shadow-color)]">
                    03
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-heading text-sm font-bold">
                      Join Discord to auto-link
                    </span>
                    <span className="text-muted-foreground text-xs leading-relaxed">
                      Join with the exact{" "}
                      <code className="text-foreground font-mono">
                        @username
                      </code>{" "}
                      you registered and our bot pairs your account
                      automatically.
                    </span>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* Card 2: Key Rules & Handle Reminder */}
          <Card accent="sky" size="sm">
            <CardHeader>
              <CardTitle>
                <h2 className="flex items-center gap-2 text-base">
                  <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
                  <span>Before you submit</span>
                </h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs leading-relaxed">
              <div className="border-border-muted bg-muted/50 flex flex-col gap-2 rounded-xl border-2 p-3">
                <span className="text-foreground font-heading text-xs font-bold">
                  Discord Username vs. Display Name
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground line-through">
                    Rakib Hasan ✨
                  </span>
                  <span className="text-status-error inline-flex items-center gap-1 font-mono text-[11px] font-semibold">
                    <X aria-hidden="true" className="size-3" />
                    Display name
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-foreground font-mono font-bold">
                    @rakib_dev
                  </code>
                  <span className="text-status-success inline-flex items-center gap-1 font-mono text-[11px] font-semibold">
                    <Check aria-hidden="true" className="size-3" />
                    Username
                  </span>
                </div>
              </div>

              <ul className="text-muted-foreground flex flex-col gap-2">
                <li className="flex items-start gap-2">
                  <Mail
                    aria-hidden="true"
                    className="text-foreground mt-0.5 size-3.5 shrink-0"
                  />
                  <span>
                    <strong className="text-foreground">One email per student:</strong>{" "}
                    you&apos;ll enter this same email every day for attendance.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <UserCheck
                    aria-hidden="true"
                    className="text-foreground mt-0.5 size-3.5 shrink-0"
                  />
                  <span>
                    <strong className="text-foreground">Exact handle matters:</strong>{" "}
                    entering someone else&apos;s handle or a display name will
                    delay pairing your account.
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
