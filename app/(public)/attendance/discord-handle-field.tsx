"use client";

import { CheckCircle2, CircleAlert, Info, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

/**
 * Live Discord username verification.
 *
 * Called **browser-direct**, not through the Next server: this fires on a
 * keystroke debounce, and proxying every call would double the latency of an
 * endpoint that is public by design and rate-limited per IP.
 *
 * Two things the backend does that drive the logic here:
 *
 *   - It answers **HTTP 200 even for an unknown handle**, so the verdict comes
 *     from `data.verified`, never from the status code. A malformed handle is a
 *     400, which is a different message: "fix your typing" rather than "you are
 *     not in the server".
 *   - Nothing here gates submission. Verification is an affordance; the write
 *     path re-runs every check server-side and is the real enforcement point.
 *     A student whose verification failed because their wifi dropped must still
 *     be able to submit.
 */
export function DiscordHandleField({
  value,
  onChange,
  error,
  fieldId,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  fieldId: string;
}) {
  const abortRef = useRef<AbortController | null>(null);

  // Only the *asynchronous* verdict is state, and it is tagged with the handle
  // it belongs to. Everything a keystroke can decide synchronously — empty,
  // malformed, still checking — is derived during render instead, so the
  // displayed badge can never lag the input by a frame or belong to a handle
  // the student has already edited.
  const [remote, setRemote] = useState<{
    handle: string;
    badge: HandleBadge;
  } | null>(null);

  const handle = normalizeDiscordUsername(value);

  // The rule must stay exactly as loose as Discord's, or real students are
  // locked out. Catching it here also spares the per-IP rate-limit budget.
  const malformed = handle !== "" && !DISCORD_USERNAME_REGEX.test(handle);

  const badge: HandleBadge =
    handle === ""
      ? { kind: "idle" }
      : malformed
        ? { kind: "malformed" }
        : !API_BASE
          ? { kind: "error", retryAfter: null }
          : remote?.handle === handle
            ? remote.badge
            : { kind: "checking" };

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

        // 400 is Zod rejecting the handle's shape — distinct from a handle that
        // is simply not in the server.
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
    // Keyed on the *normalized* handle, so retyping the same handle with
    // different casing or padding does not spend another request.
  }, [handle, malformed]);

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
            <span className="text-muted-foreground">যাচাই করা হচ্ছে… (Checking…)</span>
          </>
        ) : null}

        {badge.kind === "malformed" ? (
          <>
            <CircleAlert aria-hidden className="text-destructive mt-0.5 size-4 shrink-0" />
            <span className="text-destructive">
              এটি সঠিক ফরম্যাটে নেই। প্রোফাইলে <code>@</code> চিহ্নের পরের ছোট
              হাতের নামটি লিখুন — শুধু ছোট হাতের অক্ষর, সংখ্যা, <code>_</code> বা{" "}
              <code>.</code> চলবে (পরপর দুটি ডট নয়)।
            </span>
          </>
        ) : null}

        {badge.kind === "unknown" ? (
          <>
            <CircleAlert aria-hidden className="text-destructive mt-0.5 size-4 shrink-0" />
            <span className="text-destructive">
              এই Discord Username-টি আমাদের Discord সার্ভারে পাওয়া যায়নি। বানান
              ঠিক আছে কিনা দেখুন, অথবা আগে সার্ভারে জয়েন করুন।
            </span>
          </>
        ) : null}

        {badge.kind === "duplicate" ? (
          <>
            <CheckCircle2 aria-hidden className="text-success mt-0.5 size-4 shrink-0" />
            <span className="text-success">
              আপনি {badge.date} তারিখের attendance ইতোমধ্যে জমা দিয়েছেন। নতুন করে
              কিছু করার দরকার নেই।
            </span>
          </>
        ) : null}

        {badge.kind === "verified" && member ? (
          <span className="text-success flex items-center gap-2">
            <Avatar className="size-6">
              {member.avatarUrl ? (
                <AvatarImage src={member.avatarUrl} alt="" />
              ) : null}
              <AvatarFallback className="text-[10px]">
                {member.discordUsername.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span>
              ✅ {member.displayName ?? member.discordUsername} — সার্ভারে পাওয়া
              গেছে।
            </span>
          </span>
        ) : null}

        {badge.kind === "error" ? (
          <>
            <CircleAlert aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <span className="text-muted-foreground">
              এখন যাচাই করা যাচ্ছে না
              {badge.retryAfter
                ? ` — প্রায় ${badge.retryAfter} সেকেন্ড পর আবার চেষ্টা করুন`
                : ""}
              । তবুও আপনি ফর্ম জমা দিতে পারবেন।
            </span>
          </>
        ) : null}
      </p>

      {error ? (
        <FieldDescription className="text-destructive">{error}</FieldDescription>
      ) : null}

      {/*
        Guidance is visible from first render, before any error — students
        overwhelmingly enter their Display Name instead of their username, and
        an error message shown after the fact does not prevent that.
      */}
      <FieldDescription id={guidanceId}>
        <span className="flex items-start gap-2">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>আপনার Discord Username কোথায় পাবেন:</strong> Discord অ্যাপের
            নিচে বাম কোণায় আপনার প্রোফাইল ছবিতে ক্লিক করুন ➔ আপনার নামের নিচে{" "}
            <code>@</code> চিহ্নের পরের ছোট হাতের নামটিই আপনার Discord Username
            (যেমন <code>@rakib_dev</code> হলে শুধু <code>rakib_dev</code> লিখুন)।
            এটি আপনার <em>Display Name</em> নয়।
          </span>
        </span>
      </FieldDescription>
    </Field>
  );
}
