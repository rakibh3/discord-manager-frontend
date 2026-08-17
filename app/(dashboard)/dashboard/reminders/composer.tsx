"use client";

import { Eye, Send } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  previewTargets,
  sendBroadcast,
  type TargetPreview,
} from "@/actions/reminders";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
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
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { dhakaToday, dhakaYesterday, formatCivilDate } from "@/lib/dhaka-date";
import {
  estimateRemaining,
  REMINDER_MESSAGE_MAX_LENGTH,
} from "@/lib/reminder-labels";

type Outcome =
  | { kind: "nobody" | "queue-down" | "error"; message: string }
  | { kind: "conflict"; message: string; existingId: string | null };

/**
 * Compose and send a broadcast.
 *
 * Three guards, in order, because this DMs thousands of people and cannot be
 * undone:
 *
 *   1. A `/targets` preview for the **currently selected date** must exist.
 *      Changing the date discards it, so the count in the confirmation can
 *      never belong to a different day.
 *   2. A confirmation dialog names the date and the exact recipient count.
 *   3. A single-submit guard, because the backend's 409 would otherwise show an
 *      error for an action that actually succeeded.
 */
export function Composer({
  sendingDisabled,
  disabledReason,
  dmPerSecond,
}: {
  sendingDisabled: boolean;
  disabledReason: string | null;
  dmPerSecond: number;
}) {
  // Yesterday in *Dhaka*, not in the browser's zone — the usual case is
  // reminding people who missed yesterday's update.
  const [date, setDate] = useState(dhakaYesterday());
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<TargetPreview | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewing, startPreview] = useTransition();
  const [sending, startSend] = useTransition();
  const submitted = useRef(false);

  const dateId = useId();
  const messageId = useId();
  const today = dhakaToday();

  // A preview belongs to one date. Silently keeping it after the date changes
  // is exactly how the wrong day's members get DMed. Cleared during render, so
  // there is no frame in which the send button is live against a stale count.
  const [previewedDate, setPreviewedDate] = useState(date);
  if (previewedDate !== date) {
    setPreviewedDate(date);
    setPreview(null);
    setOutcome(null);
  }

  const trimmed = message.trim();
  const remaining = REMINDER_MESSAGE_MAX_LENGTH - message.length;
  const overLimit = remaining < 0;

  const previewedCount =
    preview?.ok && preview.date === date ? preview.targetCount : null;

  const canSend =
    !sendingDisabled &&
    previewedCount !== null &&
    previewedCount > 0 &&
    trimmed.length > 0 &&
    !overLimit;

  const runPreview = () => {
    startPreview(async () => {
      const result = await previewTargets(date);
      setPreview(result);
      if (!result.ok) toast.error(result.message);
    });
  };

  const confirmSend = () => {
    if (submitted.current) return;
    submitted.current = true;

    startSend(async () => {
      const result = await sendBroadcast({ date, message: trimmed });
      // A 202 redirects and never returns, so reaching here means it did not
      // queue. Release the guard so the admin can act on the outcome.
      submitted.current = false;
      setDialogOpen(false);

      switch (result.outcome) {
        case "nobody-to-remind":
          setOutcome({ kind: "nobody", message: result.message });
          break;
        case "conflict":
          setOutcome({
            kind: "conflict",
            message: result.message,
            existingId: result.existingId,
          });
          break;
        case "queue-unavailable":
          setOutcome({ kind: "queue-down", message: result.message });
          break;
        default:
          setOutcome({ kind: "error", message: result.message });
      }
    });
  };

  const estimate =
    previewedCount !== null
      ? estimateRemaining(previewedCount, dmPerSecond)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send a reminder</CardTitle>
        <CardDescription>
          Direct-messages every member who is in the guild and has no daily
          update recorded for the chosen date. This cannot be undone.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <FieldGroup>
          {sendingDisabled && disabledReason ? (
            <Alert variant="destructive">
              <AlertTitle>Sending is unavailable</AlertTitle>
              <AlertDescription>{disabledReason}</AlertDescription>
            </Alert>
          ) : null}

          {outcome?.kind === "nobody" ? (
            <Alert variant="success">
              <AlertTitle>There is nobody to remind</AlertTitle>
              <AlertDescription>
                Every member already has a daily update recorded for{" "}
                {formatCivilDate(date)}. Nothing was sent, and nothing needed to
                be. {outcome.message}
              </AlertDescription>
            </Alert>
          ) : null}

          {outcome?.kind === "conflict" ? (
            <Alert variant="warning">
              <AlertTitle>A broadcast for this date is already running</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                <span>{outcome.message}</span>
                {outcome.existingId ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/reminders/${outcome.existingId}`}>
                      View that broadcast&rsquo;s progress
                    </Link>
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          {outcome?.kind === "queue-down" ? (
            <Alert variant="destructive">
              <AlertTitle>The reminder queue is unreachable</AlertTitle>
              <AlertDescription>
                Redis could not be reached, so the jobs were refused. The
                broadcast was <strong>auto-cancelled</strong>, which means this
                date is not left blocked — you can send again once the queue is
                back. The API, the bot, message ingestion and the channel
                scheduler are all unaffected. {outcome.message}
              </AlertDescription>
            </Alert>
          ) : null}

          {outcome?.kind === "error" ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{outcome.message}</AlertDescription>
            </Alert>
          ) : null}

          <Field>
            <FieldLabel htmlFor={dateId}>Date to remind about</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id={dateId}
                type="date"
                value={date}
                // A native date input yields a civil `YYYY-MM-DD` string with no
                // Date object in between, which is exactly the wire format and
                // sidesteps every timezone conversion.
                max={today}
                onChange={(event) => setDate(event.target.value)}
                className="w-auto"
              />
              <Button
                type="button"
                variant="outline"
                onClick={runPreview}
                disabled={previewing || !date || date > today}
              >
                {previewing ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Eye data-icon="inline-start" />
                )}
                Preview recipients
              </Button>
            </div>
            <FieldDescription>
              Asia/Dhaka calendar day. Future dates are rejected. Defaults to
              yesterday, which is the usual case.
            </FieldDescription>
          </Field>

          {preview && !preview.ok ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{preview.message}</AlertDescription>
            </Alert>
          ) : null}

          {preview?.ok && preview.date === date ? (
            <Alert variant={preview.targetCount === 0 ? "success" : "default"}>
              <AlertTitle>
                {preview.targetCount === 0
                  ? "Nobody is missing an update for this date"
                  : `${preview.targetCount.toLocaleString()} member${preview.targetCount === 1 ? "" : "s"} would be messaged`}
              </AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                {preview.targetCount > 0 ? (
                  <>
                    <span>
                      This is the same query the send itself runs, so the two
                      cannot disagree.
                      {estimate
                        ? ` At ${dmPerSecond} DM${dmPerSecond === 1 ? "" : "s"} per second, delivery would take ${estimate}.`
                        : null}
                    </span>
                    <details className="text-sm">
                      <summary className="cursor-pointer">
                        Show the first {preview.sample.length} of{" "}
                        {preview.targetCount.toLocaleString()}
                      </summary>
                      {/* Deliberately a bounded slice: the endpoint returns
                          every target unpaginated, and thousands of rows would
                          freeze the tab. */}
                      <ul className="mt-2 flex max-h-48 flex-col gap-0.5 overflow-y-auto font-mono text-xs">
                        {preview.sample.map((target) => (
                          <li key={target.memberId} className="truncate">
                            {target.discordUsername}
                            {target.displayName
                              ? ` — ${target.displayName}`
                              : null}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </>
                ) : (
                  <span>
                    Every member in the guild already has an update recorded for{" "}
                    {formatCivilDate(preview.date)}. There is nothing to send.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          <Field data-invalid={overLimit ? true : undefined}>
            <FieldLabel htmlFor={messageId}>Message</FieldLabel>
            <Textarea
              id={messageId}
              value={message}
              rows={5}
              onChange={(event) => setMessage(event.target.value)}
              aria-invalid={overLimit ? true : undefined}
              aria-describedby={`${messageId}-hint`}
              placeholder="Please submit your daily update for yesterday in #daily-update."
            />
            <FieldDescription id={`${messageId}-hint`}>
              <span aria-live="polite">
                {overLimit
                  ? `${Math.abs(remaining).toLocaleString()} characters over the limit.`
                  : `${remaining.toLocaleString()} characters remaining.`}
              </span>{" "}
              The cap is {REMINDER_MESSAGE_MAX_LENGTH.toLocaleString()}, not
              2,000 — Discord&rsquo;s limit minus the fixed &ldquo;⚠️ Daily
              Update Reminder&rdquo; heading each DM is wrapped in.
            </FieldDescription>
          </Field>

          <Field orientation="horizontal">
            <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button disabled={!canSend || sending}>
                  <Send data-icon="inline-start" />
                  Send reminder
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Send to {previewedCount?.toLocaleString()} member
                    {previewedCount === 1 ? "" : "s"}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This direct-messages{" "}
                    <strong>
                      {previewedCount?.toLocaleString()} member
                      {previewedCount === 1 ? "" : "s"}
                    </strong>{" "}
                    who have no daily update recorded for{" "}
                    <strong>{formatCivilDate(date)}</strong>. It cannot be
                    undone or recalled once a message is delivered.
                    <br />
                    <br />
                    Delivery is <strong>paced, not immediate</strong>: at{" "}
                    {dmPerSecond} DM{dmPerSecond === 1 ? "" : "s"} per second
                    this runs in the background for {estimate ?? "some time"}.
                    You can watch progress, and cancel part-way through — but
                    anyone already messaged stays messaged.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={sending}
                    onClick={(event) => {
                      event.preventDefault();
                      confirmSend();
                    }}
                  >
                    {sending ? <Spinner data-icon="inline-start" /> : null}
                    Queue the broadcast
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {!canSend && !sendingDisabled ? (
              <p className="text-muted-foreground text-sm">
                {previewedCount === null
                  ? "Preview the recipients for this date first."
                  : previewedCount === 0
                    ? "There is nobody to remind for this date."
                    : trimmed.length === 0
                      ? "Write a message first."
                      : "The message is over the character limit."}
              </p>
            ) : null}
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
