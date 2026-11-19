"use client";

import {
  CheckCircle2,
  CircleAlert,
  Clock,
  Link2,
  Loader2,
  Send,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { DailyUpdateTemplateCard } from "./_components/daily-update-template-card";
import {
  DiscordHandleField,
  type HandleBadge,
} from "./discord-handle-field";
import { EmailField, type EmailBadge } from "./email-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import type {
  ApiResponse,
  SubmitAttendancePayload,
} from "@/lib/api/types";
import { formatCivilDate, formatDhaka, formatWallClock } from "@/lib/dhaka-date";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_FIELD_COPY,
  attendanceSchema,
  normalizeDiscordUsername,
} from "@/lib/validation/attendance";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/** Shown wherever the email↔handle pair disagrees: under the disabled submit
 *  button, and as the fallback for the server's 403 on the same verdict. */
const PAIR_MISMATCH_MESSAGE =
  "Your email and Discord username do not match our records. Attendance cannot be submitted — please check both fields.";

type Outcome =
  | { kind: "success"; payload: SubmitAttendancePayload }
  | { kind: "already"; message: string }
  | { kind: "closed"; message: string }
  | { kind: "not-member" }
  | { kind: "not-enrolled"; message?: string }
  /** A 403 whose message names a pairing disagreement. The pre-submit pair
   *  check should make this unreachable through the form — it renders as a
   *  plain alert. Kept as a distinct outcome so the message text is never
   *  confused with the "email not enrolled" or "window closed" refusals. */
  | { kind: "pairing"; message: string }
  | { kind: "rate-limited"; retryAfter: number | null }
  | { kind: "error"; message: string };

type Values = {
  email: string;
  discordUsername: string;
};

const EMPTY: Values = {
  email: "",
  discordUsername: "",
};

/** The email↔handle pairing verdict behind the submit button. */
type PairState = "idle" | "checking" | "match" | "mismatch" | "error";

type CheckStepStatus = "idle" | "checking" | "ok" | "error";

