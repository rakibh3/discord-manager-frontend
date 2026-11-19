"use client";

import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock,
  Mail,
  MailCheck,
  Phone,
  Send,
  User,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { DiscordUsernameGuide } from "../_components/discord-username-guide";
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
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import type { ApiResponse, SubmitRegistrationPayload } from "@/lib/api/types";
import { formatDhaka } from "@/lib/dhaka-date";
import {
  DISCORD_USERNAME_REGEX,
  normalizeDiscordUsername,
} from "@/lib/validation/attendance";
import {
  BD_MOBILE_REGEX,
  normalizeBdPhone,
  REGISTRATION_FIELD_COPY,
  registrationSchema,
  type RegistrationInput,
} from "@/lib/validation/registration";

/** Browser-direct, like the attendance form's submit — and here it matters
 *  beyond latency: the backend rate-limits this route per IP, and a call
 *  proxied through the Next server would put every registrant behind one
 *  address and one shared budget. */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type FieldName = keyof RegistrationInput;

const FIELD_ORDER: readonly FieldName[] = [
  "name",
  "email",
  "phone",
  "discordUsername",
];

const FIELD_LABELS: Record<FieldName, string> = {
  name: "Full name",
  email: "Email address",
  phone: "Phone number",
  discordUsername: "Discord username",
};

const EMPTY: RegistrationInput = {
  name: "",
  email: "",
  phone: "",
  discordUsername: "",
};

type Outcome =
  | {
      kind: "success";
      payload: SubmitRegistrationPayload;
      discordUsername: string;
    }
  /** 409 — this address is already registered. Not a failure for the person
   *  it belongs to, so it is not drawn as one. */
  | { kind: "already" }
  /** 403 — the window closed (or was switched off) after the page loaded. */
  | { kind: "closed"; message: string }
  | { kind: "rate-limited"; retryAfter: number | null }
  | { kind: "error"; message: string };

function validateSingleField(field: FieldName, value: string): string | null {
  const result = registrationSchema.shape[field].safeParse(value);
  if (result.success) return null;
  return result.error.issues[0]?.message ?? REGISTRATION_FIELD_COPY[field];
}

