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
 *  stored schedule and the current Asia/Dhaka clock. */
export function getAttendanceWindow(): Promise<AttendanceWindow> {
  return api<AttendanceWindow>("/attendance/window", {
    anonymous: true,
    cache: "no-store",
  });
}

/** `GET /api/attendance/verify-user?username=...` — answers 200 either way, with
 *  `data.verified` carrying the result. */
export function verifyDiscordUsername(
  username: string,
): Promise<VerifyUserPayload> {
  return api<VerifyUserPayload>("/attendance/verify-user", {
    anonymous: true,
    cache: "no-store",
    query: { username },
  });
}

/** `GET /api/attendance/verify-email?email=...` — answers 200 either way, with
 *  `data.verified` carrying the result. When `emailVerificationRequired` is
 *  `false` the endpoint reports `verified: true` for every well-formed
 *  address; the live badge must read this flag and stay out of the way. */
export function verifyEmail(email: string): Promise<VerifyEmailPayload> {
  return api<VerifyEmailPayload>("/attendance/verify-email", {
    anonymous: true,
    cache: "no-store",
    query: { email },
  });
}

/** `POST /api/attendance/submit` — 201 on success, 409 if already submitted
 *  today, 404 if the member is not in the guild, 403 if the email is not on the
 *  enrolled roster (`emailVerificationRequired: true` only). */
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
