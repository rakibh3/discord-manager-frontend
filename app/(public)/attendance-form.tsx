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
  | { kind: "not-member" }
  | { kind: "not-enrolled"; message?: string }
  /** A 403 whose message names a pairing disagreement. The pre-submit pair
   *  check should make this unreachable through the form — it renders as a
   *  plain alert. Kept as a distinct outcome so the message text is never
   *  confused with the "email not enrolled" refusal. */
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

/** The email↔handle pairing verdict behind the submit button.
 *
 *  - `idle` — not applicable yet (a field is empty, malformed, or its own
 *    live badge has not come back verified; a pair cannot be checked with
 *    half a pair).
 *  - `checking` — both badges are green and the debounced pair request has
 *    not settled yet.
 *  - `match` — the pair is submittable as-is; the same predicate the
 *    submit path enforces, so the button's state matches what the server
 *    will decide one click later.
 *  - `mismatch` — a pairing disagreement was detected. The submit button
 *    stays disabled with a message naming the disagreement; the only way
 *    forward is entering the email and username that belong together.
 *  - `error` — the check could not run (network, rate limit). Not a
 *    blocker: the write path re-runs the pairing check server-side, so a
 *    network blip never locks a student out — same philosophy as the two
 *    field badges. */
type PairState = "idle" | "checking" | "match" | "mismatch" | "error";

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
  // fired. Both must be `true` before the pairing check even runs.
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

  // The pairing verdict, tagged with the input pair it belongs to — same
  // pattern as the two field components, so an out-of-order answer for an
  // older input pair is simply never displayed.
  const [pairRemote, setPairRemote] = useState<{
    key: string;
    state: PairState;
  } | null>(null);

  const emailId = useId();
  const handleId = useId();

  // Holds the Alert element ref so a failed submit can move focus to it —
  // keyboard and screen-reader users otherwise have to scroll back up to read
  // what the server said, which is the entire point of the alert.
  const alertRef = useRef<HTMLDivElement | null>(null);
  const pairAbortRef = useRef<AbortController | null>(null);

  const setField = (field: keyof Values, value: string) => {
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
    // The pairing verdict was for the prior input pair too — nothing to
    // clear on the outcome side; every outcome is tied to a submit attempt,
    // which resets it itself.
  };
  const setEmailField = (value: string) => {
    setField("email", value);
    setEmailVerified(null);
  };

  // The normalized input pair the pairing verdict is keyed on. Same
  // normalization the server applies, so a value re-checked with different
  // casing or padding does not spend another request.
  const normalizedEmail = values.email.trim().toLowerCase();
  const normalizedHandle = normalizeDiscordUsername(values.discordUsername);
  const pairKey = `${normalizedEmail}|${normalizedHandle}`;

  // The pair check only runs when BOTH individual badges are green — a pair
  // cannot be checked with half a pair, and the individual failures already
  // block the button with a more precise message.
  const pairEligible = handleVerified === true && emailVerified === true;

  const pairState: PairState = (() => {
    if (!pairEligible) return "idle";

    return pairRemote?.key === pairKey ? pairRemote.state : "checking";
  })();

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

    // Live verification — both must come back as `true` before the pairing
    // check even runs. `null` means the debounce is still pending or the
    // request failed without a verdict; either way, do not let the button
    // fire yet.
    if (handleVerified === null)
      return "Checking Discord handle…";
    if (!handleVerified)
      return "Discord username not found in the server. Enter the correct username.";
    if (emailVerified === null)
      return "Checking email…";
    if (!emailVerified)
      return "Email not on enrolment roster. Use the email you registered with for the course.";

    // The pairing gate. This is the check that decides whether these two
    // values describe one person in our records — attendance can be
    // submitted only when the pair agrees. An `error` state is NOT a
    // blocker: the write path re-runs the pairing check server-side, so a
    // network blip here never locks a student out.
    if (pairState === "checking")
      return "Checking that your email and Discord username match…";
    if (pairState === "mismatch") return PAIR_MISMATCH_MESSAGE;

    return null;
  })();

  const canSubmit = blockingReason === null && !submitting;

  // A mismatch is the one blocker that is an error rather than a "still
  // working on it" hint, so the line under the button is drawn as one.
  const blockedByMismatch = blockingReason === PAIR_MISMATCH_MESSAGE;

  // The debounced, browser-direct pairing check. Fires only when the pair
  // is eligible (both badges green) and the settled input pair has no
  // verdict yet. Aborts stale requests and keys every result on the input
  // pair it was requested for, so a slow answer for an older pair can never
  // overwrite the verdict for the current one.
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

        // A rate-limited or failed check is an `error`, not a blocker — the
        // submit path re-runs the pairing check server-side.
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
    // Keyed on the settled pair + eligibility, so retyping either input — or
    // an individual badge flipping — re-fires the check with the new pair.
  }, [
    pairKey,
    pairEligible,
    normalizedEmail,
    normalizedHandle,
  ]);

  // After a server-side failure, move keyboard focus to the top-of-form
  // alert so the next step is announced and reachable without scrolling.
  // Only fires on the failure branches — a successful submit replaces the
  // form with the success card, and moving focus mid-edit on every keystroke
  // would be hostile.
  useEffect(() => {
    if (!outcome) return;
    if (outcome.kind === "success") return;
    alertRef.current?.focus();
  }, [outcome]);

  const submit = async (event?: React.FormEvent<HTMLFormElement>) => {
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
        const json = (await response.json()) as ApiResponse<SubmitAttendancePayload>;
        setOutcome({ kind: "success", payload: json.data });
        return;
      }

      if (response.status === 429) {
        const reset = Number(response.headers.get("RateLimit-Reset"));
        // No auto-retry: the per-IP budget is the whole budget, and the
        // entered values stay on screen so nothing has to be retyped.
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
      //   - the email↔handle pairing disagrees
      // The two are decided by the server's message text, not by the status
      // code. The pairing branch should be unreachable through this form —
      // the submit button is gated on the pre-submit pair check — but a
      // direct request or a race (a pairing changed between check and
      // submit) can still land here, and the student needs the refusal
      // explained rather than a modal.
      if (response.status === 403) {
        const message = body?.message ?? "";
        const isPairingMismatch = /do not match our records/i.test(message);

        if (isPairingMismatch) {
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

      // On the write path a 404 is a genuine failure (Discord handle not found in the server).
      if (response.status === 404) {
        setOutcome({ kind: "not-member" });
        setErrors((current) => ({
          ...current,
          discordUsername:
            "This Discord username is not in our Discord server.",
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
        attendanceDate={outcome.payload.attendanceDate}
        submittedAt={outcome.payload.submittedAt}
        member={outcome.payload.member}
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
                  This Discord username is not in our Discord server. Join the server first, then try again.
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

            {outcome?.kind === "pairing" ? (
              <Alert variant="destructive">
                <AlertTitle>Email and Discord username do not match</AlertTitle>
                <AlertDescription>{outcome.message}</AlertDescription>
              </Alert>
            ) : null}

            {outcome?.kind === "rate-limited" ? (
              <Alert variant="destructive">
                <AlertTitle>Too many attempts</AlertTitle>
                <AlertDescription>
                  Please wait{" "}
                  {outcome.retryAfter
                    ? `about ${outcome.retryAfter} seconds`
                    : "a few minutes"}{" "}
                  and try again.
                </AlertDescription>
              </Alert>
            ) : null}

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
              onChange={setHandleField}
              error={errors.discordUsername}
              onVerifiedChange={setHandleVerified}
              // The duplicate verdict is reported separately so the button
              // can be disabled with a precise "already submitted" message
              // instead of the generic "not a member" one. The green badge
              // above the field is still the primary signal. The email↔handle
              // pairing check is deliberately NOT done on this field's live
              // verify — it runs as its own debounced `/verify-pair` call
              // below.
              onAlreadySubmittedChange={setHandleAlreadySubmitted}
            />

            <Field>
              {/*
                The button is disabled until the Discord handle and (when the
                roster gate is armed) the email are confirmed verified by the
                live badges AND the email↔handle pair check comes back clean.
                `blockingReason` is the single source of truth for what is
                gating the form, and is also rendered below the button so a
                locked-out student always knows what to fix. Submit also
                re-checks every verdict — defence in depth against
                paste-and-click or browser autofill submitting the form
                before a callback fires.
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
                  className={`flex items-start gap-2 text-sm ${
                    blockedByMismatch
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
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
    </>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-success flex items-center gap-2">
          <CheckCircle2 aria-hidden />
          Attendance recorded
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p>
          Your attendance for <strong>{formatCivilDate(attendanceDate)}</strong>{" "}
          has been recorded for{" "}
          <strong className="text-foreground">
            {member.displayName ?? member.discordUsername}
          </strong>{" "}
          ({member.discordUsername}) at {formatDhaka(submittedAt, "time")}.
        </p>
        <p className="text-muted-foreground">
          If a <code>#daily-update</code> post is still pending, please post
          it.
        </p>
      </CardContent>
    </Card>
  );
}