export function AttendanceForm({
  emailVerificationRequired = true,
  closeTime = null,
}: {
  emailVerificationRequired?: boolean;
  closeTime?: string | null;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>(
    {},
  );
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Live verification verdicts from the email and handle fields.
  const [handleVerified, setHandleVerified] = useState<boolean | null>(null);
  const [handleAlreadySubmitted, setHandleAlreadySubmitted] = useState<
    boolean | null
  >(null);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);

  // Badge kinds for the top-of-form verification readiness strip.
  const [emailBadgeKind, setEmailBadgeKind] = useState<EmailBadge["kind"]>(
    emailVerificationRequired ? "idle" : "gate-off",
  );
  const [handleBadgeKind, setHandleBadgeKind] =
    useState<HandleBadge["kind"]>("idle");

  // The pairing verdict, tagged with the input pair it belongs to.
  const [pairRemote, setPairRemote] = useState<{
    key: string;
    state: PairState;
  } | null>(null);

  const formHeadingId = useId();
  const emailId = useId();
  const handleId = useId();

  const alertRef = useRef<HTMLDivElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const handleInputRef = useRef<HTMLInputElement | null>(null);
  const pairAbortRef = useRef<AbortController | null>(null);

  const setField = (field: keyof Values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const setHandleField = (value: string) => {
    setField("discordUsername", value);
    setHandleVerified(null);
    setHandleAlreadySubmitted(null);
  };

  const setEmailField = (value: string) => {
    setField("email", value);
    setEmailVerified(null);
  };

  const normalizedEmail = values.email.trim().toLowerCase();
  const normalizedHandle = normalizeDiscordUsername(values.discordUsername);
  const pairKey = `${normalizedEmail}|${normalizedHandle}`;

  const pairEligible = handleVerified === true && emailVerified === true;

  const pairState: PairState = (() => {
    if (!pairEligible) return "idle";
    return pairRemote?.key === pairKey ? pairRemote.state : "checking";
  })();

  const blockingReason = ((): string | null => {
    if (handleAlreadySubmitted === true) {
      return "You have already submitted attendance for today.";
    }

    if (!values.email.trim()) return "Enter your email address.";
    if (!values.discordUsername.trim()) return "Enter your Discord username.";

    const parsed = attendanceSchema.safeParse(values);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const field = first?.path[0] as keyof Values | undefined;
      if (field === "email") return "Fix the email address format.";
      if (field === "discordUsername")
        return "Fix the Discord username format.";
    }

    if (handleVerified === null) return "Checking Discord handle…";
    if (!handleVerified) {
      return "Discord username not found in the server. Enter the correct username.";
    }
    if (emailVerified === null) return "Checking email…";
    if (!emailVerified) {
      return "Email not on enrolment roster. Use the email you registered with for the course.";
    }

    if (pairState === "checking") {
      return "Checking that your email and Discord username match…";
    }
    if (pairState === "mismatch") return PAIR_MISMATCH_MESSAGE;

    return null;
  })();

  const canSubmit = blockingReason === null && !submitting;
  const blockedByMismatch = blockingReason === PAIR_MISMATCH_MESSAGE;

  // Debounced, browser-direct pairing check once both field badges are green.
  useEffect(() => {
    if (!pairEligible || !API_BASE) {
      pairAbortRef.current?.abort();
      return;
    }

    const timer = setTimeout(async () => {
      pairAbortRef.current?.abort();
      const controller = new AbortController();
      pairAbortRef.current = controller;

      const settle = (state: PairState) =>
        setPairRemote({ key: pairKey, state });

      try {
        const response = await fetch(
          `${API_BASE}/attendance/verify-pair?email=${encodeURIComponent(normalizedEmail)}&username=${encodeURIComponent(normalizedHandle)}`,
          { signal: controller.signal, cache: "no-store" },
        );

        if (!response.ok) {
          settle("error");
          return;
        }

        const json = (await response.json()) as ApiResponse<{
          verified: boolean;
        }>;

        settle(json.data?.verified ? "match" : "mismatch");
      } catch (cause) {
        if ((cause as Error).name === "AbortError") return;
        settle("error");
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      pairAbortRef.current?.abort();
    };
  }, [pairKey, pairEligible, normalizedEmail, normalizedHandle]);

  // Move focus to the top-of-form alert on server-side outcomes.
  useEffect(() => {
    if (!outcome) return;
    if (outcome.kind === "success") return;
    alertRef.current?.focus();
  }, [outcome]);

  const submit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (submitting) return;

    // Defence in depth against paste-then-enter or autofill bypassing disabled state.
    if (emailVerified !== true) {
      setErrors((current) => ({
        ...current,
        email:
          "Verify an enrolled email first — wait for the confirmation next to the field.",
      }));
      emailInputRef.current?.focus();
      return;
    }
    if (handleVerified !== true) {
      setErrors((current) => ({
        ...current,
        discordUsername:
          "Verify a live Discord username first — wait for the confirmation next to the handle.",
      }));
      handleInputRef.current?.focus();
      return;
    }
    if (pairState === "checking") {
      setOutcome({
        kind: "error",
        message:
          "Still checking that your email and Discord username match — try again in a moment.",
      });
      return;
    }
    if (pairState === "mismatch") {
      setOutcome({ kind: "pairing", message: PAIR_MISMATCH_MESSAGE });
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
      if (next.email) emailInputRef.current?.focus();
      else if (next.discordUsername) handleInputRef.current?.focus();
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

    try {
      const response = await fetch(`${API_BASE}/attendance/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (response.status === 201) {
        const json =
          (await response.json()) as ApiResponse<SubmitAttendancePayload>;
        setOutcome({ kind: "success", payload: json.data });
        return;
      }

      if (response.status === 429) {
        const reset = Number(response.headers.get("RateLimit-Reset"));
        setOutcome({
          kind: "rate-limited",
          retryAfter: Number.isFinite(reset) && reset > 0 ? reset : null,
        });
        return;
      }

      const body = (await response.json().catch(() => null)) as {
        message?: string;
        errorDetails?: { issues?: { path: string; message: string }[] };
      } | null;

      // 403 covers three distinct server refusals:
      //   1. the attendance window closed between page load and submit
      //   2. the email↔handle pairing disagrees
      //   3. the email is not on the enrolled student roster
      if (response.status === 403) {
        const message = body?.message ?? "";

        if (/window is currently closed/i.test(message)) {
          setOutcome({
            kind: "closed",
            message:
              message ||
              "The attendance submission window is currently closed.",
          });
          return;
        }

        if (/do not match our records/i.test(message)) {
          setOutcome({
            kind: "pairing",
            message: message || PAIR_MISMATCH_MESSAGE,
          });
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

      if (response.status === 404) {
        setOutcome({ kind: "not-member" });
        setErrors((current) => ({
          ...current,
          discordUsername:
            "This Discord username is not in our Discord server.",
        }));
        return;
      }

      if (response.status === 409) {
        setOutcome({
          kind: "already",
          message: body?.message ?? "You have already submitted today.",
        });
        return;
      }

      if (response.status === 400 && body?.errorDetails?.issues?.length) {
        const next: Partial<Record<keyof Values, string>> = {};
        for (const issue of body.errorDetails.issues) {
          const field = (issue.path.charAt(0).toLowerCase() +
            issue.path.slice(1)) as keyof Values;
          if (field in EMPTY) {
            next[field] ??= ATTENDANCE_FIELD_COPY[field] ?? issue.message;
          }
        }
        setErrors(next);
        if (next.email) emailInputRef.current?.focus();
        else if (next.discordUsername) handleInputRef.current?.focus();
        else {
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
        attendanceDate={outcome.payload.attendanceDate}
        submittedAt={outcome.payload.submittedAt}
        member={outcome.payload.member}
      />
    );
  }

  // Derive visual step statuses for the live readiness bar.
  const emailStepStatus: CheckStepStatus = (() => {
    if (!emailVerificationRequired) {
      if (!values.email.trim()) return "idle";
      return attendanceSchema.shape.email.safeParse(values.email).success
        ? "ok"
        : "error";
    }
    if (emailBadgeKind === "verified") return "ok";
    if (emailBadgeKind === "checking") return "checking";
    if (emailBadgeKind === "malformed" || emailBadgeKind === "not-enrolled") {
      return "error";
    }
    return "idle";
  })();

  const handleStepStatus: CheckStepStatus = (() => {
    if (handleBadgeKind === "verified" || handleBadgeKind === "duplicate") {
      return "ok";
    }
    if (handleBadgeKind === "checking") return "checking";
    if (handleBadgeKind === "malformed" || handleBadgeKind === "unknown") {
      return "error";
    }
    return "idle";
  })();

  const pairStepStatus: CheckStepStatus = (() => {
    if (pairState === "match") return "ok";
    if (pairState === "checking") return "checking";
    if (pairState === "mismatch") return "error";
    return "idle";
  })();

  return (
    <Card accent="lilac" className="gap-5 py-5 sm:py-6">
      <CardHeader className="border-border-muted border-b px-4 pb-4 sm:px-6">
        <div className="flex flex-col gap-1">
          <CardTitle>
            <h2 id={formHeadingId} className="text-xl">
              Check-in form
            </h2>
          </CardTitle>
          <CardDescription>
            Submit once per day with your email and Discord username.
            {closeTime
              ? ` Today's window closes at ${formatWallClock(closeTime)} (Dhaka).`
              : ""}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 px-4 sm:px-6">
        {/* Live 3-gate verification strip */}
        <ol
          aria-label="Live verification checks"
          className="grid grid-cols-3 gap-1.5 sm:gap-2"
        >
          <CheckStepChip
            step="01"
            label={emailVerificationRequired ? "Roster email" : "Email"}
            shortLabel="Email"
            status={emailStepStatus}
          />
          <CheckStepChip
            step="02"
            label={
              handleBadgeKind === "duplicate" ? "Already in" : "Discord server"
            }
            shortLabel={handleBadgeKind === "duplicate" ? "Done" : "Discord"}
            status={handleStepStatus}
          />
          <CheckStepChip
            step="03"
            label="Pair match"
            shortLabel="Match"
            status={pairStepStatus}
          />
        </ol>

        <form
          onSubmit={submit}
          noValidate
          aria-labelledby={formHeadingId}
          className="public-form"
        >
          <FieldGroup>
            {/* Single focusable alert slot for server outcomes. */}
            <div ref={alertRef} tabIndex={-1} className="focus:outline-none">
              {outcome?.kind === "already" ? (
                <Alert variant="success">
                  <CheckCircle2 aria-hidden="true" />
                  <AlertTitle>Already recorded</AlertTitle>
                  <AlertDescription>
                    {outcome.message} Your attendance is already recorded — no
                    further action needed on this form.
                  </AlertDescription>
                </Alert>
              ) : null}

              {outcome?.kind === "closed" ? (
                <Alert variant="destructive" className="text-status-error">
                  <Clock aria-hidden="true" />
                  <AlertTitle>Attendance window closed</AlertTitle>
                  <AlertDescription className="text-status-error">
                    {outcome.message}
                  </AlertDescription>
                </Alert>
              ) : null}

              {outcome?.kind === "not-member" ? (
                <Alert variant="destructive" className="text-status-error">
                  <CircleAlert aria-hidden="true" />
                  <AlertTitle>Not in the Discord server</AlertTitle>
                  <AlertDescription className="text-status-error">
                    This Discord username is not in our Discord server. Join the
                    server first, then try again.
                  </AlertDescription>
                </Alert>
              ) : null}

              {outcome?.kind === "not-enrolled" ? (
                <Alert variant="destructive" className="text-status-error">
                  <CircleAlert aria-hidden="true" />
                  <AlertTitle>Email not enrolled</AlertTitle>
                  <AlertDescription className="text-status-error">
                    {outcome.message ??
                      "This email is not on the enrolment roster. Use the email you registered with for the course."}
                  </AlertDescription>
                </Alert>
              ) : null}

              {outcome?.kind === "pairing" ? (
                <Alert variant="destructive" className="text-status-error">
                  <CircleAlert aria-hidden="true" />
                  <AlertTitle>Email and Discord username do not match</AlertTitle>
                  <AlertDescription className="text-status-error">
                    {outcome.message}
                  </AlertDescription>
                </Alert>
              ) : null}

              {outcome?.kind === "rate-limited" ? (
                <Alert variant="destructive" className="text-status-error">
                  <CircleAlert aria-hidden="true" />
                  <AlertTitle>Too many attempts</AlertTitle>
                  <AlertDescription className="text-status-error">
                    Please wait{" "}
                    {outcome.retryAfter
                      ? `about ${outcome.retryAfter} seconds`
                      : "a few minutes"}{" "}
                    and try again.
                  </AlertDescription>
                </Alert>
              ) : null}

              {outcome?.kind === "error" ? (
                <Alert variant="destructive" className="text-status-error">
                  <CircleAlert aria-hidden="true" />
                  <AlertTitle>Could not submit</AlertTitle>
                  <AlertDescription className="text-status-error">
                    {outcome.message}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>

            <EmailField
              fieldId={emailId}
              value={values.email}
              onChange={setEmailField}
              error={errors.email}
              onVerifiedChange={setEmailVerified}
              onBadgeKindChange={setEmailBadgeKind}
              emailVerificationRequired={emailVerificationRequired}
              inputRef={emailInputRef}
            />

            <DiscordHandleField
              fieldId={handleId}
              value={values.discordUsername}
              onChange={setHandleField}
              error={errors.discordUsername}
              onVerifiedChange={setHandleVerified}
              onAlreadySubmittedChange={setHandleAlreadySubmitted}
              onBadgeKindChange={setHandleBadgeKind}
              inputRef={handleInputRef}
            />

            {/* Positive pair match confirmation right above submit */}
            {pairState === "match" && !submitting ? (
              <p
                role="status"
                aria-live="polite"
                className="border-border-sage bg-success/15 text-status-success flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold"
              >
                <Link2 aria-hidden="true" className="size-4 shrink-0" />
                <span>
                  Email and Discord account verified together — ready to submit.
                </span>
              </p>
            ) : null}

            <Field className="pt-1">
              <Button
                type="submit"
                size="lg"
                disabled={!canSubmit}
                className="w-full"
              >
                {submitting ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Send data-icon="inline-start" aria-hidden="true" />
                )}
                {submitting ? "Submitting attendance…" : "Submit Attendance"}
              </Button>

              {blockingReason && !submitting ? (
                <p
                  id="submit-blocking"
                  role={
                    blockingReason.endsWith("…") ? undefined : "status"
                  }
                  aria-live={
                    blockingReason.endsWith("…") ? "off" : "polite"
                  }
                  className={cn(
                    "flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-medium",
                    blockedByMismatch
                      ? "border-border-coral bg-destructive/10 text-status-error"
                      : handleAlreadySubmitted
                        ? "border-border-sage bg-success/15 text-status-success"
                        : "border-border-muted bg-muted/50 text-muted-foreground",
                  )}
                >
                  {handleAlreadySubmitted ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0"
                    />
                  ) : blockingReason.endsWith("…") ? (
                    <Loader2
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 animate-spin"
                    />
                  ) : (
                    <CircleAlert
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0"
                    />
                  )}
                  <span>{blockingReason}</span>
                </p>
              ) : null}
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function CheckStepChip({
  step,
  label,
  shortLabel,
  status,
}: {
  step: string;
  label: string;
  shortLabel: string;
  status: CheckStepStatus;
}) {
  return (
    <li
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2 text-xs transition-colors sm:justify-start sm:px-2.5",
        status === "ok" &&
          "border-border-sage bg-success/15 text-status-success font-semibold",
        status === "error" &&
          "border-border-coral bg-destructive/10 text-status-error font-semibold",
        status === "checking" &&
          "border-border-yellow bg-highlight/20 text-foreground font-medium",
        status === "idle" &&
          "border-border-muted bg-muted/40 text-muted-foreground",
      )}
    >
      {status === "ok" ? (
        <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0" />
      ) : status === "error" ? (
        <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
      ) : status === "checking" ? (
        <Loader2 aria-hidden="true" className="size-3.5 shrink-0 animate-spin" />
      ) : (
        <span className="font-mono text-[10px] font-bold">{step}</span>
      )}
      <span className="hidden truncate sm:inline">{label}</span>
      <span className="truncate sm:hidden">{shortLabel}</span>
    </li>
  );
}

/** The success card. One variant only — every accepted submission records
 *  attendance, and a pairing disagreement never gets this far. */
function SuccessCard({
  attendanceDate,
  submittedAt,
  member,
}: {
  attendanceDate: string;
  submittedAt: string;
  member: SubmitAttendancePayload["member"];
}) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Attendance Recorded · Discord Manager";
    headingRef.current?.focus();
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <Card accent="sage" className="gap-5 py-5 sm:py-6">
      <CardHeader className="border-border-muted border-b px-4 pb-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success" className="font-mono text-[11px]">
            <CheckCircle2 aria-hidden="true" />
            ATTENDANCE RECORDED
          </Badge>
        </div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-heading mt-1 text-2xl font-bold tracking-tight focus:outline-none"
        >
          You&apos;re checked in for today!
        </h2>
        <CardDescription>
          Part 1 of 2 is done. Remember to post your learning update in Discord
          before the window closes.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 px-4 text-sm sm:px-6">
        {/* Verified member + timestamp receipt */}
        <div className="border-foreground bg-muted/50 flex flex-col gap-3 rounded-xl border-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="border-foreground size-10 shrink-0 border-2">
              {member.avatarUrl ? (
                <AvatarImage src={member.avatarUrl} alt="" />
              ) : null}
              <AvatarFallback className="font-mono text-xs font-bold">
                {member.discordUsername.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="font-heading truncate text-base font-bold">
                {member.displayName ?? member.discordUsername}
              </span>
              <span className="text-muted-foreground truncate font-mono text-xs">
                @{member.discordUsername}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Badge variant="outline" className="font-mono text-[11px]">
              {formatCivilDate(attendanceDate)}
            </Badge>
            <Badge variant="yellow" className="font-mono text-[11px]">
              {formatDhaka(submittedAt, "time")}
            </Badge>
          </div>
        </div>

        {/* Inline copyable #daily-update template for Step 2 */}
        <DailyUpdateTemplateCard today={attendanceDate} compact />
      </CardContent>
    </Card>
  );
}
