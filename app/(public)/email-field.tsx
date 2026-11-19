"use client";

import { CheckCircle2, CircleAlert, Loader2, Mail } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import type {
  ApiResponse,
  VerifyEmailPayload,
} from "@/lib/api/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/** 500 ms keeps a typing student well inside the 60-requests-per-minute budget. */
const DEBOUNCE_MS = 500;

/** The same regex `z.email` uses; pre-flighting here spares a request that the
 *  backend would reject with a 400. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (raw: string) => raw.trim().toLowerCase();

export type EmailBadge =
  | { kind: "idle" | "checking" | "malformed" | "gate-off" }
  | { kind: "verified"; message: string }
  | { kind: "not-enrolled"; message: string }
  | { kind: "error"; retryAfter: number | null };

/** Whether the live badge allows submission right now. Email verification mirrors
 *  Discord handle verification: only a `verified` badge unblocks submit. A
 *  malformed, unknown, erroring, or still-`checking` email blocks submit until
 *  it resolves. When the gate is off, every well-formed address is `verified`. */
export function isEmailVerified(badge: EmailBadge): boolean {
  return badge.kind === "verified" || badge.kind === "gate-off";
}

/**
 * Live email verification against the enrolment roster. Mirrors `DiscordHandleField`:
 * 500 ms debounce, aborts stale requests, branches on `data.verified` (never the
 * HTTP status — `/verify-email` answers 200 even when the address is unknown).
 *
 * Verification is a UI affordance, not a gate. The write path (`/attendance/submit`)
 * re-runs the check server-side, so a network blip here never locks a student out.
 */
