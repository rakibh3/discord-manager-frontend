import "server-only";

import { api, apiRequest } from "@/lib/api/client";
import type {
  AttendanceSubmitInput,
  AttendanceWindow,
  SubmitAttendancePayload,
  VerifyEmailPayload,
  VerifyUserPayload,
} from "@/lib/api/types";

/** Public attendance endpoints (`API_INTEGRATION.md` §8.6). No `Authorization`
 *  header; rate limited per IP — submit 5 req/15min, the three reads 60 req/min. */

/** `GET /api/attendance/window` — the public submission window, derived from the
 *  stored schedule and the current Asia/Dhaka clock. The response carries
 *  `emailVerificationRequired` so the form knows whether the email field is
 *  gated against the enrolment roster on submit. */
export function getAttendanceWindow(): Promise<AttendanceWindow> {
  return api<AttendanceWindow>("/attendance/window", {
    anonymous: true,
    cache: "no-store",
  });
}

/** `GET /api/attendance/verify-user?username=...&email=...` — answers 200
 *  either way, with `data.verified` carrying the result. Branch on `verified`,
 *  never the HTTP status — an unknown handle is still HTTP 200.
 *
 *  The optional `email` parameter turns the duplicate check into a
 *  **pairing-aware** read: when roster enforcement is on and the email resolves
 *  to a paired roster entry, only attendance rows whose member belongs to the
 *  paired account count as a duplicate for this email+handle combination. The
 *  form should always pass its typed email so the "already submitted" badge
 *  matches the email the student actually typed. Without it, the prior
 *  handle-only behaviour applies (any prior row counts as a duplicate).
 *
 *  A malformed email is a 400 (Zod), distinct from a handle that simply isn't
 *  a member — the form must tell them apart. */
export function verifyDiscordUsername(
  username: string,
  email?: string,
): Promise<VerifyUserPayload> {
  return api<VerifyUserPayload>("/attendance/verify-user", {
    anonymous: true,
    cache: "no-store",
    query: {
      username,
      // `undefined` is stripped by `buildUrl` — without it, the request
      // carries only the username query parameter.
      email,
    },
  });
}

/** `GET /api/attendance/verify-email?email=...` — answers 200 either way, with
 *  `data.verified` carrying the result. When the roster gate is OFF
 *  (`emailVerificationRequired: false`), every well-formed address returns
 *  `verified: false` deliberately — the form should not nag about a check
 *  that is not happening. */
export function verifyEmail(email: string): Promise<VerifyEmailPayload> {
  return api<VerifyEmailPayload>("/attendance/verify-email", {
    anonymous: true,
    cache: "no-store",
    query: { email },
  });
}

/** `POST /api/attendance/submit` — the body carries only `email` and
 *  `discordUsername` (plus the optional mismatch flag); `name` and `phone`
 *  are sourced server-side from the matched roster entry.
 *
 *  Outcomes:
 *  - **201** → attendance recorded. `data.attendanceRecorded` is `true`.
 *  - **202** → attendance NOT recorded; mismatch report queued. `data.attendanceRecorded`
 *    is `false` and `data.reportQueued` is `true`. The form renders a different
 *    card on this branch — a "Recorded" message would be a lie.
 *  - **403** → email not on the roster (gate armed), OR the Discord handle
 *    does not match the pairing. The two are decided by the message text.
 *  - **404** → the handle is not a member of any configured server.
 *  - **409** → already submitted today. Read as a success-adjacent outcome.
 */
export async function submitAttendance(
  payload: AttendanceSubmitInput,
): Promise<SubmitAttendancePayload> {
  const { data } = await apiRequest<SubmitAttendancePayload>(
    "/attendance/submit",
    {
      method: "POST",
      anonymous: true,
      body: payload,
    },
  );
  return data;
}
