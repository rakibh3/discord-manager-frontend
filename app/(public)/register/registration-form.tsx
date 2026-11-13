"use client";

import { CheckCircle2, MailCheck, Send } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { ApiResponse, SubmitRegistrationPayload } from "@/lib/api/types";
import { formatDhaka } from "@/lib/dhaka-date";
import {
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

const EMPTY: RegistrationInput = {
  name: "",
  email: "",
  phone: "",
  discordUsername: "",
};

type Outcome =
  | { kind: "success"; payload: SubmitRegistrationPayload }
  /** 409 — this address is already registered. Not a failure for the person
   *  it belongs to, so it is not drawn as one. */
  | { kind: "already" }
  /** 403 — the window closed (or was switched off) after the page loaded. */
  | { kind: "closed"; message: string }
  | { kind: "rate-limited"; retryAfter: number | null }
  | { kind: "error"; message: string };

export function RegistrationForm({ closesAt }: { closesAt: string | null }) {
  const [values, setValues] = useState<RegistrationInput>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nameId = useId();
  const emailId = useId();
  const phoneId = useId();
  const handleId = useId();

  // A failed submit moves focus to the alert, so keyboard and screen-reader
  // users are told what the server said without scrolling back up for it.
  const alertRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!outcome || outcome.kind === "success") return;
    alertRef.current?.focus();
  }, [outcome]);

  const setField = (field: FieldName, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

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
        setOutcome({ kind: "success", payload: json.data });
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
        if (Object.keys(next).length === 0) {
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
    return <SuccessCard payload={outcome.payload} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register</CardTitle>
        <CardDescription>
          All four fields are required.
          {closesAt ? ` Registration closes ${formatDhaka(closesAt)}.` : ""}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            {/* One focusable slot for whichever outcome is showing. */}
            <div ref={alertRef} tabIndex={-1} className="focus:outline-none">
              {outcome?.kind === "already" ? (
                <Alert variant="success">
                  <AlertTitle>Already registered</AlertTitle>
                  <AlertDescription>
                    This email address is already registered — you do not need
                    to register again. Check your inbox (and spam folder) for
                    the welcome email.
                  </AlertDescription>
                </Alert>
              ) : null}

              {outcome?.kind === "closed" ? (
                <Alert variant="destructive">
                  <AlertTitle>Registration is not open</AlertTitle>
                  <AlertDescription>{outcome.message}</AlertDescription>
                </Alert>
              ) : null}

              {outcome?.kind === "rate-limited" ? (
                <Alert variant="destructive">
                  <AlertTitle>Too many attempts</AlertTitle>
                  <AlertDescription>
                    Please wait{" "}
                    {outcome.retryAfter
                      ? `about ${Math.ceil(outcome.retryAfter / 60)} minute${Math.ceil(outcome.retryAfter / 60) === 1 ? "" : "s"}`
                      : "a few minutes"}{" "}
                    and try again. What you typed is still here.
                  </AlertDescription>
                </Alert>
              ) : null}

              {outcome?.kind === "error" ? (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{outcome.message}</AlertDescription>
                </Alert>
              ) : null}
            </div>

            <Field data-invalid={errors.name ? true : undefined}>
              <FieldLabel htmlFor={nameId}>Full name</FieldLabel>
              <Input
                id={nameId}
                name="name"
                autoComplete="name"
                value={values.name}
                onChange={(event) => setField("name", event.target.value)}
                aria-invalid={errors.name ? true : undefined}
                required
              />
              {errors.name ? <FieldError>{errors.name}</FieldError> : null}
            </Field>

            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor={emailId}>Email address</FieldLabel>
              <Input
                id={emailId}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={values.email}
                onChange={(event) => setField("email", event.target.value)}
                aria-invalid={errors.email ? true : undefined}
                required
              />
              <FieldDescription>
                The welcome email goes here, and you will use this same address
                for daily attendance.
              </FieldDescription>
              {errors.email ? <FieldError>{errors.email}</FieldError> : null}
            </Field>

            <Field data-invalid={errors.phone ? true : undefined}>
              <FieldLabel htmlFor={phoneId}>Phone number</FieldLabel>
              <Input
                id={phoneId}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="01712345678"
                value={values.phone}
                onChange={(event) => setField("phone", event.target.value)}
                aria-invalid={errors.phone ? true : undefined}
                required
              />
              {errors.phone ? <FieldError>{errors.phone}</FieldError> : null}
            </Field>

            <Field data-invalid={errors.discordUsername ? true : undefined}>
              <FieldLabel htmlFor={handleId}>Discord username</FieldLabel>
              <Input
                id={handleId}
                name="discordUsername"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="your_username"
                value={values.discordUsername}
                onChange={(event) =>
                  setField("discordUsername", event.target.value)
                }
                aria-invalid={errors.discordUsername ? true : undefined}
                required
              />
              <FieldDescription>
                The name under the @ on your Discord profile, not your display
                name.
              </FieldDescription>
              {errors.discordUsername ? (
                <FieldError>{errors.discordUsername}</FieldError>
              ) : null}
            </Field>

            <Field>
              <Button type="submit" size="lg" disabled={submitting}>
                {submitting ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Send data-icon="inline-start" />
                )}
                {submitting ? "Submitting…" : "Register"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function SuccessCard({ payload }: { payload: SubmitRegistrationPayload }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-success flex items-center gap-2">
          <CheckCircle2 aria-hidden />
          Registration received
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>
          Thank you, <strong>{payload.name}</strong>. You are registered with{" "}
          <strong>{payload.email}</strong>.
        </p>

        {payload.welcomeEmail ? (
          <p className="bg-muted/60 flex items-start gap-2 rounded-md p-3">
            <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              A welcome email with the next steps is on its way to that
              address. It can take a few minutes — check your spam folder if
              you do not see it.
            </span>
          </p>
        ) : null}

        <p className="text-muted-foreground">
          Use the same email address and Discord username when you submit your
          daily attendance.
        </p>
      </CardContent>
    </Card>
  );
}
