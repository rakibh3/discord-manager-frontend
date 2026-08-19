"use client";

import { Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveRosterSettings } from "@/actions/roster";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import type { RosterSettings } from "@/lib/api/types";
import { formatDhaka } from "@/lib/dhaka-date";

export function RosterGateCard({
  initialSettings,
}: {
  initialSettings: RosterSettings;
}) {
  const [settings, setSettings] = useState<RosterSettings>(initialSettings);
  const [pending, startTransition] = useTransition();
  const [confirmArmOpen, setConfirmArmOpen] = useState(false);

  const canArm = settings.activeEntries > 0;

  const handleToggle = (checked: boolean) => {
    if (checked) {
      if (!canArm) {
        toast.error("Cannot arm gate on an empty roster", {
          description:
            "Enabling email enforcement with 0 active entries would reject every student. Import a spreadsheet first.",
        });
        return;
      }
      setConfirmArmOpen(true);
    } else {
      // Disarming is immediate rollback
      executeToggle(false);
    }
  };

  const executeToggle = (enforceEmail: boolean) => {
    startTransition(async () => {
      const result = await saveRosterSettings(enforceEmail);
      if (result.ok) {
        setSettings(result.data);
        toast.success(result.message);
      } else {
        toast.error("Failed to update roster settings", {
          description: result.message,
        });
      }
    });
  };

  return (
    <>
      {/* Armed is a healthy state, not a brand one — `success` is the token the
       *  alerts and badges already use for it. */}
      <Card className={settings.enforceEmail ? "border-success/40" : undefined}>
        {/* `CardAction` is the slot the card grid already reserves for a
         *  right-aligned control — no flex override needed. */}
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Email verification gate</CardTitle>
            {settings.enforceEmail ? (
              <Badge variant="success">
                <ShieldCheck data-icon="inline-start" aria-hidden />
                Armed and enforcing
              </Badge>
            ) : (
              <Badge variant="secondary">
                <ShieldAlert data-icon="inline-start" aria-hidden />
                Disarmed (open)
              </Badge>
            )}
          </div>

          <CardDescription>
            {settings.enforceEmail
              ? `The attendance form verifies that a submitted email exists among the ${settings.activeEntries.toLocaleString()} enrolled student records.`
              : "The attendance form accepts submissions from every member of the configured Discord servers, without email verification."}
          </CardDescription>

          <CardAction className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-sm font-medium">
                {settings.enforceEmail ? "Enforcement on" : "Enforcement off"}
              </span>
              <span className="text-muted-foreground text-xs">
                {settings.activeEntries.toLocaleString()} eligible
              </span>
            </div>

            <Switch
              checked={settings.enforceEmail}
              disabled={pending || (!settings.enforceEmail && !canArm)}
              onCheckedChange={handleToggle}
              aria-label="Toggle email verification enforcement"
            />
          </CardAction>
        </CardHeader>

        <CardContent>
          <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
            <p>
              <span className="text-foreground font-medium">
                {settings.activeEntries.toLocaleString()}
              </span>{" "}
              active student{settings.activeEntries === 1 ? "" : "s"} enrolled
              {!canArm && !settings.enforceEmail ? (
                <span className="text-warning">
                  {" "}
                  &mdash; import a roster spreadsheet to arm the gate
                </span>
              ) : null}
            </p>

            {settings.updatedAt ? (
              <p>
                Last updated {formatDhaka(settings.updatedAt)}
                {settings.updatedBy?.name
                  ? ` by ${settings.updatedBy.name}`
                  : ""}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmArmOpen} onOpenChange={setConfirmArmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="size-4" aria-hidden />
              Arm the email verification gate?
            </AlertDialogTitle>
            {/* One paragraph: the description renders a <p>, so nesting block
             *  elements inside it is invalid HTML and warns on hydration. */}
            <AlertDialogDescription>
              Once armed, a student submitting the attendance form must provide
              an email that matches one of the{" "}
              {settings.activeEntries.toLocaleString()} active records on the
              enrolment roster.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <p className="text-muted-foreground text-sm">
            Unlisted emails are rejected outright. You can roll this back at any
            time by switching enforcement off.
          </p>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                setConfirmArmOpen(false);
                executeToggle(true);
              }}
            >
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <ShieldCheck data-icon="inline-start" aria-hidden />
              )}
              Arm gate ({settings.activeEntries.toLocaleString()} students)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
