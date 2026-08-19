"use client";

import { CheckCircle2, CircleAlert, Send } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { DiscordHandleField } from "./discord-handle-field";
import { EmailField } from "./email-field";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import type {
  ApiResponse,
  SubmitAttendancePayload,
} from "@/lib/api/types";
import { formatCivilDate, formatDhaka } from "@/lib/dhaka-date";
import {
  ATTENDANCE_FIELD_COPY,
  attendanceSchema,
} from "@/lib/validation/attendance";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type Outcome =
  | { kind: "success"; payload: SubmitAttendancePayload }
  /** The 202 branch: today's attendance is NOT recorded, a mismatch report is
   *  queued for an admin to review. The form must render a clearly different
   *  card — a "Attendance recorded" message on this branch would be a lie. */
  | { kind: "report-queued"; payload: SubmitAttendancePayload }
  | { kind: "already"; message: string }
  | { kind: "not-member" }
  | { kind: "not-enrolled"; message?: string }
  | { kind: "handle-mismatch"; message: string }
  | { kind: "rate-limited"; retryAfter: number | null }
  | { kind: "error"; message: string };

type Values = {
  email: string;
  discordUsername: string;
  /** Ticked when the student's Discord pairing does not match the on-file
   *  record. On a paired entry with a mismatched handle the submission is
   *  NOT recorded as today's attendance — a mismatch report is queued. */
  cannotEnterRealDiscordUsername: boolean;
};

const EMPTY: Values = {
  email: "",
  discordUsername: "",
  cannotEnterRealDiscordUsername: false,
};