export function RegistrationForm({ closesAt }: { closesAt: string | null }) {
  const [values, setValues] = useState<RegistrationInput>(EMPTY);
  const [dirty, setDirty] = useState<Partial<Record<FieldName, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  const formHeadingId = useId();
  const nameId = useId();
  const emailId = useId();
  const phoneId = useId();
  const handleId = useId();

  const alertRef = useRef<HTMLDivElement | null>(null);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldRefs = useRef<Record<FieldName, HTMLInputElement | null>>({
    name: null,
    email: null,
    phone: null,
    discordUsername: null,
  });

  // A failed submit moves focus to the alert, so keyboard and screen-reader
  // users are told what the server said without scrolling back up for it.
  useEffect(() => {
    if (!outcome || outcome.kind === "success") return;
    alertRef.current?.focus();
  }, [outcome]);

  useEffect(() => {
    return () => {
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    };
  }, []);

  const queueAnnouncement = (message: string) => {
    if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    setLiveAnnouncement("");
    // Slight delay lets screen readers announce the newly focused next field
    // first so the blur error does not collide with it.
    announceTimerRef.current = setTimeout(() => {
      setLiveAnnouncement(message);
    }, 400);
  };

  const setField = (field: FieldName, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setDirty((current) => (current[field] ? current : { ...current, [field]: true }));
    // Clear existing errors while typing — never scold mid-keystroke.
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };

  const handleBlur = (field: FieldName) => {
    if (!dirty[field]) return;
    const problem = validateSingleField(field, values[field]);
    if (problem) {
      setErrors((current) => ({ ...current, [field]: problem }));
      queueAnnouncement(`${FIELD_LABELS[field]}: ${problem}`);
    }
  };

  // Positive-only readiness count for the progress badge (never red before submit).
  const fieldValid: Record<FieldName, boolean> = {
    name:
      values.name.trim() !== "" &&
      validateSingleField("name", values.name) === null,
    email:
      values.email.trim() !== "" &&
      validateSingleField("email", values.email) === null,
    phone:
      values.phone.trim() !== "" &&
      validateSingleField("phone", values.phone) === null,
    discordUsername:
      values.discordUsername.trim() !== "" &&
      validateSingleField("discordUsername", values.discordUsername) === null,
  };

  const readyCount = FIELD_ORDER.filter((field) => fieldValid[field]).length;

  const normalizedPhone = normalizeBdPhone(values.phone);
  const showPhoneNormalized =
    fieldValid.phone &&
    BD_MOBILE_REGEX.test(normalizedPhone) &&
    normalizedPhone !== values.phone.trim();

  const normalizedHandle = normalizeDiscordUsername(values.discordUsername);
  const showHandleNormalized =
    fieldValid.discordUsername &&
    DISCORD_USERNAME_REGEX.test(normalizedHandle) &&
    normalizedHandle !== values.discordUsername.trim();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const parsed = registrationSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<FieldName, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FieldName;
        next[field] ??= issue.message;
      }
      setErrors(next);
      setDirty({ name: true, email: true, phone: true, discordUsername: true });

      const firstInvalid = FIELD_ORDER.find((field) => Boolean(next[field]));
      if (firstInvalid) {
        fieldRefs.current[firstInvalid]?.focus();
      }
      return;
    }

    if (!API_BASE) {
      setOutcome({
        kind: "error",
        message:
          "This form is not configured to reach the server. Please tell an organiser.",
      });
      return;
    }

    setSubmitting(true);
    setOutcome(null);

    try {
      const response = await fetch(`${API_BASE}/registration/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The normalized values — what the server will store.
        body: JSON.stringify(parsed.data),
      });

      if (response.status === 201) {
        const json =
          (await response.json()) as ApiResponse<SubmitRegistrationPayload>;
        setOutcome({
          kind: "success",
          payload: json.data,
          discordUsername: parsed.data.discordUsername,
        });
        return;
      }

      if (response.status === 429) {
        const reset = Number(response.headers.get("RateLimit-Reset"));
        // No auto-retry: the per-IP budget is the whole budget, and the typed
        // values stay on screen so nothing has to be entered again.
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

      if (response.status === 409) {
        setOutcome({ kind: "already" });
        return;
      }

      if (response.status === 403) {
        setOutcome({
          kind: "closed",
          message:
            body?.message ?? "Registration is not accepting submissions.",
        });
        return;
      }

      if (response.status === 400 && body?.errorDetails?.issues?.length) {
        // Map the server's issues onto fields using our own copy — its
        // messages arrive Title Cased Word By Word and read wrong here.
        const next: Partial<Record<FieldName, string>> = {};
        for (const issue of body.errorDetails.issues) {
          const field = (issue.path.charAt(0).toLowerCase() +
            issue.path.slice(1)) as FieldName;
          if (field in EMPTY) next[field] ??= REGISTRATION_FIELD_COPY[field];
        }
        setErrors(next);
        const firstInvalid = FIELD_ORDER.find((field) => Boolean(next[field]));
        if (firstInvalid) {
          fieldRefs.current[firstInvalid]?.focus();
        } else {
          setOutcome({
            kind: "error",
            message: "Please check what you entered and try again.",
          });
        }
        return;
      }

      setOutcome({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
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
        payload={outcome.payload}
        discordUsername={outcome.discordUsername}
      />
    );
  }

  const nameHintId = `${nameId}-hint`;
  const nameErrorId = `${nameId}-error`;
  const emailHintId = `${emailId}-hint`;
  const emailErrorId = `${emailId}-error`;
  const phoneHintId = `${phoneId}-hint`;
  const phoneErrorId = `${phoneId}-error`;
  const handleHintId = `${handleId}-hint`;
  const handleErrorId = `${handleId}-error`;

  return (
    <Card accent="yellow" className="gap-5 py-5 sm:py-6">
      <CardHeader className="border-border-muted border-b px-4 pb-4 sm:px-6">
        <div className="flex flex-col gap-1">
          <CardTitle>
            <h2 id={formHeadingId} className="text-xl">
              Enrolment form
            </h2>
          </CardTitle>
          <CardDescription>
            All four fields are required.
            {closesAt ? ` Closes ${formatDhaka(closesAt)} (Dhaka).` : ""}
          </CardDescription>
        </div>

        <CardAction>
          <Badge
            variant={readyCount === 4 ? "success" : "outline"}
            className="font-mono text-[11px]"
          >
            {readyCount === 4 ? (
              <Check aria-hidden="true" className="size-3" />
            ) : null}
            {readyCount}/4 ready
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="px-4 sm:px-6">
        <form
          onSubmit={submit}
          noValidate
          aria-labelledby={formHeadingId}
          className="public-form"
        >
          {/* Single polite live region for blur validation announcements. */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {liveAnnouncement}
          </div>

          <FieldGroup>
            {/* One focusable slot for whichever server outcome is showing. */}
            <div ref={alertRef} tabIndex={-1} className="focus:outline-none">
              {outcome?.kind === "already" ? (
                <Alert variant="success">
                  <CheckCircle2 aria-hidden="true" />
                  <AlertTitle>Already registered</AlertTitle>
                  <AlertDescription className="flex flex-col gap-2">
                    <span>
                      This email address is already registered — you do not need
                      to sign up again. Check your inbox (and spam folder) for
                      the welcome email with your Discord invite.
                    </span>
                    <Link
                      href="/"
                      className="text-foreground inline-flex w-fit items-center gap-1 font-semibold underline decoration-2 underline-offset-4"
                    >
                      <span>Go to Daily Attendance</span>
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </AlertDescription>
                </Alert>
              ) : null}

              {outcome?.kind === "closed" ? (
                <Alert variant="destructive" className="text-status-error">
                  <Clock aria-hidden="true" />
                  <AlertTitle>Registration is not open</AlertTitle>
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
                      ? `about ${Math.ceil(outcome.retryAfter / 60)} minute${Math.ceil(outcome.retryAfter / 60) === 1 ? "" : "s"}`
                      : "a few minutes"}{" "}
                    and try again. Everything you typed is still here.
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

            {/* 1. Full name */}
            <Field data-invalid={errors.name ? true : undefined}>
              <FieldLabel htmlFor={nameId} className="text-foreground font-semibold">
                Full name{" "}
                <span aria-hidden="true" className="text-status-error">
                  *
                </span>
              </FieldLabel>
              <FieldDescription id={nameHintId} className="text-xs">
                Your name as it should appear on the cohort roster.
              </FieldDescription>
              <InputGroup>
                <InputGroupAddon align="inline-start" className="pl-3">
                  <User aria-hidden="true" className="size-4" />
                </InputGroupAddon>
                <InputGroupInput
                  ref={(node) => {
                    fieldRefs.current.name = node;
                  }}
                  id={nameId}
                  name="name"
                  type="text"
                  autoComplete="name"
                  enterKeyHint="next"
                  minLength={2}
                  maxLength={150}
                  placeholder="e.g. Rakibul Hasan"
                  value={values.name}
                  onChange={(event) => setField("name", event.target.value)}
                  onBlur={() => handleBlur("name")}
                  aria-invalid={errors.name ? true : false}
                  aria-describedby={
                    errors.name ? `${nameHintId} ${nameErrorId}` : nameHintId
                  }
                  required
                />
                {fieldValid.name && !errors.name ? (
                  <InputGroupAddon align="inline-end" className="pr-3">
                    <CheckCircle2
                      aria-hidden="true"
                      className="text-status-success size-4"
                    />
                  </InputGroupAddon>
                ) : null}
              </InputGroup>
              {errors.name ? (
                <p
                  id={nameErrorId}
                  className="text-status-error flex items-start gap-1.5 text-sm font-medium"
                >
                  <CircleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>{errors.name}</span>
                </p>
              ) : null}
            </Field>

            {/* 2. Email address */}
            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor={emailId} className="text-foreground font-semibold">
                Email address{" "}
                <span aria-hidden="true" className="text-status-error">
                  *
                </span>
              </FieldLabel>
              <FieldDescription id={emailHintId} className="text-xs">
                Your welcome email and Discord invite go here — you will use
                this same address for daily attendance.
              </FieldDescription>
              <InputGroup>
                <InputGroupAddon align="inline-start" className="pl-3">
                  <Mail aria-hidden="true" className="size-4" />
                </InputGroupAddon>
                <InputGroupInput
                  ref={(node) => {
                    fieldRefs.current.email = node;
                  }}
                  id={emailId}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  placeholder="you@example.com"
                  value={values.email}
                  onChange={(event) => setField("email", event.target.value)}
                  onBlur={() => handleBlur("email")}
                  aria-invalid={errors.email ? true : false}
                  aria-describedby={
                    errors.email
                      ? `${emailHintId} ${emailErrorId}`
                      : emailHintId
                  }
                  required
                />
                {fieldValid.email && !errors.email ? (
                  <InputGroupAddon align="inline-end" className="pr-3">
                    <CheckCircle2
                      aria-hidden="true"
                      className="text-status-success size-4"
                    />
                  </InputGroupAddon>
                ) : null}
              </InputGroup>
              {errors.email ? (
                <p
                  id={emailErrorId}
                  className="text-status-error flex items-start gap-1.5 text-sm font-medium"
                >
                  <CircleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>{errors.email}</span>
                </p>
              ) : null}
            </Field>

            {/* 3. Phone number */}
            <Field data-invalid={errors.phone ? true : undefined}>
              <FieldLabel htmlFor={phoneId} className="text-foreground font-semibold">
                Phone number{" "}
                <span aria-hidden="true" className="text-status-error">
                  *
                </span>
              </FieldLabel>
              <FieldDescription id={phoneHintId} className="text-xs">
                Bangladeshi mobile number (
                <code className="text-foreground font-mono">01712345678</code> or{" "}
                <code className="text-foreground font-mono">+8801712345678</code>
                ).
              </FieldDescription>
              <InputGroup>
                <InputGroupAddon align="inline-start" className="pl-3">
                  <Phone aria-hidden="true" className="size-4" />
                </InputGroupAddon>
                <InputGroupInput
                  ref={(node) => {
                    fieldRefs.current.phone = node;
                  }}
                  id={phoneId}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  enterKeyHint="next"
                  maxLength={40}
                  placeholder="01712345678"
                  value={values.phone}
                  onChange={(event) => setField("phone", event.target.value)}
                  onBlur={() => handleBlur("phone")}
                  aria-invalid={errors.phone ? true : false}
                  aria-describedby={
                    errors.phone
                      ? `${phoneHintId} ${phoneErrorId}`
                      : phoneHintId
                  }
                  required
                />
                {fieldValid.phone && !errors.phone ? (
                  <InputGroupAddon align="inline-end" className="pr-3">
                    <CheckCircle2
                      aria-hidden="true"
                      className="text-status-success size-4"
                    />
                  </InputGroupAddon>
                ) : null}
              </InputGroup>
              {showPhoneNormalized && !errors.phone ? (
                <p className="text-status-success flex items-center gap-1.5 font-mono text-xs font-medium">
                  <Check aria-hidden="true" className="size-3.5 shrink-0" />
                  <span>Will be saved as {normalizedPhone}</span>
                </p>
              ) : null}
              {errors.phone ? (
                <p
                  id={phoneErrorId}
                  className="text-status-error flex items-start gap-1.5 text-sm font-medium"
                >
                  <CircleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>{errors.phone}</span>
                </p>
              ) : null}
            </Field>

            {/* 4. Discord username */}
            <Field data-invalid={errors.discordUsername ? true : undefined}>
              <FieldLabel htmlFor={handleId} className="text-foreground font-semibold">
                Discord username{" "}
                <span aria-hidden="true" className="text-status-error">
                  *
                </span>
              </FieldLabel>
              <FieldDescription id={handleHintId} className="text-xs">
                The lowercase handle after{" "}
                <code className="text-foreground font-mono">@</code> on your
                Discord profile — not your display name. Your account links
                automatically when you join the server with this username.
              </FieldDescription>
              <InputGroup>
                <InputGroupAddon
                  align="inline-start"
                  className="text-foreground pl-3 font-mono font-bold"
                >
                  <span aria-hidden="true">@</span>
                </InputGroupAddon>
                <InputGroupInput
                  ref={(node) => {
                    fieldRefs.current.discordUsername = node;
                  }}
                  id={handleId}
                  name="discordUsername"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  placeholder="rakib_dev"
                  value={values.discordUsername}
                  onChange={(event) =>
                    setField("discordUsername", event.target.value)
                  }
                  onBlur={() => handleBlur("discordUsername")}
                  aria-invalid={errors.discordUsername ? true : false}
                  aria-describedby={
                    errors.discordUsername
                      ? `${handleHintId} ${handleErrorId}`
                      : handleHintId
                  }
                  required
                />
                {fieldValid.discordUsername && !errors.discordUsername ? (
                  <InputGroupAddon align="inline-end" className="pr-3">
                    <CheckCircle2
                      aria-hidden="true"
                      className="text-status-success size-4"
                    />
                  </InputGroupAddon>
                ) : null}
              </InputGroup>
              {showHandleNormalized && !errors.discordUsername ? (
                <p className="text-status-success flex items-center gap-1.5 font-mono text-xs font-medium">
                  <Check aria-hidden="true" className="size-3.5 shrink-0" />
                  <span>Will register as @{normalizedHandle}</span>
                </p>
              ) : null}
              {errors.discordUsername ? (
                <p
                  id={handleErrorId}
                  className="text-status-error flex items-start gap-1.5 text-sm font-medium"
                >
                  <CircleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>{errors.discordUsername}</span>
                </p>
              ) : null}

              <DiscordUsernameGuide className="mt-1" />
            </Field>

            <Field className="pt-1">
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="w-full"
              >
                {submitting ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Send data-icon="inline-start" aria-hidden="true" />
                )}
                {submitting ? "Submitting registration…" : "Complete Registration"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function SuccessCard({
  payload,
  discordUsername,
}: {
  payload: SubmitRegistrationPayload;
  discordUsername: string;
}) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Registration Received · Discord Manager";
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
            REGISTERED
          </Badge>
        </div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-heading mt-1 text-2xl font-bold tracking-tight focus:outline-none"
        >
          You&apos;re in, {payload.name}!
        </h2>
        <CardDescription>
          Your registration has been recorded on our cohort roll.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 px-4 text-sm sm:px-6">
        {/* Submitted identity receipt */}
        <dl className="border-foreground bg-muted/50 grid gap-3 rounded-xl border-2 p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground font-mono text-[11px] uppercase">
              Registered email
            </dt>
            <dd className="font-medium break-all">{payload.email}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground font-mono text-[11px] uppercase">
              Discord username
            </dt>
            <dd className="font-mono font-bold">@{discordUsername}</dd>
          </div>
        </dl>

        {payload.welcomeEmail ? (
          <div className="border-border-sage bg-success/15 flex items-start gap-3 rounded-xl border-2 p-4 shadow-[2px_2px_0_0_var(--border-sage)]">
            <MailCheck
              aria-hidden="true"
              className="text-status-success mt-0.5 size-5 shrink-0"
            />
            <div className="flex flex-col gap-1">
              <p className="font-heading font-bold">
                Welcome email is on its way
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We&apos;ve sent your Discord server invite and next steps to{" "}
                <strong className="text-foreground">{payload.email}</strong>. It
                can take a few minutes — check your spam or promotions folder if
                you don&apos;t see it.
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2.5">
          <h3 className="font-heading text-sm font-bold">What happens next</h3>
          <ol className="flex flex-col gap-2 text-sm">
            <li className="flex items-start gap-2.5">
              <span className="bg-highlight text-highlight-foreground border-foreground mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border font-mono text-[11px] font-bold">
                1
              </span>
              <span className="text-muted-foreground">
                Open your welcome email and join the Discord server using{" "}
                <code className="text-foreground font-mono font-semibold">
                  @{discordUsername}
                </code>
                .
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="bg-border-lilac text-[#2D2B32] border-foreground mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border font-mono text-[11px] font-bold">
                2
              </span>
              <span className="text-muted-foreground">
                Our bot automatically links your Discord account to your
                enrolment once you join.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="bg-border-sage text-[#2D2B32] border-foreground mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border font-mono text-[11px] font-bold">
                3
              </span>
              <span className="text-muted-foreground">
                Return here during the daily window using the same email and
                Discord username to submit attendance.
              </span>
            </li>
          </ol>
        </div>

        <div className="border-border-muted flex flex-wrap items-center gap-3 border-t pt-4">
          <Button asChild size="default">
            <Link href="/">
              Go to Daily Attendance
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
