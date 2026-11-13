"use client";

import { CircleCheck, CircleSlash, Clock, Save, X } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveRegistrationSettings } from "@/actions/registration";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type {
  RegistrationSettings,
  UpdateRegistrationSettingsInput,
} from "@/lib/api/types";
import { formatDhaka } from "@/lib/dhaka-date";
import {
  validateInviteUrl,
  validateRegistrationWindow,
} from "@/lib/validation/registration";

/** The editable part of the settings, as form state. Dates, times and the link
 *  are strings here (`""` for "not set") because that is what the inputs hold;
 *  they become `null` on the way out. */
type FormState = {
  enabled: boolean;
  openDate: string;
  openTime: string;
  closeDate: string;
  closeTime: string;
  autoAddToRoster: boolean;
  welcomeEmailEnabled: boolean;
  discordInviteUrl: string;
};

const toForm = (settings: RegistrationSettings): FormState => ({
  enabled: settings.enabled,
  openDate: settings.openDate ?? "",
  openTime: settings.openTime ?? "",
  closeDate: settings.closeDate ?? "",
  closeTime: settings.closeTime ?? "",
  autoAddToRoster: settings.autoAddToRoster,
  welcomeEmailEnabled: settings.welcomeEmailEnabled,
  discordInviteUrl: settings.discordInviteUrl ?? "",
});

const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

/** Only the keys that differ from what is stored. Sending the whole form would
 *  work, but a patch that names only what changed is what the audit field
 *  (`updatedBy`) should be read against. */
function diff(
  form: FormState,
  stored: RegistrationSettings,
): UpdateRegistrationSettingsInput {
  const patch: UpdateRegistrationSettingsInput = {};

  if (form.enabled !== stored.enabled) patch.enabled = form.enabled;
  if (orNull(form.openDate) !== stored.openDate) {
    patch.openDate = orNull(form.openDate);
  }
  if (orNull(form.openTime) !== stored.openTime) {
    patch.openTime = orNull(form.openTime);
  }
  if (orNull(form.closeDate) !== stored.closeDate) {
    patch.closeDate = orNull(form.closeDate);
  }
  if (orNull(form.closeTime) !== stored.closeTime) {
    patch.closeTime = orNull(form.closeTime);
  }
  if (form.autoAddToRoster !== stored.autoAddToRoster) {
    patch.autoAddToRoster = form.autoAddToRoster;
  }
  if (form.welcomeEmailEnabled !== stored.welcomeEmailEnabled) {
    patch.welcomeEmailEnabled = form.welcomeEmailEnabled;
  }
  if (orNull(form.discordInviteUrl) !== stored.discordInviteUrl) {
    patch.discordInviteUrl = orNull(form.discordInviteUrl);
  }

  return patch;
}