export function AttendanceForm({
  emailVerificationRequired = true,
}: {
  emailVerificationRequired?: boolean;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Live verification verdicts from the email and handle fields. `null` means
  // "no answer yet" — the user has not finished typing or the debounce has not
  // fired. Both must be `true` for submit to be enabled.
  const [handleVerified, setHandleVerified] = useState<boolean | null>(null);
  // Tri-state for the handle's "already submitted" verdict, reported separately
  // from `handleVerified` so a duplicate result can disable the button with a
  // precise message (the badge above already shows the green "already
  // submitted" line). `null` means "no answer yet" — the form should not block
  // on this signal alone; `handleVerified` already covers the gating path.
  const [handleAlreadySubmitted, setHandleAlreadySubmitted] = useState<
    boolean | null
  >(null);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);

  const emailId = useId();
  const handleId = useId();

  // Holds the Alert element ref so a failed submit can move focus to it —
  // keyboard and screen-reader users otherwise have to scroll back up to read
  // what the server said, which is the entire point of the alert.
  const alertRef = useRef<HTMLDivElement | null>(null);

  const setField = (field: keyof Values, value: string | boolean) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  // Reset the verdict any time the user starts typing again — the previous
  // "good" answer was for the value before this keystroke, not for the value
  // after. Without this, swapping a verified handle for an unknown one would
  // leave the submit button enabled until the next debounce settles.
  const setHandleField = (value: string) => {
    setField("discordUsername", value);
    // Reset every verdict that referenced the previous handle — including the
    // duplicate verdict, which was for the *prior* handle and would otherwise
    // leave the button stuck on "already submitted" if the new handle is a
    // fresh, not-yet-submitted member.
    setHandleVerified(null);
    setHandleAlreadySubmitted(null);
  };
  const setEmailField = (value: string) => {
    setField("email", value);
    setEmailVerified(null);
  };

  // What is currently blocking submit, in display order. Returns the first
  // active block, or `null` when nothing is in the way. Used by the helper
  // text under the submit button so the student always knows what to fix.
  const blockingReason = ((): string | null => {
    // "Already submitted" wins over every other verdict — the handle field's
    // green badge already says it, but the gating text under the button needs
    // to repeat it so a student scanning for "why is the button off?" lands
    // on the right reason. Checked before "not a member" because a typing
    // student with a stale `unknown` verdict on a duplicate handle would
    // otherwise see the wrong copy.
    if (handleAlreadySubmitted === true) {
      return "You have already submitted attendance for today.";
    }

    // Required-field checks first — a missing value blocks before any
    // verification could even fire.
    if (!values.email.trim()) return "Enter your email address.";
    if (!values.discordUsername.trim()) return "Enter your Discord username.";

    // Schema-level rules (regex). The fields above will already have been
    // entered; this catches a malformed email or username.
    const parsed = attendanceSchema.safeParse(values);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const field = first?.path[0] as keyof Values | undefined;
      if (field === "email") return "Fix the email address format.";
      if (field === "discordUsername")
        return "Fix the Discord username format.";
    }

    // Live verification — both must come back as `true` before submit unlocks.
    // `null` means the debounce is still pending or the request failed without
    // a verdict; either way, do not let the button fire yet.
    if (handleVerified === null)
      return "Checking Discord handle…";
    if (!handleVerified)
      return "Discord username not found in the server. Enter the correct username.";
    if (emailVerified === null)
      return "Checking email…";
    if (!emailVerified)
      return "Email not on enrolment roster. Use the email you registered with for the course.";

    return null;
  })();

  const canSubmit = blockingReason === null && !submitting;

  // After a server-side failure, move keyboard focus to the top-of-form
  // alert so the next step is announced and reachable without scrolling.
  // Only fires on the failure branches — a successful submit replaces the
  // form with the success card, and moving focus mid-edit on every keystroke
  // would be hostile.
  useEffect(() => {
    if (!outcome) return;
    if (outcome.kind === "success" || outcome.kind === "report-queued") return;
    alertRef.current?.focus();
  }, [outcome]);

  const submit = async (
    event?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
    /** Modal-triggered resubmit sends the flag; the form's own submit does not.
     *  Passed as an argument rather than read from state so the click handler's
     *  React state updates don't race the read inside this function — without
     *  it, the flag is queued but the request still ships with `false`, and
     *  the backend returns 403 again. */
    fromMismatchReport = false,
  ) => {
    event?.preventDefault();
    if (submitting) return;

    // Defence in depth: even with the button disabled, a paste-then-submit
    // keystroke or browser autofill could bypass it. Re-check the live
    // verdicts here so a click that somehow fires still bounces.
    if (handleVerified !== true) {
      setErrors((current) => ({
        ...current,
        discordUsername:
          "Verify a live Discord username first — wait for the ✅ next to the handle.",
      }));
      return;
    }
    if (emailVerified !== true) {
      setErrors((current) => ({
        ...current,
        email: "Verify an enrolled email first — wait for the ✅ next to the field.",
      }));
      return;
    }

    const parsed = attendanceSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof Values, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof Values;
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }

    if (!API_BASE) {
      setOutcome({
        kind: "error",
        message:
          "This form is not configured to reach the server. Please tell an admin.",
      });
      return;
    }

    setSubmitting(true);
    setOutcome(null);

    // The modal's "Report & Submit" button passes `fromMismatchReport=true`
    // synchronously so the flag ships with this request even though the modal
    // also flips the verdict. We OR with the field value so a manually
    // preserved state also propagates if a future form gains a checkbox.
    const optIn =
      values.cannotEnterRealDiscordUsername || fromMismatchReport;
    const submitPayload = {
      ...parsed.data,
      ...(optIn ? { cannotEnterRealDiscordUsername: true } : {}),
    };

    try {
      const response = await fetch(`${API_BASE}/attendance/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitPayload),
      });

      // 201 — attendance recorded (the normal success branch)
      // 202 — report queued, attendance NOT recorded (the mismatch branch)
      // The status code split is preserved for backwards compatibility with
      // older clients that only check the status; new code should read
      // `data.attendanceRecorded` directly.
      if (response.status === 201 || response.status === 202) {
        const json = (await response.json()) as ApiResponse<SubmitAttendancePayload>;
        // The flag is the source of truth: a 202 with `attendanceRecorded: true`
        // is impossible, and a 201 with `attendanceRecorded: false` would mean
        // the server contradicted itself.
        if (json.data?.attendanceRecorded === false) {
          setOutcome({ kind: "report-queued", payload: json.data });
        } else {
          setOutcome({ kind: "success", payload: json.data });
        }
        return;
      }

      if (response.status === 429) {
        const reset = Number(response.headers.get("RateLimit-Reset"));
        // No auto-retry: 5 attempts per 15 minutes per IP is the whole budget,
        // and the entered values stay on screen so nothing has to be retyped.
        setOutcome({
          kind: "rate-limited",
          retryAfter: Number.isFinite(reset) && reset > 0 ? reset : null,
        });
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | { message?: string; errorDetails?: { issues?: { path: string; message: string }[] } }
        | null;

      // 403 splits into two cases that point at different fields:
      //   - the email is not on the enrolled student list (when verification is armed)
      //   - the Discord handle does not match the one already paired with that email
      // The two are decided by the server's message text, not by the status code.
      // Spec quote: "Branching on the message text (and not just the status) is what
      // lets the form tell the student which input to fix."
      if (response.status === 403) {
        const message = body?.message ?? "";
        const isHandleMismatch =
          /does not match the (one already on file|paired account)/i.test(message);

        if (isHandleMismatch) {
          setOutcome({
            kind: "handle-mismatch",
            message:
              message ||
              "Discord username does not match the paired account for this email.",
          });
          // The form does not render an in-place checkbox for this case —
          // a "I cannot enter my real Discord username" opt-in would sit
          // on every verified handle and ask the student to declare a
          // problem they may not have. The mismatch modal owns the opt-in.
          return;
        }

        setOutcome({
          kind: "not-enrolled",
          message: message || "This email is not on the enrolment roster.",
        });
        setErrors((current) => ({
          ...current,
          email:
            "Email not on enrolment roster. Use the email you registered with for the course.",
        }));
        return;
      }

      // On the write path a 404 is a genuine failure (Discord handle not found in servers).
      if (response.status === 404) {
        setOutcome({ kind: "not-member" });
        setErrors((current) => ({
          ...current,
          discordUsername:
            "This Discord username is not in any of our servers.",
        }));
        return;
      }

      // 409 means the attendance is recorded. That is a good outcome.
      if (response.status === 409) {
        setOutcome({
          kind: "already",
          message: body?.message ?? "You have already submitted today.",
        });
        return;
      }

      if (response.status === 400 && body?.errorDetails?.issues?.length) {
        // Map the server's issues onto fields using our own copy — its
        // messages arrive Title Cased Word By Word and read wrong here.
        const next: Partial<Record<keyof Values, string>> = {};
        for (const issue of body.errorDetails.issues) {
          const field = (issue.path.charAt(0).toLowerCase() +
            issue.path.slice(1)) as keyof Values;
          if (field in EMPTY) {
            next[field] ??= ATTENDANCE_FIELD_COPY[field] ?? issue.message;
          }
        }
        setErrors(next);
        if (Object.keys(next).length === 0) {
          setOutcome({
            kind: "error",
            message: body.message ?? "Please check what you entered.",
          });
        }
        return;
      }

      setOutcome({
        kind: "error",
        message:
          body?.message ??
          "Something went wrong. Please try again in a moment.",
      });
    } catch {
      setOutcome({
        kind: "error",
        message:
          "Could not reach the server. Check your connection and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (outcome?.kind === "success") {
    return (
      <SuccessCard
        title="Attendance recorded"
        variant="success"
        attendanceDate={outcome.payload.attendanceDate}
        submittedAt={outcome.payload.submittedAt}
        member={outcome.payload.member}
        servers={outcome.payload.servers ?? []}
      />
    );
  }

  if (outcome?.kind === "report-queued") {
    return (
      <SuccessCard
        title="Report filed — attendance not recorded today"
        variant="warning"
        attendanceDate={outcome.payload.attendanceDate}
        submittedAt={outcome.payload.submittedAt}
        member={outcome.payload.member}
        servers={outcome.payload.servers ?? []}
        message={
          <>
            Your submitted Discord username doesn&apos;t match the one paired
            with your email. <strong>Today&apos;s attendance was not
            recorded</strong>, but a mismatch report has been filed for an
            admin to review. Once the pairing is fixed, you can submit
            normally tomorrow.
          </>
        }
      />
    );
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Daily Attendance</CardTitle>
        <CardDescription>
          Submit once per day. Only your email and Discord username are needed.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            {/*
              The single alert slot at the top of the form. Only one
              outcome fires at a time, so wrapping the cases in one focusable
              region lets the failure effect land keyboard focus on whatever
              message is currently showing. `tabIndex={-1}` keeps it
              focusable programmatically without inserting it into the tab
              order (the buttons below are the next step in the order).
            */}
            <div
              ref={alertRef}
              tabIndex={-1}
              className="focus:outline-none"
            >
            {outcome?.kind === "already" ? (
              <Alert variant="success">
                <AlertTitle>Already recorded</AlertTitle>
                <AlertDescription>
                  {outcome.message} Your attendance is already recorded — no further action needed.
                </AlertDescription>
              </Alert>
            ) : null}

            {outcome?.kind === "not-member" ? (
              <Alert variant="destructive">
                <AlertTitle>Not in the Discord server</AlertTitle>
                <AlertDescription>
                  This Discord username is not in any of our servers. Join the server first, then try again.
                </AlertDescription>
              </Alert>
            ) : null}

            {outcome?.kind === "not-enrolled" ? (
              <Alert variant="destructive">
                <AlertTitle>Email not enrolled</AlertTitle>
                <AlertDescription>
                  {outcome.message ??
                    "This email is not on the enrolment roster. Use the email you registered with for the course."}
                </AlertDescription>
              </Alert>
            ) : null}

            {/* handle-mismatch renders as a modal below, not a top-of-form alert */}

            {outcome?.kind === "error" ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{outcome.message}</AlertDescription>
              </Alert>
            ) : null}
            </div>

            <EmailField
              fieldId={emailId}
              value={values.email}
              onChange={setEmailField}
              error={errors.email}
              onVerifiedChange={setEmailVerified}
              emailVerificationRequired={emailVerificationRequired}
            />

            <DiscordHandleField
              fieldId={handleId}
              value={values.discordUsername}
              // Forward the typed email so the duplicate check is
              // pairing-aware: the badge matches the email the student
              // actually typed, not a stale handle-only read.
              email={values.email}
              onChange={setHandleField}
              error={errors.discordUsername}
              onVerifiedChange={setHandleVerified}
              // The duplicate verdict is reported separately so the button
              // can be disabled with a precise "already submitted" message
              // instead of the generic "not a member" one. The green badge
              // above the field is still the primary signal.
              onAlreadySubmittedChange={setHandleAlreadySubmitted}
            />

            {/*
              The handle-mismatch opt-in lives inside the modal below
              (see `<Dialog>` after `</form>`), not in the form body. A
              "I cannot enter my real Discord username" checkbox on every
              verified handle would ask the student to declare a problem
              they may not have.
            */}
            <Field>
              {/*
                The button is disabled until BOTH the Discord handle and (when
                the roster gate is armed) the email are confirmed verified by
                the live badge. `blockingReason` is the single source of truth
                for what is gating the form, and is also rendered below the
                button so a locked-out student always knows what to fix.
                Submit also re-checks the live verdicts — defence in depth
                against paste-and-click or browser autofill submitting the
                form before the callback fires.
              */}
              <Button type="submit" size="lg" disabled={!canSubmit}>
                {submitting ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Send data-icon="inline-start" />
                )}
                {submitting ? "Submitting…" : "Submit Attendance"}
              </Button>

              {/*
                Helper text under the button. Always rendered (when there is
                something to say) so the student is not left wondering why
                the button is unresponsive. Uses the same `aria-live="polite"`
                rhythm as the field badges above.
              */}
              {blockingReason && !submitting ? (
                <p
                  id="submit-blocking"
                  role="status"
                  aria-live="polite"
                  className="text-muted-foreground flex items-start gap-2 text-sm"
                >
                  <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <span>{blockingReason}</span>
                </p>
              ) : null}
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>

    {/*
      Mismatch modal — opens after a 403 handle-mismatch. Diagnosis is the
      backend's literal message. Two recovery options:
        * "Cancel" dismisses the modal; the form clears its outcome so
          the student can fix the handle (or leave) and resubmit.
        * "Report & Submit" sets the opt-in flag, retries the same
          submission, and the backend queues a mismatch report on success.

      On cancel, we deliberately do **not** reset `handleVerified`: the 403 was
      about the email↔handle pairing, not the handle being a non-member. The
      handle's `verified: true` verdict is still accurate for this exact
      value, and resetting it would drop the gating verdict to `null` and
      lock the button behind "Checking Discord handle…" forever (the lookup
      only re-fires when the handle value changes, which the student may not
      touch). If the student *does* edit the handle, the `setHandleField`
      helper already clears the verdict on every keystroke.
    */}
    <Dialog
      open={outcome?.kind === "handle-mismatch"}
      onOpenChange={(open) => {
        if (!open && outcome?.kind === "handle-mismatch") {
          setOutcome(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Discord username mismatch</DialogTitle>
          <DialogDescription>
            {outcome?.kind === "handle-mismatch" ? outcome.message : null}
          </DialogDescription>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          If this is not the Discord username paired with your email,
          an admin can review the submission and update the pairing.
        </p>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOutcome(null);
              // Do not reset `handleVerified` — see the comment on the
              // Dialog's onOpenChange above. The handle is still a real
              // Discord member; only the email↔handle pairing was wrong.
              // Clearing the verdict would lock the submit button on
              // "Checking Discord handle…" until the student retyped the
              // handle, which they may not need to.
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={submitting}
            onClick={() => {
              setOutcome(null);
              // Pass the flag as an argument so the request leaves the
              // browser with `cannotEnterRealDiscordUsername: true` already
              // in the payload. Reading state after a state-update inside
              // the same handler would still see the stale value, so the
              // flag would never actually ship and the modal would re-open
              // with the same 403 message.
              void submit(undefined, true);
            }}
          >
            {submitting ? <Spinner data-icon="inline-start" /> : null}
            Report & Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

/** The success / report-only card. Renders different chrome (`success` vs
 *  `warning`) because the report-only branch is a *deliberate* non-record:
 *  showing a green ✅ with "Attendance recorded" on it would be a lie. */
function SuccessCard({
  title,
  variant,
  attendanceDate,
  submittedAt,
  member,
  servers,
  message,
}: {
  title: string;
  variant: "success" | "warning";
  attendanceDate: string;
  submittedAt: string;
  member: SubmitAttendancePayload["member"];
  servers: Array<{
    guildId: string;
    label: string;
    recorded: boolean;
    alreadySubmitted: boolean;
  }>;
  message?: React.ReactNode;
}) {
  const recorded = servers.filter((s) => s.recorded);
  const alreadyOnFile = servers.filter(
    (s) => !s.recorded && s.alreadySubmitted,
  );
  const failed = servers.filter(
    (s) => !s.recorded && !s.alreadySubmitted,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle
          className={
            variant === "success"
              ? "text-success flex items-center gap-2"
              : "text-warning flex items-center gap-2"
          }
        >
          <CheckCircle2 aria-hidden />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {message ? <p>{message}</p> : null}
        <p>
          Your attendance for <strong>{formatCivilDate(attendanceDate)}</strong>{" "}
          {variant === "success" ? "has been recorded" : "was filed at"}{" "}
          {variant === "success" ? "for" : "by"}{" "}
          <strong className="text-foreground">
            {member.displayName ?? member.discordUsername}
          </strong>{" "}
          ({member.discordUsername}) at{" "}
          {formatDhaka(submittedAt, "time")}.
        </p>
        {/*
          One submission covers every server the handle belongs to, in one
          transaction — the student is never asked to pick one. Naming the
          servers is the only way they can tell that happened.

          Each server carries its own `recorded` (was written by this request)
          and `alreadySubmitted` (was already on file from an earlier
          submission) flags, so a partial outcome reads accurately: this run
          wrote to the recorded ones, the rest were already done.
        */}
        {servers.length > 1 ? (
          <div className="text-muted-foreground flex flex-col gap-1.5">
            {recorded.length > 0 ? (
              <p>
                These{" "}
                <strong className="text-foreground">
                  {recorded.map((s) => s.label).join(", ")}
                </strong>{" "}
                servers were recorded by this submission.
              </p>
            ) : null}
            {alreadyOnFile.length > 0 ? (
              <p>
                <strong className="text-foreground">
                  {alreadyOnFile.map((s) => s.label).join(", ")}
                </strong>{" "}
                — these servers already had an attendance row from an earlier submission; no further action needed.
              </p>
            ) : null}
            {failed.length > 0 ? (
              <p>
                <strong className="text-foreground">
                  {failed.map((s) => s.label).join(", ")}
                </strong>{" "}
                — these servers did not record. Please try again later.
              </p>
            ) : null}
          </div>
        ) : null}
        {variant === "success" ? (
          <p className="text-muted-foreground">
            If a <code>#daily-update</code>{" "}
            post is still pending, please post it.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}