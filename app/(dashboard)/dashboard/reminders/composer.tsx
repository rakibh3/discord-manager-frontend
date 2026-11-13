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
import { PeriodPicker } from "@/components/dashboard/period-picker";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type {
  DiscordServer,
  ReminderChannel,
  ReminderCriterion,
} from "@/lib/api/types";
import { dhakaYesterday } from "@/lib/dhaka-date";
import {
  countedDays,
  formatPeriod,
  periodProblem,
  type Period,
} from "@/lib/period";
import {
  CRITERION_DESCRIPTION,
  CRITERION_LABEL,
  estimateRemaining,
  REMINDER_MESSAGE_MAX_LENGTH,
} from "@/lib/reminder-labels";

type Outcome =
  | { kind: "nobody" | "queue-down" | "error"; message: string }
  | { kind: "conflict"; message: string; existingId: string | null };

const CRITERIA: ReminderCriterion[] = ["MISSING_UPDATE", "MISSING_BOTH"];

/** Compose and send a broadcast, behind three guards: a `/targets` preview of
 *  the exact selection, a confirmation naming who and how many, and a submit
 *  lock. The preview and the send derive their target set from one shared query,
 *  so the two cannot disagree. */
export function Composer({
  sendingDisabled,
  disabledReason,
  dmPerSecond,
  servers,
  email,
}: {
  sendingDisabled: boolean;
  disabledReason: string | null;
  dmPerSecond: number;
  servers: DiscordServer[];
  /** Whether the reminder email sender is configured, and if not, why. */
  email: {
    configured: boolean;
    reason: string | null;
    fromEmail: string | null;
    perSecond: number;
  };
}) {
  // Yesterday in *Dhaka*, not in the browser's zone — the usual case is
  // reminding people who missed yesterday's update.
  const [period, setPeriod] = useState<Period>({
    mode: "date",
    date: dhakaYesterday(),
  });
  const [criterion, setCriterion] = useState<ReminderCriterion>("MISSING_UPDATE");
  const [minMissedDays, setMinMissedDays] = useState(1);
  const [guildIds, setGuildIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  // Discord alone is the default — exactly what a broadcast meant before email
  // existed. Not part of the preview key: the target list is the same whatever
  // the channels, only how each person is contacted changes.
  const [channels, setChannels] = useState<ReminderChannel[]>(["DISCORD"]);
  const wantsDiscord = channels.includes("DISCORD");
  const wantsEmail = channels.includes("EMAIL");
  const [preview, setPreview] = useState<TargetPreview | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewing, startPreview] = useTransition();
  const [sending, startSend] = useTransition();
  const submitted = useRef(false);

  const messageId = useId();
  const criterionId = useId();
  const thresholdId = useId();

  const selection = { period, criterion, minMissedDays, guildIds };
  // One key for the whole selection: a preview belongs to the exact query that
  // produced it, and keeping it after *any* part changes is how the wrong people
  // get DMed. Cleared during render, so there is no window where a stale count
  // is shown next to a live Send button.
  const selectionKey = JSON.stringify(selection);
  const [seenSelection, setSeenSelection] = useState(selectionKey);
  if (seenSelection !== selectionKey) {
    setSeenSelection(selectionKey);
    setPreview(null);
    setOutcome(null);
  }

  const trimmed = message.trim();
  const remaining = REMINDER_MESSAGE_MAX_LENGTH - message.length;
  const overLimit = remaining < 0;
  const counted = countedDays(period);
  const problem = periodProblem(period);

  const thresholdProblem =
    minMissedDays > counted
      ? `The period counts ${counted} day${counted === 1 ? "" : "s"}, so a threshold of ${minMissedDays} can never be met.`
      : null;

  const recipients = preview?.ok ? preview.uniqueRecipients : null;
  const emailReach = preview?.ok ? preview.email : null;

  const channelProblem =
    channels.length === 0
      ? "Choose at least one channel."
      : wantsEmail && !email.configured
        ? (email.reason ?? "Email isn't set up on the server yet.")
        : wantsEmail && !wantsDiscord && emailReach?.reachable === 0
          ? "None of these people has a registered email address. Add Discord as a channel."
          : null;

  const canSend =
    !sendingDisabled &&
    !channelProblem &&
    recipients !== null &&
    recipients > 0 &&
    trimmed.length > 0 &&
    !overLimit &&
    !problem &&
    !thresholdProblem;

  const runPreview = () => {
    startPreview(async () => {
      const result = await previewTargets(selection);
      setPreview(result);
      if (!result.ok) toast.error(result.message);
    });
  };

  const confirmSend = () => {
    if (submitted.current) return;
    submitted.current = true;

    startSend(async () => {
      const result = await sendBroadcast({
        ...selection,
        message: trimmed,
        channels,
      });
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

  // Delivery time is the slower of the two queues, each at its own pace.
  const estimate =
    recipients !== null
      ? estimateRemaining(
          Math.max(
            wantsDiscord ? recipients / dmPerSecond : 0,
            wantsEmail && emailReach ? emailReach.reachable / email.perSecond : 0,
          ),
          1,
        )
      : null;

  const toggleChannel = (channel: ReminderChannel) =>
    setChannels((current) =>
      current.includes(channel)
        ? current.filter((entry) => entry !== channel)
        : [...current, channel],
    );

  const channelLabel =
    wantsDiscord && wantsEmail
      ? "Discord DM and email"
      : wantsEmail
        ? "email"
        : "Discord DM";

  /** An empty selection means "every server", and every box is shown ticked.
   *  Un-ticking one from that state has to mean "all but this one" — the
   *  alternative, treating the first click as a fresh selection, would silently
   *  drop every other server from a broadcast that is about to go out. */
  const toggleServer = (guildId: string) =>
    setGuildIds((current) => {
      if (current.length === 0) {
        return servers
          .map((server) => server.guildId)
          .filter((entry) => entry !== guildId);
      }
      const next = current.includes(guildId)
        ? current.filter((entry) => entry !== guildId)
        : [...current, guildId];
      // Back to every server: keep it as the "all" state rather than a list
      // that happens to name them all, so the send omits `guildIds` entirely.
      return next.length === servers.length ? [] : next;
    });

  const scopeLabel =
    guildIds.length === 0
      ? "every server"
      : servers
          .filter((server) => guildIds.includes(server.guildId))
          .map((server) => server.label)
          .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send a reminder</CardTitle>
        <CardDescription>
          Message everyone who&rsquo;s behind. This can&rsquo;t be undone.
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
                Nobody matches this selection for {formatPeriod(period)}. Nothing
                was sent, and nothing needed to be. {outcome.message}
              </AlertDescription>
            </Alert>
          ) : null}

          {outcome?.kind === "conflict" ? (
            <Alert variant="warning">
              <AlertTitle>
                Another broadcast already covers one of these days
              </AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                {/* An overlap check, not date equality — worth saying, because
                    "but I picked a different date" is the obvious reaction. */}
                <span>
                  A broadcast that shares any of these days is still running.
                  Wait for it, or cancel it.
                </span>
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
                Nothing was sent, and the period isn&rsquo;t blocked — try again
                once the queue is back.
              </AlertDescription>
            </Alert>
          ) : null}

          {outcome?.kind === "error" ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{outcome.message}</AlertDescription>
            </Alert>
          ) : null}

          <Field>
            <FieldLabel>Period to remind about</FieldLabel>
            <PeriodPicker value={period} onChange={setPeriod} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={criterionId}>Who counts as behind</FieldLabel>
              <Select
                value={criterion}
                onValueChange={(value) =>
                  setCriterion(value as ReminderCriterion)
                }
              >
                <SelectTrigger id={criterionId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CRITERIA.map((value) => (
                      <SelectItem key={value} value={value}>
                        {CRITERION_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                {CRITERION_DESCRIPTION[criterion]}
              </FieldDescription>
            </Field>

            <Field data-invalid={thresholdProblem ? true : undefined}>
              <FieldLabel htmlFor={thresholdId}>
                Days behind, at least
              </FieldLabel>
              <Input
                id={thresholdId}
                type="number"
                inputMode="numeric"
                min={1}
                max={counted}
                value={minMissedDays}
                aria-invalid={thresholdProblem ? true : undefined}
                aria-describedby={`${thresholdId}-hint`}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  setMinMissedDays(Number.isInteger(value) && value >= 1 ? value : 1);
                }}
                className="w-28"
              />
              <FieldDescription id={`${thresholdId}-hint`}>
                {thresholdProblem ??
                  `Out of ${counted} counted day${counted === 1 ? "" : "s"}.`}
              </FieldDescription>
            </Field>
          </div>

          {/* Only where there is a choice to make. One server is the normal
              case, and a scope control with a single checkbox is noise. */}
          {servers.length > 1 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Servers to target</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {servers.map((server) => (
                  <label
                    key={server.guildId}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={
                        guildIds.length === 0 || guildIds.includes(server.guildId)
                      }
                      onCheckedChange={() => toggleServer(server.guildId)}
                    />
                    {server.label}
                  </label>
                ))}
              </div>
              <p className="text-muted-foreground text-sm">
                {guildIds.length === 0
                  ? "Every configured server. Someone in two of them is still DMed once."
                  : `Narrowed to ${scopeLabel}.`}
              </p>
            </fieldset>
          ) : null}

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Send by</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={wantsDiscord}
                  onCheckedChange={() => toggleChannel("DISCORD")}
                />
                Discord DM
              </label>
              <label className="flex items-center gap-2 text-sm">
                {/* Never disabled: a disabled box can't say why. Ticking it
                    while email isn't set up shows the reason and blocks Send. */}
                <Checkbox
                  checked={wantsEmail}
                  onCheckedChange={() => toggleChannel("EMAIL")}
                />
                Email
                {email.fromEmail ? (
                  <span className="text-muted-foreground font-mono text-xs">
                    from {email.fromEmail}
                  </span>
                ) : null}
              </label>
            </div>
            <p
              className={
                channelProblem
                  ? "text-destructive text-sm"
                  : "text-muted-foreground text-sm"
              }
            >
              {channelProblem ??
                (!email.configured
                  ? "Email isn't set up on the server yet."
                  : wantsEmail
                    ? "Students who never registered get the Discord DM only."
                    : "Email goes to each student's registered address.")}
            </p>
          </fieldset>

          <Field orientation="horizontal">
            <Button
              type="button"
              variant="outline"
              onClick={runPreview}
              disabled={previewing || !!problem || !!thresholdProblem}
            >
              {previewing ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Eye data-icon="inline-start" />
              )}
              Preview recipients
            </Button>
          </Field>

          {preview && !preview.ok ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{preview.message}</AlertDescription>
            </Alert>
          ) : null}

          {preview?.ok ? (
            <Alert variant={preview.uniqueRecipients === 0 ? "success" : "default"}>
              <AlertTitle>
                {preview.uniqueRecipients === 0
                  ? "Nobody is behind for this selection"
                  : `${preview.uniqueRecipients.toLocaleString()} ${preview.uniqueRecipients === 1 ? "person" : "people"} would be reminded`}
              </AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                {preview.uniqueRecipients > 0 ? (
                  <>
                    {estimate ? (
                      <span>Delivery takes {estimate}.</span>
                    ) : null}
                    {wantsEmail ? (
                      <span>
                        {preview.email.reachable.toLocaleString()} can be
                        emailed · {preview.email.notRegistered.toLocaleString()}{" "}
                        not registered
                      </span>
                    ) : null}
                    {preview.targetCount !== preview.uniqueRecipients ? (
                      // The gap is the per-server audit trail, not duplicate
                      // sends — said plainly, because two different counts on
                      // one screen otherwise read as a bug.
                      <span className="text-muted-foreground">
                        People in two servers are counted once.
                      </span>
                    ) : null}
                    <details className="text-sm">
                      <summary className="cursor-pointer">
                        Show the first {preview.sample.length} of{" "}
                        {preview.targetCount.toLocaleString()}
                      </summary>
                      {/* Deliberately a bounded slice: the endpoint returns
                          every target unpaginated, and thousands of rows would
                          freeze the tab. */}
                      <ul className="mt-2 flex max-h-48 flex-col gap-0.5 overflow-y-auto font-mono text-xs">
                        {preview.sample.map((target, index) => (
                          <li
                            key={`${target.memberId}-${index}`}
                            className="truncate"
                          >
                            {target.discordUsername}
                            {target.displayName ? ` — ${target.displayName}` : null}
                            {target.missedDays !== undefined
                              ? ` · ${target.missedDays} day${target.missedDays === 1 ? "" : "s"} behind`
                              : null}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </>
                ) : (
                  <span>
                    Nobody matches this criterion and threshold over{" "}
                    {formatPeriod(period)}. There is nothing to send.
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
                  : `${remaining.toLocaleString()} characters left.`}
              </span>
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
                    Send to {recipients?.toLocaleString()}{" "}
                    {recipients === 1 ? "person" : "people"}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This sends a <strong>{channelLabel}</strong> reminder to{" "}
                    <strong>
                      {recipients?.toLocaleString()}{" "}
                      {recipients === 1 ? "person" : "people"}
                    </strong>{" "}
                    who, over <strong>{formatPeriod(period)}</strong>, matched
                    &ldquo;{CRITERION_LABEL[criterion].toLowerCase()}&rdquo; on
                    at least{" "}
                    <strong>
                      {minMissedDays} of {counted} counted day
                      {counted === 1 ? "" : "s"}
                    </strong>
                    , across {scopeLabel}. It cannot be undone or recalled once a
                    message is delivered.
                    <br />
                    <br />
                    {wantsEmail && emailReach ? (
                      <>
                        Email reaches{" "}
                        <strong>{emailReach.reachable.toLocaleString()}</strong>{" "}
                        of them;{" "}
                        {emailReach.notRegistered.toLocaleString()} never
                        registered and have no address.
                        <br />
                        <br />
                      </>
                    ) : null}
                    Delivery is <strong>paced, not immediate</strong> and runs
                    in the background for {estimate ?? "some time"}.
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
                {problem ??
                  thresholdProblem ??
                  channelProblem ??
                  (recipients === null
                    ? "Preview the recipients for this selection first."
                    : recipients === 0
                      ? "There is nobody to remind for this selection."
                      : trimmed.length === 0
                        ? "Write a message first."
                        : "The message is over the character limit.")}
              </p>
            ) : null}
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
