"use client";

import { AtSign, Eye, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateAnnouncement } from "@/actions/announcement";
import { formatWallClock } from "@/lib/dhaka-date";
import { DiscordMessage } from "@/components/dashboard/discord-message";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import type {
  AnnouncementPayload,
  AnnouncementPreview,
  AttendanceWindow,
} from "@/lib/api/types";
import {
  describeUnresolved,
  formValuesFrom,
  validateAnnouncement,
  type AnnouncementFormValues,
} from "@/lib/validation/announcement";
import { WEEKDAYS } from "@/lib/validation/schedule";

/** The announcement editor. No close-time or cron field — both are derived
 *  elsewhere. The counter is driven by the rendered preview, not `body.length`.
 *
 *  The post time is doubly consequential: it is also when `#daily-update` opens,
 *  in the same transaction, so the field says so rather than letting an admin
 *  discover it from a moved window the next evening. */
export function AnnouncementEditor({
  payload,
  channelWindow,
  onUpdated,
}: {
  payload: AnnouncementPayload;
  /** The `#daily-update` window, or `null` when it could not be read. */
  channelWindow: AttendanceWindow | null;
  onUpdated: (next: AnnouncementPayload) => void;
}) {
  const [values, setValues] = useState<AnnouncementFormValues>(() =>
    formValuesFrom(payload),
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmEveryone, setConfirmEveryone] = useState(false);
  const [pending, startTransition] = useTransition();

  const bodyId = useId();
  const daysId = useId();
  const timeId = useId();
  const timeHintId = useId();
  const rolesId = useId();
  const usersId = useId();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // A save or another admin's change resets the form's baseline. Adjusted during
  // render, not in an effect, which would briefly show superseded values.
  const [seenPayload, setSeenPayload] = useState(payload);
  if (seenPayload !== payload) {
    setSeenPayload(payload);
    setValues(formValuesFrom(payload));
    setError(null);
  }

  const preview = useLivePreview(payload, values);

  const patch = (partial: Partial<AnnouncementFormValues>) => {
    setValues((current) => ({ ...current, ...partial }));
    setError(null);
  };

  /** Inserts a placeholder at the caret, which is what makes them hard to mistype. */
  const insertPlaceholder = (token: string) => {
    const textarea = bodyRef.current;
    if (!textarea) {
      patch({ body: values.body + token });
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = values.body.slice(0, start) + token + values.body.slice(end);
    patch({ body: next });

    // Restore the caret after React has written the new value, so typing
    // continues where the token ended rather than jumping to the end.
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + token.length;
      textarea.setSelectionRange(caret, caret);
    });
  };

  const save = () => {
    const validation = validateAnnouncement(
      payload,
      values,
      channelWindow?.closeTime ?? null,
    );
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updateAnnouncement(validation.patch);
      if (result.ok) {
        onUpdated(result.data);
        // A moved post time silently moved the submission window too. Saying so
        // here is the only place an admin finds out before tomorrow evening.
        toast.success(
          validation.patch.announceTime
            ? `Announcement saved. #daily-update now opens at ${formatWallClock(validation.patch.announceTime)} as well, and the channel was reconciled immediately.`
            : "Announcement saved. The scheduled task was rebuilt in-process.",
        );
      } else {
        setError(result.message);
      }
      setConfirmEveryone(false);
    });
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Turning the nightly guild-wide ping ON is the one change that needs a
    // deliberate second step. Turning it off never does.
    const turningOnEveryone =
      values.mentionEveryone && !payload.template.mentionEveryone;

    if (turningOnEveryone) {
      setConfirmEveryone(true);
      return;
    }

    save();
  };

  const overLimit = preview.data ? !withinLimit(preview.data) : false;

  return (
    <>
      <form onSubmit={submit} noValidate>
        <FieldGroup>
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Field>
            <FieldLabel htmlFor={bodyId}>Message body</FieldLabel>
            <Textarea
              id={bodyId}
              ref={bodyRef}
              value={values.body}
              rows={10}
              required
              className="font-mono text-sm"
              onChange={(event) => patch({ body: event.target.value })}
              aria-describedby={`${bodyId}-hint`}
            />
            <FieldDescription id={`${bodyId}-hint`}>
              Mentions typed here don&rsquo;t ping — use Mentions below.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Placeholders</FieldLabel>
            <FieldDescription>
              Click to insert at the cursor.
            </FieldDescription>
            <div className="flex flex-wrap gap-2">
              {payload.supportedPlaceholders.map((token) => (
                <Button
                  key={token}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs"
                  onClick={() => insertPlaceholder(token)}
                >
                  {token}
                </Button>
              ))}
            </div>
          </Field>

          <PreviewPane preview={preview} />

          <Field>
            <FieldLabel htmlFor={`${bodyId}-termination`}>
              Termination days
            </FieldLabel>
            <Input
              id={`${bodyId}-termination`}
              type="number"
              min={1}
              max={365}
              value={values.terminationDays}
              required
              className="max-w-32"
              onChange={(event) =>
                patch({ terminationDays: event.target.valueAsNumber })
              }
            />
            <FieldDescription>
              Consecutive missed days before removal.
            </FieldDescription>
          </Field>

          <FieldSet>
            <FieldLegend variant="label">Mentions</FieldLegend>
            <FieldDescription>
              Who gets pinged by each post.
            </FieldDescription>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={rolesId}>Role IDs</FieldLabel>
                <Textarea
                  id={rolesId}
                  value={values.mentionRoleIdsRaw}
                  rows={2}
                  className="font-mono text-sm"
                  placeholder="1234567890123456789"
                  onChange={(event) =>
                    patch({ mentionRoleIdsRaw: event.target.value })
                  }
                />
                <FieldDescription>
                  One per line. Use &ldquo;Copy ID&rdquo; in Discord.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor={usersId}>Discord usernames</FieldLabel>
                <Textarea
                  id={usersId}
                  value={values.mentionUsernamesRaw}
                  rows={2}
                  className="font-mono text-sm"
                  placeholder="rakib_dev"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(event) =>
                    patch({ mentionUsernamesRaw: event.target.value })
                  }
                />
                <FieldDescription>
                  Usernames, one per line.
                </FieldDescription>
              </Field>

              <Field orientation="horizontal">
                <Switch
                  id="mention-everyone"
                  checked={values.mentionEveryone}
                  onCheckedChange={(checked) =>
                    patch({ mentionEveryone: checked })
                  }
                />
                <FieldLabel htmlFor="mention-everyone" className="font-normal">
                  Ping @everyone
                </FieldLabel>
              </Field>
              <FieldDescription>
                Pings everyone in the server, every evening.
              </FieldDescription>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend variant="label">Schedule</FieldLegend>
            <FieldDescription>
              A missed post is never sent late.
            </FieldDescription>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={timeId}>Posts at</FieldLabel>
                <Input
                  id={timeId}
                  type="time"
                  value={values.announceTime}
                  required
                  aria-describedby={timeHintId}
                  className="max-w-40"
                  onChange={(event) =>
                    patch({ announceTime: event.target.value })
                  }
                />
                <FieldDescription id={timeHintId}>
                  Also opens{" "}
                  <Link
                    href="/dashboard/schedule"
                    className="underline underline-offset-4"
                  >
                    #daily-update
                  </Link>
                  {channelWindow
                    ? ` (locks at ${formatWallClock(channelWindow.closeTime)})`
                    : null}
                  .
                </FieldDescription>
              </Field>

              <FieldSet>
                <FieldLegend variant="label">Active days</FieldLegend>
                <FieldGroup
                  className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                  id={daysId}
                >
                  {WEEKDAYS.map((weekday) => {
                    const checkboxId = `announce-weekday-${weekday.value}`;
                    return (
                      <Field key={weekday.value} orientation="horizontal">
                        <Checkbox
                          id={checkboxId}
                          checked={values.daysOfWeek.includes(weekday.value)}
                          onCheckedChange={(checked) =>
                            patch({
                              daysOfWeek:
                                checked === true
                                  ? [...values.daysOfWeek, weekday.value].sort(
                                      (a, b) => a - b,
                                    )
                                  : values.daysOfWeek.filter(
                                      (day) => day !== weekday.value,
                                    ),
                            })
                          }
                        />
                        <FieldLabel
                          htmlFor={checkboxId}
                          className="font-normal"
                        >
                          {weekday.label}
                        </FieldLabel>
                      </Field>
                    );
                  })}
                </FieldGroup>
              </FieldSet>

              <Field orientation="horizontal">
                <Switch
                  id="announcement-enabled"
                  checked={values.enabled}
                  onCheckedChange={(checked) => patch({ enabled: checked })}
                />
                <FieldLabel
                  htmlFor="announcement-enabled"
                  className="font-normal"
                >
                  Announcement enabled
                </FieldLabel>
              </Field>
              <FieldDescription>
                Off pauses the timed post. &ldquo;Send now&rdquo; still works.
              </FieldDescription>
            </FieldGroup>
          </FieldSet>

          <Field orientation="horizontal">
            <Button type="submit" disabled={pending || overLimit}>
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Save data-icon="inline-start" />
              )}
              {pending ? "Saving…" : "Save announcement"}
            </Button>
            {overLimit ? (
              <span className="text-destructive text-sm">
                Too long to post — shorten the message before saving.
              </span>
            ) : null}
          </Field>
        </FieldGroup>
      </form>

      <AlertDialog open={confirmEveryone} onOpenChange={setConfirmEveryone}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AtSign aria-hidden className="size-4" />
              Ping every member of the server?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Saving this turns the nightly announcement into a guild-wide
              notification for roughly 5,000 students, and it{" "}
              <strong>stays on</strong> until someone turns it off — not just
              for tonight.
              <br />
              <br />
              Your name is recorded against the change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                // Keep the dialog mounted while the request is in flight so the
                // pending state is visible and a second click cannot land.
                event.preventDefault();
                save();
              }}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Turn @everyone on and save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Live preview ─────────────────────────────────────────────────────────────

