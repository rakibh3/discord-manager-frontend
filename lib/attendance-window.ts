import "server-only";

import { apiRequest } from "@/lib/api/client";
import type { AttendanceWindow } from "@/lib/api/types";

/** Reads the public attendance window for the homepage, failing **open**: any
 *  error returns `null` and the form renders normally. Never invert this. */
export async function getAttendanceWindow(): Promise<AttendanceWindow | null> {
  try {
    const { data } = await apiRequest<AttendanceWindow>("/attendance/window", {
      // No credential exists for this caller — students are not `users` rows.
      anonymous: true,
      // The window turns over on a wall clock, so a cached answer would keep
      // showing "closed" for minutes after it opened.
      cache: "no-store",
    });

    return isAttendanceWindow(data) ? data : null;
  } catch {
    // Includes the 404 the route currently answers, any backend outage, and a
    // missing `API_BASE_URL`. All of them mean "show the form".
    return null;
  }
}

/** A payload missing `isOpen` would coerce to `false` and close the form, so
 *  anything not recognisably a window is treated as no answer at all. */
function isAttendanceWindow(value: unknown): value is AttendanceWindow {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AttendanceWindow>;

  return (
    typeof candidate.isOpen === "boolean" &&
    typeof candidate.openTime === "string" &&
    typeof candidate.closeTime === "string" &&
    Array.isArray(candidate.daysOfWeek)
  );
}
