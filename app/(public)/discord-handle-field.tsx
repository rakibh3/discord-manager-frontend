"use client";

import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ApiResponse, VerifyUserPayload } from "@/lib/api/types";
import {
  DISCORD_USERNAME_REGEX,
  normalizeDiscordUsername,
} from "@/lib/validation/attendance";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/** 500 ms keeps a typing student well inside the 60-requests-per-minute budget. */
const DEBOUNCE_MS = 500;

export type HandleBadge =
  | { kind: "idle" | "checking" | "malformed" }
  | { kind: "verified"; payload: VerifyUserPayload }
  | { kind: "unknown" }
  | { kind: "duplicate"; date: string }
  | { kind: "error"; retryAfter: number | null };

/** Whether the live badge says the handle is good for submission right now. A
 *  `duplicate` handle is *not* included here — it represents a submission that
 *  has already been recorded for today, so a second click would only 409 with
 *  no useful work. The form uses a separate signal (`onAlreadySubmittedChange`)
 *  to disable the button and explain why, while the badge itself still surfaces
 *  the green "already submitted" message. A network error, an `unknown` handle,
 *  or a still-`checking` state are not verified either. */
export function isHandleVerified(badge: HandleBadge): boolean {
  return badge.kind === "verified";
}

/** Servers this handle belongs to that still have no row for today.
 *
 *  ⚠️ The top-level `alreadySubmitted` is true only when **every** server has
 *  today's row, so a student in two servers who submitted through one is *not*
 *  done — telling them otherwise would leave the other server short. */
function pendingServers(payload: VerifyUserPayload) {
  return (payload.servers ?? []).filter((server) => !server.alreadySubmitted);
}

/** Live Discord username verification, called browser-direct to avoid doubling
 *  the latency. Answers 200 either way.
 *
 *  Reports the live verdict to the parent via `onVerifiedChange(boolean)` so a
 *  gating submit button can disable itself when the handle is still being
 *  checked, is unknown, or has not been entered yet.
 *
 *  When `email` is supplied, it is forwarded to `/verify-user` so the
 *  duplicate check is **pairing-aware** — only attendance rows whose member
 *  belongs to the paired account count as a duplicate for this email+handle
 *  combination. The form passes its typed email so the "already submitted"
 *  badge matches the email the student actually typed. Without it, the prior
 *  handle-only behaviour applies (any prior row counts as a duplicate). */
