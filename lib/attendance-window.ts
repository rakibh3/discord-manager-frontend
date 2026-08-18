import "server-only";

import { apiRequest } from "@/lib/api/client";
import type { AttendanceWindow } from "@/lib/api/types";

/**
 * Reads the public attendance window for the homepage.
 *
 * ## Why this is its own module rather than an endpoint under `lib/api/endpoints/`
 *
 * Every other read in that directory is admin-only and is *supposed* to fail
 * loudly. This one is the opposite on both counts: it is called from the
 * unauthenticated homepage, and a failure must never be visible to a student.
 *
 * ## Fail-open, deliberately
 *
 * `GET /api/attendance/window` does not exist on the backend yet — see
 * `BACKEND_REQUIREMENTS.md` §2. Until it ships, every call here answers
 * `API Not Found!` and this function returns `null`, which the homepage renders
 * as the ordinary form. So shipping this ahead of the backend changes nothing
 * for students, and the gate switches itself on the moment the route appears —
 * no flag to flip, no deploy to coordinate.
 *
 * The same reasoning applies permanently, not just during the rollout: if the
 * backend is down or slow, the correct behaviour is to show the form. The
 * window is a courtesy that saves a student from filling in four fields at
 * 3 a.m.; it is **not** an enforcement point. `POST /attendance/submit` is
 * where membership, duplicates and rate limits are actually enforced, and it
 * re-runs all of them regardless of what this returned.
 *
 * Never invert this into fail-closed. A backend blip would then show ~5,000
 * students a "come back later" page during the exact hours they are supposed
 * to be submitting, and nothing in the UI would reveal why.
 */
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

/**
 * Guards against a half-shaped payload closing the form.
 *
 * A response missing `isOpen` would coerce to `false` and lock every student
 * out, so anything that is not recognisably a window is treated as no answer
 * at all — which fails open like every other failure here.
 */
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