export function EmailField({
  value,
  onChange,
  error,
  fieldId,
  onVerifiedChange,
  onBadgeKindChange,
  inputRef,
  /** When the roster gate is OFF (the default), the badge never renders and a
   *  well-formed address is treated as verified for gating purposes. Read on
   *  mount from `/attendance/window`'s `emailVerificationRequired` field. */
  emailVerificationRequired = true,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  fieldId: string;
  onVerifiedChange?: (verified: boolean) => void;
  onBadgeKindChange?: (kind: EmailBadge["kind"]) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  emailVerificationRequired?: boolean;
}) {
  const abortRef = useRef<AbortController | null>(null);

  // Only the asynchronous verdict is state, tagged with the email it belongs to;
  // everything decidable synchronously is derived during render.
  const [remote, setRemote] = useState<{
    address: string;
    badge: EmailBadge;
  } | null>(null);

  const address = normalizeEmail(value);
  const malformed = address !== "" && !EMAIL_REGEX.test(address);

  // When the gate is OFF, we never verify and every well-formed address is
  // treated as `verified` for gating purposes. The badge sits in a `gate-off`
  // state so the UI shows nothing rather than a misleading "enrolled" check.
  const gateOff = !emailVerificationRequired;

  // `useMemo` keeps the badge referentially stable across renders that don't
  // change inputs, so the parent `useEffect` that reports the verdict only
  // fires when the verdict actually changes.
  const badge: EmailBadge = useMemo(
    () =>
      gateOff
        ? { kind: "gate-off" }
        : address === ""
          ? { kind: "idle" }
          : malformed
            ? { kind: "malformed" }
            : !API_BASE
              ? { kind: "error", retryAfter: null }
              : remote?.address === address
                ? remote.badge
                : { kind: "checking" },
    [address, malformed, remote, gateOff],
  );

  useEffect(() => {
    if (gateOff || address === "" || malformed || !API_BASE) {
      return;
    }

    const timer = setTimeout(async () => {
      // Abort whatever is still in flight, so a slow answer for an earlier
      // address can never overwrite the verdict for the current one.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const settle = (next: EmailBadge) =>
        setRemote({ address, badge: next });

      try {
        const response = await fetch(
          `${API_BASE}/attendance/verify-email?email=${encodeURIComponent(address)}`,
          { signal: controller.signal, cache: "no-store" },
        );

        if (response.status === 429) {
          const reset = Number(response.headers.get("RateLimit-Reset"));
          settle({
            kind: "error",
            retryAfter: Number.isFinite(reset) && reset > 0 ? reset : null,
          });
          return;
        }

        // 400 is Zod rejecting the email's shape — distinct from an address that
        // is simply not enrolled.
        if (response.status === 400) {
          settle({ kind: "malformed" });
          return;
        }

        const json = (await response.json()) as ApiResponse<VerifyEmailPayload>;

        // Branch on the payload, never the status.
        if (!json.data?.verified) {
          // The backend's own copy doubles as the form's copy: the student sees
          // the same sentence here that they would see at submit time, so they
          // learn the rule before the form rejects them.
          settle({
            kind: "not-enrolled",
            message: json.message ?? "This email is not on the enrolled list.",
          });
          return;
        }

        settle({ kind: "verified", message: json.message ?? "Enrolled email" });
      } catch (cause) {
        if ((cause as Error).name === "AbortError") return;
        settle({ kind: "error", retryAfter: null });
      }
    }, DEBOUNCE_MS);

    // Cancel the pending debounce and abort any in-flight request on every
    // keystroke and on unmount.
    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
    // Keyed on the *normalized* address, so retyping the same address with
    // different casing or padding does not spend another request.
  }, [address, malformed, gateOff]);

  // Report the verdict to the parent so it can gate submit.
  useEffect(() => {
    onVerifiedChange?.(isEmailVerified(badge));
    onBadgeKindChange?.(badge.kind);
  }, [badge, onVerifiedChange, onBadgeKindChange]);

  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const statusId = `${fieldId}-status`;
  // Skip the badge entirely when the gate is OFF — there is nothing to verify
  // and a verified pill on every address would mislead a student into thinking
  // any address is enrolled.
  const showBadge = badge.kind !== "idle" && badge.kind !== "gate-off";
  const isInvalid = Boolean(
    error ||
      (showBadge &&
        (badge.kind === "malformed" || badge.kind === "not-enrolled")),
  );

  const describedBy = [
    hintId,
    error ? errorId : null,
    showBadge ? statusId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Field data-invalid={isInvalid ? true : undefined}>
      <FieldLabel htmlFor={fieldId} className="text-foreground font-semibold">
        Email address{" "}
        <span aria-hidden="true" className="text-status-error">
          *
        </span>
        {emailVerificationRequired ? (
          <span className="text-muted-foreground font-mono text-[11px] font-normal">
            (Enrolled email)
          </span>
        ) : null}
      </FieldLabel>

      {/* Placed above the input so browser autocomplete popovers never cover it */}
      <FieldDescription id={hintId} className="text-xs">
        {emailVerificationRequired
          ? "Use the email address you registered with during enrolment."
          : "Enter your email address for today's check-in."}
      </FieldDescription>

      <InputGroup>
        <InputGroupAddon align="inline-start" className="pl-3">
          <Mail aria-hidden="true" className="size-4" />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          id={fieldId}
          name="email"
          type="email"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          placeholder="you@example.com"
          aria-invalid={isInvalid ? true : false}
          aria-describedby={describedBy}
        />
        {showBadge ? (
          <InputGroupAddon align="inline-end" className="pr-3">
            {badge.kind === "checking" ? (
              <Loader2
                aria-hidden="true"
                className="text-muted-foreground size-4 animate-spin"
              />
            ) : badge.kind === "verified" ? (
              <CheckCircle2
                aria-hidden="true"
                className="text-status-success size-4"
              />
            ) : badge.kind === "malformed" || badge.kind === "not-enrolled" ? (
              <CircleAlert
                aria-hidden="true"
                className="text-status-error size-4"
              />
            ) : null}
          </InputGroupAddon>
        ) : null}
      </InputGroup>

      {/* Error sits directly under the input so a server-side rejection stays
          anchored to the field. */}
      {error ? (
        <p
          id={errorId}
          className="text-status-error flex items-start gap-1.5 text-sm font-medium"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}

      {showBadge ? (
        <div
          id={statusId}
          role={badge.kind === "checking" ? undefined : "status"}
          aria-live={badge.kind === "checking" ? "off" : "polite"}
          className="text-sm"
        >
          {badge.kind === "checking" ? (
            <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
              <Loader2 aria-hidden="true" className="size-3.5 shrink-0 animate-spin" />
              <span>Checking enrolment roster…</span>
            </p>
          ) : null}

          {badge.kind === "malformed" ? (
            <p className="text-status-error flex items-start gap-1.5 text-xs font-medium">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Enter a valid email address — like{" "}
                <code className="font-mono">you@example.com</code>.
              </span>
            </p>
          ) : null}

          {badge.kind === "not-enrolled" ? (
            <p className="border-border-coral bg-destructive/10 text-status-error flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-medium">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{badge.message}</span>
            </p>
          ) : null}

          {badge.kind === "verified" ? (
            <p className="border-border-sage bg-success/15 text-status-success flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold">
              <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
              <span>{badge.message}</span>
            </p>
          ) : null}

          {badge.kind === "error" ? (
            <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Can&apos;t verify right now
                {badge.retryAfter
                  ? ` — try again in about ${badge.retryAfter} seconds`
                  : ""}
                . You can still submit the form.
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </Field>
  );
}
