"use client";

import { Lock, Save } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateSchedule } from "@/actions/schedule";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { formatWallClock } from "@/lib/dhaka-date";
import type { ChannelSchedulePayload } from "@/lib/api/types";
import { validateSchedulePatch, WEEKDAYS } from "@/lib/validation/schedule";

/** One time input and seven weekday checkboxes. No cron field (derived at
 *  registration, never stored) and no `timezone` — the zone is fixed at Asia/Dhaka.
 *
 *  The open time is **shown but not editable**: it mirrors the announcement time,
 *  because the channel opens when the announcement is posted. It is rendered
 *  `readOnly` rather than `disabled` so it stays focusable and is still read out
 *  — an admin needs to be able to reach the explanation of why it is locked. */
export function ScheduleEditor({
  payload,
  onUpdated,
}: {
  payload: ChannelSchedulePayload;
  onUpdated: (next: ChannelSchedulePayload) => void;
}) {
  const stored = payload.schedule;

  const [closeTime, setCloseTime] = useState(stored.closeTime);
  const [days, setDays] = useState<number[]>(stored.daysOfWeek);
  const [enabled, setEnabled] = useState(stored.enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openId = useId();
  const closeId = useId();

  // A save or another admin's change resets the form's baseline. Adjusted during
  // render, not in an effect, which would show the old values for one frame.
  const [seenStored, setSeenStored] = useState(stored);
  if (seenStored !== stored) {
    setSeenStored(stored);
    setCloseTime(stored.closeTime);
    setDays(stored.daysOfWeek);
    setEnabled(stored.enabled);
    setError(null);
  }

  const toggleDay = (day: number, checked: boolean) => {
    setDays((current) =>
      checked
        ? [...current, day].sort((a, b) => a - b)
        : current.filter((value) => value !== day),
    );
    setError(null);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Mirrors the backend's three rejections — empty patch, no weekday, and
    // `closeTime > openTime` judged against the stored (announcement-owned)
    // open time.
    const validation = validateSchedulePatch(stored, {
      closeTime,
      daysOfWeek: days,
      enabled,
    });

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updateSchedule(validation.patch);
      if (result.ok) {
        onUpdated(result.data);
        toast.success("Schedule saved. The scheduler reloaded in-process.");
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Not an input. `readOnly` is unreliable on `type="time"` — several
              browsers still let the picker change it — and a value that can be
              edited but is never sent would report a save that did not happen.
              A `disabled` input would be honest but drops out of the tab order,
              putting the explanation below out of reach. So it is text. */}
          <Field role="group" aria-labelledby={openId}>
            <span
              id={openId}
              className="flex items-center gap-1.5 text-sm leading-none font-medium"
            >
              Opens at
              {/* The state is carried as icon and words, not by the muted fill
                  alone — which on its own reads as "not filled in yet". */}
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-normal">
                <Lock aria-hidden className="size-3" />
                Set by the announcement
              </span>
            </span>
            <p className="border-input bg-muted/50 text-muted-foreground flex h-8 items-center rounded-lg border px-2.5 py-1 text-base tabular-nums md:text-sm">
              {formatWallClock(stored.openTime)}
            </p>
            <FieldDescription>
              The channel opens the moment the announcement is posted, so this
              mirrors the announce time and cannot be changed here.{" "}
              <Link
                href="/dashboard/announcement"
                className="underline underline-offset-4"
              >
                Change it on the announcement screen
              </Link>
              .
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor={closeId}>Locks at</FieldLabel>
            <Input
              id={closeId}
              type="time"
              value={closeTime}
              required
              onChange={(event) => {
                setCloseTime(event.target.value);
                setError(null);
              }}
            />
            <FieldDescription>
              Asia/Dhaka, 24-hour. Must be later than{" "}
              {formatWallClock(stored.openTime)} - to lock earlier than that, move
              the announcement first.
            </FieldDescription>
          </Field>
        </div>

        <FieldSet>
          <FieldLegend variant="label">Active days</FieldLegend>
          <FieldDescription>
            The channel opens and locks only on the days selected here.
          </FieldDescription>
          <FieldGroup className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {WEEKDAYS.map((weekday) => {
              const checkboxId = `weekday-${weekday.value}`;
              return (
                <Field key={weekday.value} orientation="horizontal">
                  <Checkbox
                    id={checkboxId}
                    checked={days.includes(weekday.value)}
                    onCheckedChange={(checked) =>
                      toggleDay(weekday.value, checked === true)
                    }
                  />
                  <FieldLabel htmlFor={checkboxId} className="font-normal">
                    {weekday.label}
                  </FieldLabel>
                </Field>
              );
            })}
          </FieldGroup>
        </FieldSet>

        <Field orientation="horizontal">
          <Switch
            id="schedule-enabled"
            checked={enabled}
            onCheckedChange={(checked) => {
              setEnabled(checked);
              setError(null);
            }}
          />
          <FieldLabel htmlFor="schedule-enabled" className="font-normal">
            Schedule enabled
          </FieldLabel>
        </Field>
        <FieldDescription>
          Turning this off unregisters the timed jobs. Manual open and lock keep
          working.
        </FieldDescription>

        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            {pending ? "Saving…" : "Save schedule"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