export function RegistrationSettingsCard({
  initialSettings,
}: {
  initialSettings: RegistrationSettings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [form, setForm] = useState<FormState>(() => toForm(initialSettings));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const enabledId = useId();
  const openDateId = useId();
  const openTimeId = useId();
  const closeDateId = useId();
  const closeTimeId = useId();
  const autoAddId = useId();
  const emailId = useId();
  const inviteId = useId();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const patch = diff(form, settings);
  const dirty = Object.keys(patch).length > 0;

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dirty || pending) return;

    const problem =
      validateRegistrationWindow({
        openDate: orNull(form.openDate),
        openTime: orNull(form.openTime),
        closeDate: orNull(form.closeDate),
        closeTime: orNull(form.closeTime),
      }) ?? validateInviteUrl(form.discordInviteUrl);

    if (problem) {
      setError(problem);
      return;
    }

    startTransition(async () => {
      const result = await saveRegistrationSettings(patch);

      if (result.ok) {
        setSettings(result.data);
        setForm(toForm(result.data));
        toast.success(result.message);
      } else {
        setError(result.message);
      }
    });
  };

  const { window: registrationWindow, mail, queue, counts } = settings;

  return (
    <Card
      className={registrationWindow.isOpen ? "border-success/40" : undefined}
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Registration form</CardTitle>
          <StateBadge settings={settings} />
        </div>
        <CardDescription>
          {describeState(settings)} Everything below takes effect when you
          save.
        </CardDescription>

        <CardAction className="flex items-center gap-3">
          <label htmlFor={enabledId} className="text-sm font-medium">
            {form.enabled ? "Form switched on" : "Form switched off"}
          </label>
          <Switch
            id={enabledId}
            checked={form.enabled}
            disabled={pending}
            onCheckedChange={(checked) => set("enabled", checked)}
          />
        </CardAction>
      </CardHeader>

      <CardContent>
        <form onSubmit={save} noValidate>
          <FieldGroup>
            {error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {settings.welcomeEmailEnabled && !mail.configured ? (
              <Alert variant="warning">
                <AlertTitle>Welcome emails cannot be sent</AlertTitle>
                <AlertDescription>
                  {mail.reason ?? "Mailtrap is not configured on the backend."}{" "}
                  Registrations are still recorded; each welcome email is
                  marked failed until this is fixed.
                </AlertDescription>
              </Alert>
            ) : null}

            {mail.configured && mail.sandbox ? (
              <Alert variant="warning">
                <AlertTitle>Mailtrap sandbox mode is on</AlertTitle>
                <AlertDescription>
                  Welcome emails are delivered to a Mailtrap test inbox, not to
                  registrants. They will show as sent here.
                </AlertDescription>
              </Alert>
            ) : null}

            {settings.welcomeEmailEnabled && !queue.redisAvailable ? (
              <Alert variant="warning">
                <AlertTitle>The email queue is unavailable</AlertTitle>
                <AlertDescription>
                  Redis is not reachable. Registrations are still accepted, and
                  their welcome emails stay pending until it returns.
                </AlertDescription>
              </Alert>
            ) : null}

            <FieldSet>
              <FieldLegend variant="label">Registration window</FieldLegend>
              <FieldDescription>
                Asia/Dhaka. Leave the opening empty to open as soon as the form
                is switched on; leave the closing empty to stay open until you
                switch it off.
              </FieldDescription>

              <div className="grid gap-4 sm:grid-cols-2">
                <WindowEdge
                  legend="Opens"
                  dateId={openDateId}
                  timeId={openTimeId}
                  date={form.openDate}
                  time={form.openTime}
                  disabled={pending}
                  onDate={(value) => set("openDate", value)}
                  onTime={(value) => set("openTime", value)}
                  onClear={() => {
                    setForm((current) => ({
                      ...current,
                      openDate: "",
                      openTime: "",
                    }));
                    setError(null);
                  }}
                />
                <WindowEdge
                  legend="Closes"
                  dateId={closeDateId}
                  timeId={closeTimeId}
                  date={form.closeDate}
                  time={form.closeTime}
                  disabled={pending}
                  onDate={(value) => set("closeDate", value)}
                  onTime={(value) => set("closeTime", value)}
                  onClear={() => {
                    setForm((current) => ({
                      ...current,
                      closeDate: "",
                      closeTime: "",
                    }));
                    setError(null);
                  }}
                />
              </div>
            </FieldSet>

            <Field orientation="horizontal">
              <Switch
                id={autoAddId}
                checked={form.autoAddToRoster}
                disabled={pending}
                onCheckedChange={(checked) => set("autoAddToRoster", checked)}
              />
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor={autoAddId}>
                  Add registrations to the enrolment roster automatically
                </FieldLabel>
                <FieldDescription>
                  Each registration becomes a roster entry straight away, so the
                  person passes the attendance email check. An email already on
                  the roster is never changed, and a removed entry is never
                  reinstated. When this is off, registrations wait below until
                  you add them.
                </FieldDescription>
              </div>
            </Field>

            <Field orientation="horizontal">
              <Switch
                id={emailId}
                checked={form.welcomeEmailEnabled}
                disabled={pending}
                onCheckedChange={(checked) =>
                  set("welcomeEmailEnabled", checked)
                }
              />
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor={emailId}>
                  Send a welcome email after registration
                </FieldLabel>
                <FieldDescription>
                  Sent once per registered address, a few moments after the
                  form is submitted.
                </FieldDescription>
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor={inviteId}>Discord invite link</FieldLabel>
              <Input
                id={inviteId}
                type="url"
                inputMode="url"
                placeholder="https://discord.gg/your-invite"
                value={form.discordInviteUrl}
                disabled={pending}
                onChange={(event) =>
                  set("discordInviteUrl", event.target.value)
                }
              />
              <FieldDescription>
                Included in the welcome email as the &ldquo;Join the Discord
                server&rdquo; button. Use an invite that does not expire. Leave
                empty to send the email without a link.
              </FieldDescription>
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <p className="text-muted-foreground text-sm">
                <span className="text-foreground font-medium">
                  {counts.total.toLocaleString()}
                </span>{" "}
                registration{counts.total === 1 ? "" : "s"} &middot;{" "}
                {counts.enrolled.toLocaleString()} on the roster &middot;{" "}
                {counts.pending.toLocaleString()} waiting &middot;{" "}
                {counts.emailSent.toLocaleString()} email
                {counts.emailSent === 1 ? "" : "s"} sent
                {counts.emailFailed > 0 ? (
                  <span className="text-destructive">
                    {" "}
                    &middot; {counts.emailFailed.toLocaleString()} failed
                  </span>
                ) : null}
                {settings.updatedAt && settings.updatedBy ? (
                  <>
                    {" "}
                    &middot; last changed {formatDhaka(settings.updatedAt)} by{" "}
                    {settings.updatedBy.name}
                  </>
                ) : null}
              </p>

              <div className="flex items-center gap-2">
                {dirty ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      setForm(toForm(settings));
                      setError(null);
                    }}
                  >
                    Discard changes
                  </Button>
                ) : null}
                <Button type="submit" size="sm" disabled={!dirty || pending}>
                  {pending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Save data-icon="inline-start" aria-hidden />
                  )}
                  {pending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

/** One end of the window: a date, its time, and a way to clear both at once —
 *  the backend refuses a date without its time, so clearing is one action. */
function WindowEdge({
  legend,
  dateId,
  timeId,
  date,
  time,
  disabled,
  onDate,
  onTime,
  onClear,
}: {
  legend: string;
  dateId: string;
  timeId: string;
  date: string;
  time: string;
  disabled: boolean;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{legend}</span>
        {date || time ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled}
            onClick={onClear}
          >
            <X data-icon="inline-start" aria-hidden />
            Clear
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field>
          <FieldLabel htmlFor={dateId} className="text-xs font-normal">
            Date
          </FieldLabel>
          <Input
            id={dateId}
            type="date"
            value={date}
            disabled={disabled}
            onChange={(event) => onDate(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={timeId} className="text-xs font-normal">
            Time
          </FieldLabel>
          <Input
            id={timeId}
            type="time"
            value={time}
            disabled={disabled}
            onChange={(event) => onTime(event.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

/** The STORED state, as the backend computed it — not the unsaved form. A
 *  badge that followed the switch before saving would say "Open" for a form
 *  nobody can reach yet. */
function StateBadge({ settings }: { settings: RegistrationSettings }) {
  switch (settings.window.state) {
    case "open":
      return (
        <Badge variant="success">
          <CircleCheck data-icon="inline-start" aria-hidden />
          Open now
        </Badge>
      );
    case "not-yet-open":
      return (
        <Badge variant="warning">
          <Clock data-icon="inline-start" aria-hidden />
          Not open yet
        </Badge>
      );
    case "closed":
      return (
        <Badge variant="secondary">
          <CircleSlash data-icon="inline-start" aria-hidden />
          Closed
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <CircleSlash data-icon="inline-start" aria-hidden />
          Switched off
        </Badge>
      );
  }
}

function describeState(settings: RegistrationSettings): string {
  const { state, opensAt, closesAt } = settings.window;

  switch (state) {
    case "open":
      return closesAt
        ? `The public form is accepting registrations until ${formatDhaka(closesAt)}.`
        : "The public form is accepting registrations until you switch it off.";
    case "not-yet-open":
      return `The public form opens ${formatDhaka(opensAt)}.`;
    case "closed":
      return `The registration window closed ${formatDhaka(closesAt)}.`;
    default:
      return "The public form is switched off and accepts nothing.";
  }
}
