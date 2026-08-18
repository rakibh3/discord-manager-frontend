"use client";

import { AtSign, Eye, Save } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateAnnouncement } from "@/actions/announcement";
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
import type { AnnouncementPayload, AnnouncementPreview } from "@/lib/api/types";
import {
  describeUnresolved,
  formValuesFrom,
  validateAnnouncement,
  type AnnouncementFormValues,
} from "@/lib/validation/announcement";
import { WEEKDAYS } from "@/lib/validation/schedule";

/**
 * The announcement editor.
 *
 * Two rules shape it. **There is no close-time field** — `{{close_time}}` is
 * read from the `#daily-update` schedule so the two can never disagree, and
 * offering one here would create a second source of truth the backend ignores.
 * **There is no cron field**, for the same reason as the channel schedule.
 *
 * The character counter is driven by the server-rendered preview, not by
 * `body.length`: the 2,000-character limit applies to the message *after*
 * placeholder expansion with the mention line appended, so a short-looking body
 * can still be rejected.
 */
export function AnnouncementEditor({
  payload,
  onUpdated,
}: {
  payload: AnnouncementPayload;
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
  const rolesId = useId();
  const usersId = useId();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // A save — or another admin's change arriving via revalidation — resets the
  // form's baseline. Adjusted during render rather than in an effect, which
  // would briefly show the superseded values in the inputs.
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
    const validation = validateAnnouncement(payload, values);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updateAnnouncement(validation.patch);
      if (result.ok) {
        onUpdated(result.data);
        toast.success(
          "Announcement saved. The scheduled task was rebuilt in-process.",
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
              The stored template, with placeholders left unexpanded. Typing a
              literal <code className="font-mono">@everyone</code> here does
              nothing — mentions come only from the allowlist below.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Placeholders</FieldLabel>
            <FieldDescription>
              Click to insert at the cursor. Any other{" "}
              <code className="font-mono">{"{{token}}"}</code> is rejected on
              save — it would reach every student as literal characters.
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
              Fills <code className="font-mono">{"{{termination_day}}"}</code>{" "}
              — how many consecutive missed days means removal from the process.
            </FieldDescription>
          </Field>

          <FieldSet>
            <FieldLegend variant="label">Mentions</FieldLegend>
            <FieldDescription>
              The only source of pings. Mention text typed into the body is
              inert, and an entry that no longer resolves at post time is
              dropped from that post rather than blocking it.
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
                  One per line, or separated by spaces or commas. 17–20 digit
                  snowflakes from &ldquo;Copy ID&rdquo; in Discord. Leave empty
                  to ping no roles.
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
                  Handles, not display names. A leading{" "}
                  <code className="font-mono">@</code> and any capitals are
                  normalized away.
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
                Notifies every member of the server, every evening, until turned
                off. This switch is the only thing that can do that.
              </FieldDescription>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend variant="label">Schedule</FieldLegend>
            <FieldDescription>
              When the message posts. Unlike the channel schedule there is no
              catch-up — a missed announcement is never posted late.
            </FieldDescription>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={timeId}>Posts at</FieldLabel>
                <Input
                  id={timeId}
                  type="time"
                  value={values.announceTime}
                  required
                  className="max-w-40"
                  onChange={(event) =>
                    patch({ announceTime: event.target.value })
                  }
                />
                <FieldDescription>Asia/Dhaka, 24-hour.</FieldDescription>
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
                Turning this off pauses the timed post and keeps the message and
                the times. &ldquo;Send now&rdquo; still works.
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

/**
 * Re-renders the message server-side as the admin types.
 *
 * Debounced at 600 ms and aborted on every keystroke: the upstream call
 * resolves each mention target, so an un-debounced editor would hammer Discord.
 * It is also the only way to get an honest character count — the limit applies
 * to the rendered message plus the mention line, which the browser cannot
 * compute.
 *
 * `mentionEveryone` and the mention lists are deliberately *not* inputs here:
 * the preview endpoint accepts only `body` and `terminationDays`, so the
 * mention line it appends is always the **stored** one. That is called out in
 * the pane rather than hidden.
 */
function useLivePreview(
  payload: AnnouncementPayload,
  values: AnnouncementFormValues,
): PreviewState {
  const { body, terminationDays } = values;

  // Unchanged from what is stored — the payload already carries that exact
  // render, so there is nothing to ask the server for. Derived during render
  // rather than pushed into state by an effect, which would cost a second
  // render pass on every keystroke that returns the body to its saved value.
  const isStored =
    body === payload.template.body &&
    terminationDays === payload.template.terminationDays;

  // Keyed by the exact input that produced it, which is what makes `loading`
  // derivable: a result whose key no longer matches is a stale answer to an
  // older keystroke, so a request must still be outstanding.
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
        Rendered by the same code the timed post uses, so this is exactly what
        students read. The count is on the rendered message including the
        mention line — not on the body above.
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
            <code className="font-mono">{"{{close_time}}"}</code> resolved to{" "}
            <strong>{data.closeTime}</strong>, read from the #daily-update
            schedule — change it there, not here.
            {data.mentions.unresolved.length > 0 ? (
              <>
                {" "}
                Mention targets that no longer resolve and would be dropped:{" "}
                {data.mentions.unresolved.map(describeUnresolved).join("; ")}.
              </>
            ) : null}
          </FieldDescription>

          <FieldDescription>
            The mention line shown is built from the <strong>saved</strong>{" "}
            allowlist. Unsaved mention changes appear here only after saving.
          </FieldDescription>
        </>
      ) : null}
    </Field>
  );
}
