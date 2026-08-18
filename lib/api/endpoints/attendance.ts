import "server-only";

import { api, apiRequest } from "@/lib/api/client";
import type {
  AttendanceSubmitInput,
  AttendanceWindow,
  SubmitAttendancePayload,
  VerifyUserPayload,
} from "@/lib/api/types";

/**
 * Public Attendance API Endpoints (`/api/attendance`)
 *
 * Publicly accessible endpoints used by the student attendance form, as documented
 * in `API_INTEGRATION.md` §8.6 and `postman-collection.json`.
 *
 * These routes require no `Authorization` header (`anonymous: true`).
 * Rate limits apply per IP:
 * - `/attendance/window`: 60 req/min
 * - `/attendance/verify-user`: 60 req/min
 * - `/attendance/submit`: 5 req/15min
 */

/**
 * `GET /api/attendance/window`
 *
 * Returns the public attendance submission window projection calculated from the
 * stored schedule and current Asia/Dhaka clock.
 */
export function getAttendanceWindow(): Promise<AttendanceWindow> {
  return api<AttendanceWindow>("/attendance/window", {
    anonymous: true,
    cache: "no-store",
  });
}

/**
 * `GET /api/attendance/verify-user?username=...`
 *
 * Verifies if a given Discord username belongs to an active member in the guild.
 * Answers HTTP 200 with `data.verified: true | false`.
 */
export function verifyDiscordUsername(
  username: string,
): Promise<VerifyUserPayload> {
  return api<VerifyUserPayload>("/attendance/verify-user", {
    anonymous: true,
    cache: "no-store",
    query: { username },
  });
}

/**
 * `POST /api/attendance/submit`
 *
 * Submits daily attendance for a verified guild member.
 * Returns 201 on success, 409 if already submitted for today, 404 if member is not in guild.
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