export function DiscordHandleField({
  value,
  email,
  onChange,
  error,
  fieldId,
  onVerifiedChange,
  onAlreadySubmittedChange,
}: {
  value: string;
  /** Optional — when present, the duplicate check is pairing-aware. Forwarded
   *  to `/attendance/verify-user?email=…` so the badge tracks the email the
   *  student actually typed, not a stale prior read. */
  email?: string;
  onChange: (value: string) => void;
  error?: string;
  fieldId: string;
  /** Reports the live verdict to the parent so it can gate submit. `true` only
   *  when the handle is a real, fresh, not-yet-submitted member. `false` covers
   *  "not a member", "still checking", and "already submitted" — the
   *  already-submitted case is also surfaced via `onAlreadySubmittedChange` so
   *  the form can disable the button with a precise message instead of a
   *  generic one. */
  onVerifiedChange?: (verified: boolean) => void;
  /** Reports whether the handle is the *already submitted for today* kind
   *  specifically. The form uses this to disable the submit button — a second
   *  click would only 409 with no useful work — while the badge still shows
   *  the green "already submitted" message above. `null` means "no answer
   *  yet", matching the verdict callback's tri-state. */
  onAlreadySubmittedChange?: (alreadySubmitted: boolean | null) => void;
}) {
  const abortRef = useRef<AbortController | null>(null);

  // Only the asynchronous verdict is state, tagged with the handle it belongs
  // to; everything decidable synchronously is derived during render.
  const [remote, setRemote] = useState<{
    handle: string;
    badge: HandleBadge;
  } | null>(null);

  const handle = normalizeDiscordUsername(value);
  // Trimmed + lowercased — the same normalization the form does before submit,
  // and what `/verify-user` and the roster gate operate on.
  const normalizedEmail = email?.trim().toLowerCase() ?? "";

  // The rule must stay exactly as loose as Discord's, or real students are
  // locked out. Catching it here also spares the per-IP rate-limit budget.
  const malformed = handle !== "" && !DISCORD_USERNAME_REGEX.test(handle);

  // `useMemo` keeps the badge referentially stable across renders that don't
  // change inputs, so the parent `useEffect` that reports the verdict only
  // fires when the verdict actually changes.
  const badge: HandleBadge = useMemo(
    () =>
      handle === ""
        ? { kind: "idle" }
        : malformed
          ? { kind: "malformed" }
          : !API_BASE
            ? { kind: "error", retryAfter: null }
            : remote?.handle === handle
              ? remote.badge
              : { kind: "checking" },
    [handle, malformed, remote],
  );

  useEffect(() => {
    if (handle === "" || malformed || !API_BASE) return;

    const timer = setTimeout(async () => {
      // Abort whatever is still in flight, so a slow answer for an earlier
      // handle can never overwrite the verdict for the current one.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Every result is stored against the handle it was requested for, so an
      // out-of-order response for an older handle is simply never displayed.
      const settle = (next: HandleBadge) => setRemote({ handle, badge: next });

      // Build the query string by hand — the verification endpoint accepts
      // an optional `email` for pairing-aware duplicate checks. Forwarding
      // the typed email means the badge reflects this email+handle pair, not
      // a stale handle-only read.
      const params = new URLSearchParams({ username: handle });
      if (normalizedEmail) params.set("email", normalizedEmail);

      try {
        const response = await fetch(
          `${API_BASE}/attendance/verify-user?${params.toString()}`,
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

        // 400 is Zod rejecting the handle's shape — distinct from a handle that
        // is simply not in the server. A malformed email (when supplied) also
        // lands here, and is intentionally folded into the same malformed
        // verdict: the form must distinguish "fix your typing" from "no such
        // handle" but the field-level fix is the same.
        if (response.status === 400) {
          settle({ kind: "malformed" });
          return;
        }

        const json = (await response.json()) as ApiResponse<VerifyUserPayload>;

        // Branch on the payload, never the status.
        if (!json.data?.verified) {
          settle({ kind: "unknown" });
          return;
        }

        settle(
          json.data.alreadySubmitted
            ? { kind: "duplicate", date: json.data.attendanceDate }
            : { kind: "verified", payload: json.data },
        );
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
    // Keyed on the *normalized* handle + email, so retyping either input
    // (or the email being revised by the parent) re-fires the lookup with
    // the new pairing. Without the email in the key, the badge would lag
    // a corrected email by one debounce.
  }, [handle, normalizedEmail, malformed]);

  // Report the verdict to the parent so it can gate submit. This effect runs
  // synchronously (no debounce) — the parent already has the value, and a
  // re-render here wants to flow through immediately.
  useEffect(() => {
    onVerifiedChange?.(isHandleVerified(badge));
  }, [badge, onVerifiedChange]);

  // Report the already-submitted verdict separately. A duplicate handle is the
  // single case where the verdict callback (above) returns `false` but the
  // form should *not* treat it as "not a member" — the button needs to be
  // disabled with a specific message, not a generic "not found" one.
  //   `duplicate` → alreadySubmitted: true  (button off, "already submitted")
  //   anything else with an answer → alreadySubmitted: false
  //   no answer yet (idle / checking / malformed) → alreadySubmitted: null
  useEffect(() => {
    if (!onAlreadySubmittedChange) return;
    const tri = (() => {
      switch (badge.kind) {
        case "duplicate":
          return true;
        case "idle":
        case "checking":
        case "malformed":
          // "No answer yet" — let the form fall back to its own gating logic.
          return null;
        default:
          // verified / unknown / error — handle is either good to submit or
          // already blocked for an unrelated reason. Already-submitted is no.
          return false;
      }
    })();
    onAlreadySubmittedChange(tri);
  }, [badge, onAlreadySubmittedChange]);

  const statusId = `${fieldId}-status`;
  const guidanceId = `${fieldId}-guidance`;
  const member = badge.kind === "verified" ? badge.payload.member : null;

  return (
    <Field data-invalid={error || badge.kind === "malformed" ? true : undefined}>
      <FieldLabel htmlFor={fieldId}>
        Discord Username <span aria-hidden>*</span>
      </FieldLabel>

      <Input
        id={fieldId}
        name="discordUsername"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        // The student's own typing is never rewritten under their cursor —
        // normalization happens on read, not on input.
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        placeholder="rakib_dev"
        aria-invalid={error || badge.kind === "malformed" ? true : undefined}
        aria-describedby={`${statusId} ${guidanceId}`}
      />

      {/*
        Error sits directly under the input — not after the live status text
        below — so a server-side rejection reads as the field's own error and
        stays anchored to the field instead of drifting toward the button.
      */}
      {error ? (
        <FieldDescription className="text-destructive">{error}</FieldDescription>
      ) : null}

      {/* Every asynchronous verdict is announced, not just shown. */}
      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className="flex items-start gap-2 text-sm"
      >
        {badge.kind === "checking" ? (
          <>
            <Loader2 aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin" />
            <span className="text-muted-foreground">Checking…</span>
          </>
        ) : null}

        {badge.kind === "malformed" ? (
          <>
            <CircleAlert aria-hidden className="text-destructive mt-0.5 size-4 shrink-0" />
            <span className="text-destructive">
              Not in the right format. Type the lowercase name after the{" "}
              <code>@</code> in your profile — lowercase letters, digits,{" "}
              <code>_</code>, or <code>.</code> only (no two dots in a row).
            </span>
          </>
        ) : null}

        {badge.kind === "unknown" ? (
          <>
            <CircleAlert aria-hidden className="text-destructive mt-0.5 size-4 shrink-0" />
            <span className="text-destructive">
              This Discord username was not found in our Discord servers. Check
              the spelling, or join the server first.
            </span>
          </>
        ) : null}

        {badge.kind === "duplicate" ? (
          <>
            <CheckCircle2 aria-hidden className="text-success mt-0.5 size-4 shrink-0" />
            <span className="text-success">
              You have already submitted attendance for {badge.date}. Nothing
              more to do.
            </span>
          </>
        ) : null}

        {badge.kind === "verified" && member ? (
          <span className="text-success flex items-start gap-2">
            <Avatar className="size-6">
              {member.avatarUrl ? (
                <AvatarImage src={member.avatarUrl} alt="" />
              ) : null}
              <AvatarFallback className="text-[10px]">
                {member.discordUsername.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="flex flex-col gap-0.5">
              <span>
                ✅ {member.displayName ?? member.discordUsername} - found in
                server.
              </span>
              {/*
                Only when it changes what the student has to do. A single server
                is the normal case and needs no explanation; two servers with one
                already submitted is the case where a plain "already submitted"
                would be wrong.
              */}
              {(badge.payload.servers?.length ?? 0) > 1 ? (
                <span className="text-muted-foreground">
                  You are in {badge.payload.servers?.length} servers. One
                  submission records attendance for all of them
                  {pendingServers(badge.payload).length <
                    (badge.payload.servers?.length ?? 0)
                    ? ` (${pendingServers(badge.payload).length} still pending)`
                    : ""}
                  .
                </span>
              ) : null}
            </span>
          </span>
        ) : null}

        {badge.kind === "error" ? (
          <>
            <CircleAlert aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <span className="text-muted-foreground">
              Can&apos;t verify right now
              {badge.retryAfter
                ? ` — try again in about ${badge.retryAfter} seconds`
                : ""}
              . You can still submit the form.
            </span>
          </>
        ) : null}
      </p>

      {/*
        The "where to find your username" help is only useful *before* the
        handle is verified — once the badge says ✅, the student has already
        entered a valid handle. Pairing mismatch is handled by the modal in
        the parent form on submit.
      */}
      {badge.kind === "verified" ||
      badge.kind === "duplicate" ? null : (
        <details id={guidanceId} className="text-muted-foreground/90 group">
          <summary className="hover:text-foreground cursor-pointer list-none">
            Where to find your username
          </summary>
          <div className="mt-2 flex flex-col gap-2 pl-4">
            <span>
              <strong>Where to find your username:</strong> In the Discord
              app, click your profile picture in the bottom-left corner ➔
              the lowercase name after the <code>@</code> shown under your
              name.
            </span>
          </div>
        </details>
      )}
    </Field>
  );
}