type PreviewState = {
  data: AnnouncementPreview | null;
  error: string | null;
  loading: boolean;
};

function withinLimit(preview: AnnouncementPreview): boolean {
  return preview.withinLimit && preview.length <= preview.limit;
}

/** Re-renders the message server-side as the admin types: debounced 600 ms and
 *  aborted per keystroke. Mention state is stored-only, which the pane says. */
function useLivePreview(
  payload: AnnouncementPayload,
  values: AnnouncementFormValues,
): PreviewState {
  const { body, terminationDays } = values;

  // Unchanged from what is stored, so the payload already carries that render.
  // Derived during render to avoid a second pass on every keystroke.
  const isStored =
    body === payload.template.body &&
    terminationDays === payload.template.terminationDays;

  // Keyed by the exact input that produced it, which makes `loading` derivable:
  // a result whose key no longer matches means a request is still outstanding.
  const [result, setResult] = useState<{
    key: string;
    data: AnnouncementPreview | null;
    error: string | null;
  } | null>(null);

  const key = `${terminationDays}\u0000${body}`;

  useEffect(() => {
    if (isStored || !Number.isFinite(terminationDays)) return;

    const controller = new AbortController();

    // 600 ms: every call resolves each mention target upstream, so an
    // un-debounced editor would hammer Discord on behalf of a fast typist.
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/announcement/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, terminationDays }),
          signal: controller.signal,
          cache: "no-store",
        });

        const json: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          // A 400 is the unknown-placeholder rejection and names the exact
          // token to fix, so it is shown verbatim.
          setResult({
            key,
            data: null,
            error:
              (json as { message?: string } | null)?.message ??
              "Could not render a preview.",
          });
          return;
        }

        setResult({ key, data: json as AnnouncementPreview, error: null });
      } catch (cause) {
        // An abort means a newer keystroke superseded this request; recording
        // it would overwrite the newer answer with a stale failure.
        if ((cause as Error).name === "AbortError") return;
        setResult({
          key,
          data: null,
          error: "Could not reach the server to render a preview.",
        });
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [body, terminationDays, isStored, key]);

  if (isStored) {
    return {
      data: {
        ...payload.preview,
        withinLimit: payload.preview.length <= payload.preview.limit,
        supportedPlaceholders: payload.supportedPlaceholders,
      },
      error: null,
      loading: false,
    };
  }

  const current = result?.key === key ? result : null;

  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: current === null,
  };
}

function PreviewPane({ preview }: { preview: PreviewState }) {
  const { data, error, loading } = preview;

  return (
    <Field>
      <FieldLabel className="flex items-center gap-2">
        <Eye aria-hidden className="size-4" />
        Preview
        {data ? (
          <Badge variant={withinLimit(data) ? "outline" : "destructive"}>
            {data.length} / {data.limit}
          </Badge>
        ) : null}
        {loading ? <Spinner className="size-3.5" /> : null}
      </FieldLabel>

      <FieldDescription>
        Exactly what students will see.
      </FieldDescription>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {data ? (
        <>
          <DiscordMessage
            aria-live="polite"
            content={data.content}
            className="max-h-80 overflow-auto"
          />

          <FieldDescription>
            {data.mentions.unresolved.length > 0 ? (
              <>
                Will be skipped (no longer found):{" "}
                {data.mentions.unresolved.map(describeUnresolved).join("; ")}.
              </>
            ) : (
              "Mentions update here after you save."
            )}
          </FieldDescription>
        </>
      ) : null}
    </Field>
  );
}
