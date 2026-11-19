"use client";

import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DiscordUsernameGuide } from "./_components/discord-username-guide";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

/** Live Discord username verification, called browser-direct to avoid doubling
 *  the latency. Answers 200 either way.
 *
 *  Reports the live verdict to the parent via `onVerifiedChange(boolean)` so a
 *  gating submit button can disable itself when the handle is still being
 *  checked, is unknown, or has not been entered yet.
 *
 *  **No email is forwarded to `/verify-user` from this field.** Pairing
 *  conflicts are checked by the form's own debounced `/verify-pair` call once
 *  both field badges are green — and by the submit path, server-side. */
export function DiscordHandleField({
  value,
  onChange,
  error,
  fieldId,
  onVerifiedChange,
  onAlreadySubmittedChange,
  onBadgeKindChange,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  fieldId: string;
  onVerifiedChange?: (verified: boolean) => void;
  onAlreadySubmittedChange?: (alreadySubmitted: boolean | null) => void;
  onBadgeKindChange?: (kind: HandleBadge["kind"]) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const abortRef = useRef<AbortController | null>(null);

  // Only the asynchronous verdict is state, tagged with the handle it belongs
  // to; everything decidable synchronously is derived during render.
  const [remote, setRemote] = useState<{
    handle: string;
    badge: HandleBadge;
  } | null>(null);

  const handle = normalizeDiscordUsername(value);

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

      try {
        const response = await fetch(
          `${API_BASE}/attendance/verify-user?username=${encodeURIComponent(handle)}`,
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

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [handle, malformed]);

  // Report the verdict to the parent so it can gate submit.
  useEffect(() => {
    onVerifiedChange?.(isHandleVerified(badge));
    onBadgeKindChange?.(badge.kind);
  }, [badge, onVerifiedChange, onBadgeKindChange]);

  // Report the already-submitted verdict separately so a duplicate handle
  // disables submit with an accurate message rather than "not a member".
  useEffect(() => {
    if (!onAlreadySubmittedChange) return;
    const tri = (() => {
      switch (badge.kind) {
        case "duplicate":
          return true;
        case "idle":
        case "checking":
        case "malformed":
          return null;
        default:
          return false;
      }
    })();
    onAlreadySubmittedChange(tri);
  }, [badge, onAlreadySubmittedChange]);

  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const statusId = `${fieldId}-status`;
  const member = badge.kind === "verified" ? badge.payload.member : null;
  const showStatus = badge.kind !== "idle";
  const isInvalid = Boolean(
    error || badge.kind === "malformed" || badge.kind === "unknown",
  );

  const describedBy = [
    hintId,
    error ? errorId : null,
    showStatus ? statusId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Field data-invalid={isInvalid ? true : undefined}>
      <FieldLabel htmlFor={fieldId} className="text-foreground font-semibold">
        Discord username{" "}
        <span aria-hidden="true" className="text-status-error">
          *
        </span>
      </FieldLabel>

      <FieldDescription id={hintId} className="text-xs">
        The lowercase handle after{" "}
        <code className="text-foreground font-mono">@</code> on your Discord
        profile — not your display name.
      </FieldDescription>

      <InputGroup>
        <InputGroupAddon
          align="inline-start"
          className="text-foreground pl-3 font-mono font-bold"
        >
          <span aria-hidden="true">@</span>
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          id={fieldId}
          name="discordUsername"
          type="text"
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
          enterKeyHint="done"
          placeholder="rakib_dev"
          aria-invalid={isInvalid ? true : false}
          aria-describedby={describedBy}
        />
        {showStatus ? (
          <InputGroupAddon align="inline-end" className="pr-3">
            {badge.kind === "checking" ? (
              <Loader2
                aria-hidden="true"
                className="text-muted-foreground size-4 animate-spin"
              />
            ) : badge.kind === "verified" || badge.kind === "duplicate" ? (
              <CheckCircle2
                aria-hidden="true"
                className="text-status-success size-4"
              />
            ) : badge.kind === "malformed" || badge.kind === "unknown" ? (
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

      {/* Asynchronous verdicts announced once settled (not while spinning). */}
      {showStatus ? (
        <div
          id={statusId}
          role={badge.kind === "checking" ? undefined : "status"}
          aria-live={badge.kind === "checking" ? "off" : "polite"}
          className="text-sm"
        >
          {badge.kind === "checking" ? (
            <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
              <Loader2
                aria-hidden="true"
                className="size-3.5 shrink-0 animate-spin"
              />
              <span>Checking Discord server directory…</span>
            </p>
          ) : null}

          {badge.kind === "malformed" ? (
            <p className="text-status-error flex items-start gap-1.5 text-xs font-medium">
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0"
              />
              <span>
                Invalid format. Use 2–32 lowercase letters, digits,{" "}
                <code className="font-mono">_</code>, or{" "}
                <code className="font-mono">.</code> (no two dots in a row).
              </span>
            </p>
          ) : null}

          {badge.kind === "unknown" ? (
            <p className="border-border-coral bg-destructive/10 text-status-error flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-medium">
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                This Discord username was not found in our Discord server. Check
                the spelling, or join the server first.
              </span>
            </p>
          ) : null}

          {badge.kind === "duplicate" ? (
            <p className="border-border-sage bg-success/15 text-status-success flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-semibold">
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                Attendance already submitted for{" "}
                <span className="font-mono">{badge.date}</span>. Nothing more to
                do here today.
              </span>
            </p>
          ) : null}

          {badge.kind === "verified" && member ? (
            <div className="border-border-sage bg-success/15 flex items-center justify-between gap-3 rounded-xl border-2 px-3 py-2 shadow-[2px_2px_0_0_var(--border-sage)]">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar className="border-foreground size-8 shrink-0 border-2">
                  {member.avatarUrl ? (
                    <AvatarImage src={member.avatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="font-mono text-[10px] font-bold">
                    {member.discordUsername.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="text-foreground truncate text-xs font-bold">
                    {member.displayName ?? member.discordUsername}
                  </span>
                  <span className="text-status-success truncate font-mono text-[11px] font-medium">
                    @{member.discordUsername} · Found in server
                  </span>
                </div>
              </div>
              <Badge variant="success" className="shrink-0 font-mono text-[10px]">
                <CheckCircle2 aria-hidden="true" />
                VERIFIED
              </Badge>
            </div>
          ) : null}

          {badge.kind === "error" ? (
            <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0"
              />
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

      {/* Only helpful before the handle resolves as verified or duplicate. */}
      {badge.kind === "verified" || badge.kind === "duplicate" ? null : (
        <DiscordUsernameGuide className="mt-1" />
      )}
    </Field>
  );
}
