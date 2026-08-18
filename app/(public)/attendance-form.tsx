"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useId, useState } from "react";

import { DiscordHandleField } from "./discord-handle-field";
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
  | { kind: "already"; message: string }
  | { kind: "not-member" }
  | { kind: "rate-limited"; retryAfter: number | null }
  | { kind: "error"; message: string };

type Values = {
  name: string;
  phone: string;
  email: string;
  discordUsername: string;
};

const EMPTY: Values = { name: "", phone: "", email: "", discordUsername: "" };

export function AttendanceForm() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nameId = useId();
  const phoneId = useId();
  const emailId = useId();
  const handleId = useId();

  const setField = (field: keyof Values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  // Deliberately no verification state: the badge is informational and never
  // gates submit, and the write path re-runs every check server-side.
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

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

      // On the write path a 404 is a genuine failure, unlike on verify-user.
      if (response.status === 404) {
        setOutcome({ kind: "not-member" });
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
      <Card>
        <CardHeader>
          <CardTitle className="text-success flex items-center gap-2">
            <CheckCircle2 aria-hidden />
            Attendance recorded
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            আপনার attendance <strong>{formatCivilDate(outcome.payload.attendanceDate)}</strong>{" "}
            তারিখের জন্য জমা হয়েছে।
          </p>
          <p className="text-muted-foreground">
            Recorded for{" "}
            <strong className="text-foreground">
              {outcome.payload.member.displayName ??
                outcome.payload.member.discordUsername}
            </strong>{" "}
            ({outcome.payload.member.discordUsername}) at{" "}
            {formatDhaka(outcome.payload.submittedAt, "time")}.
          </p>
          {/*
            One submission covers every server the handle belongs to, in one
            transaction — the student is never asked to pick one. Naming the
            servers is the only way they can tell that happened.
          */}
          {(outcome.payload.servers?.length ?? 0) > 1 ? (
            <p className="text-muted-foreground">
              এটি{" "}
              <strong className="text-foreground">
                {outcome.payload.servers
                  ?.filter((server) => server.recorded)
                  .map((server) => server.label)
                  .join(", ")}
              </strong>{" "}
              — সবগুলো সার্ভারের জন্যই রেকর্ড হয়েছে। আলাদা করে আর জমা দিতে হবে না।
            </p>
          ) : null}
          <p className="text-muted-foreground">
            আজকের জন্য আর কিছু করার নেই। ভুলবেন না — <code>#daily-update</code>{" "}
            চ্যানেলে আপনার আপডেটটিও পোস্ট করতে হবে। একটি সার্ভারে পোস্ট করলেই
            সবগুলোর জন্য গণ্য হবে।
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Attendance</CardTitle>
        <CardDescription>
          দিনে একবারই জমা দিতে হবে। সব ঘর পূরণ করা বাধ্যতামূলক।
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            {outcome?.kind === "already" ? (
              <Alert variant="success">
                <AlertTitle>Already recorded</AlertTitle>
                <AlertDescription>
                  {outcome.message} আপনার attendance ইতোমধ্যেই আছে — নতুন করে
                  কিছু করার দরকার নেই।
                </AlertDescription>
              </Alert>
            ) : null}

            {outcome?.kind === "not-member" ? (
              <Alert variant="destructive">
                <AlertTitle>You are not in the Discord server</AlertTitle>
                <AlertDescription>
                  এই Discord Username-টি আমাদের সার্ভারে নেই (অথবা আপনি সার্ভার
                  ছেড়ে গেছেন)। আগে সার্ভারে জয়েন করুন, তারপর আবার চেষ্টা করুন।
                </AlertDescription>
              </Alert>
            ) : null}

            {outcome?.kind === "rate-limited" ? (
              <Alert variant="warning">
                <AlertTitle>Too many attempts</AlertTitle>
                <AlertDescription>
                  অনেকবার চেষ্টা করা হয়েছে।{" "}
                  {outcome.retryAfter
                    ? `প্রায় ${outcome.retryAfter} সেকেন্ড পর আবার চেষ্টা করুন।`
                    : "কিছুক্ষণ পর আবার চেষ্টা করুন।"}{" "}
                  আপনার লেখা তথ্যগুলো মুছে যায়নি।
                </AlertDescription>
              </Alert>
            ) : null}

            {outcome?.kind === "error" ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{outcome.message}</AlertDescription>
              </Alert>
            ) : null}

            <Field data-invalid={errors.name ? true : undefined}>
              <FieldLabel htmlFor={nameId}>
                Full Name <span aria-hidden>*</span>
              </FieldLabel>
              <Input
                id={nameId}
                name="name"
                value={values.name}
                onChange={(event) => setField("name", event.target.value)}
                required
                autoComplete="name"
                autoCapitalize="words"
                spellCheck={false}
                // The rule is English-only, so the keyboard hint and the copy
                // below both have to point that way before anything is typed.
                inputMode="text"
                lang="en"
                placeholder="Rakibul Hasan"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={`${nameId}-hint`}
              />
              <FieldDescription id={`${nameId}-hint`}>
                {errors.name ??
                  "আপনার পূর্ণ নাম ইংরেজি অক্ষরে লিখুন (English letters only) — যেমন Rakibul Hasan।"}
              </FieldDescription>
            </Field>

            <Field data-invalid={errors.phone ? true : undefined}>
              <FieldLabel htmlFor={phoneId}>
                Phone Number <span aria-hidden>*</span>
              </FieldLabel>
              <Input
                id={phoneId}
                name="phone"
                type="tel"
                value={values.phone}
                onChange={(event) => setField("phone", event.target.value)}
                required
                // Numeric keypad on mobile.
                inputMode="tel"
                autoComplete="tel"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="01711000000"
                aria-invalid={errors.phone ? true : undefined}
                aria-describedby={`${phoneId}-hint`}
              />
              {/* The format hint is visible before any error, not only after. */}
              <FieldDescription id={`${phoneId}-hint`}>
                {errors.phone ??
                  "যেমন 01711000000। +880 বা 880 দিয়ে শুরু করলেও চলবে।"}
              </FieldDescription>
            </Field>

            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor={emailId}>
                Email <span aria-hidden>*</span>
              </FieldLabel>
              <Input
                id={emailId}
                name="email"
                type="email"
                value={values.email}
                onChange={(event) => setField("email", event.target.value)}
                required
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="you@example.com"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={`${emailId}-hint`}
              />
              <FieldDescription id={`${emailId}-hint`}>
                {errors.email ?? "একটি সচল ইমেইল ঠিকানা।"}
              </FieldDescription>
            </Field>

            <DiscordHandleField
              fieldId={handleId}
              value={values.discordUsername}
              onChange={(value) => setField("discordUsername", value)}
              error={errors.discordUsername}
            />

            <Field>
              {/*
                Disabled only while a request is in flight. Never disabled
                because verification failed — a network blip must not lock a
                legitimate student out, and the write path re-checks everything
                anyway.
              */}
              <Button type="submit" size="lg" disabled={submitting}>
                {submitting ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Send data-icon="inline-start" />
                )}
                {submitting ? "জমা দেওয়া হচ্ছে…" : "Attendance জমা দিন"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
