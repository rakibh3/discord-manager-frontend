"use client";

import { Save } from "lucide-react";
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
import type { ChannelSchedulePayload } from "@/lib/api/types";
import { validateSchedulePatch, WEEKDAYS } from "@/lib/validation/schedule";

/**
 * The schedule editor: two time inputs and seven weekday checkboxes.
 *
 * **There is deliberately no cron field.** The cron expression is derived at
 * registration and never stored, so exposing one would be a second source of
 * truth that the backend would ignore. `timezone` is never sent either — the
 * zone is fixed at Asia/Dhaka and is reported back to us, not set by us.
 */
export function ScheduleEditor({
  payload,
  onUpdated,
}: {
  payload: ChannelSchedulePayload;
  onUpdated: (next: ChannelSchedulePayload) => void;
}) {
  const stored = payload.schedule;

  const [openTime, setOpenTime] = useState(stored.openTime);
  const [closeTime, setCloseTime] = useState(stored.closeTime);
  const [days, setDays] = useState<number[]>(stored.daysOfWeek);
  const [enabled, setEnabled] = useState(stored.enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openId = useId();
  const closeId = useId();

  // A save — or another admin's change arriving via revalidation — resets the
  // form's baseline, so "nothing has changed" stays accurate. Adjusted during
  // render rather than in an effect, which would briefly show the old values
  // in the inputs after a successful save.
  const [seenStored, setSeenStored] = useState(stored);
  if (seenStored !== stored) {
    setSeenStored(stored);
    setOpenTime(stored.openTime);
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
    // `closeTime > openTime` judged against the *merged* row — so the admin
    // finds out here rather than after a round trip.
    const validation = validateSchedulePatch(stored, {
      openTime,
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
          <Field>
            <FieldLabel htmlFor={openId}>Opens at</FieldLabel>
            <Input
              id={openId}
              type="time"
              value={openTime}
              required
              onChange={(event) => {
                setOpenTime(event.target.value);
                setError(null);
              }}
            />
            <FieldDescription>Asia/Dhaka, 24-hour.</FieldDescription>
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
            <FieldDescription>Must be later than the open time.</FieldDescription>
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
