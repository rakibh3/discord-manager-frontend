import "server-only";

import { api, apiRequest } from "@/lib/api/client";
import type {
  AttendanceSubmitInput,
  AttendanceWindow,
  SubmitAttendancePayload,
  VerifyUserPayload,
} from "@/lib/api/types";

/** Public attendance endpoints (`API_INTEGRATION.md` §8.6). No `Authorization`
 *  header; rate limited per IP — submit 5 req/15min, the two reads 60 req/min. */

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

/** `POST /api/attendance/submit` — 201 on success, 409 if already submitted
 *  today, 404 if the member is not in the guild. */
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
