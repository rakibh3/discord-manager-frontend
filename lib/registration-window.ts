import "server-only";

import { getRegistrationWindow } from "@/lib/api/endpoints/registration";
import type { RegistrationWindow } from "@/lib/api/types";

const STATES = new Set(["disabled", "not-yet-open", "open", "closed"]);

/** Reads the public registration window for `/register`, failing **open**:
 *  any error returns `null` and the form renders normally. The backend
 *  re-checks the window on every submit, so showing the form when the window
 *  could not be read costs a registrant one refused submit at worst — whereas
 *  failing closed would hide a form that is in fact open behind a backend
 *  blip. Mirror of `getAttendanceWindow` in `lib/attendance-window.ts`. */
export async function readRegistrationWindow(): Promise<RegistrationWindow | null> {
  try {
    const data = await getRegistrationWindow();

    return isRegistrationWindow(data) ? data : null;
  } catch {
    return null;
  }
}

/** A payload missing `isOpen` would coerce to `false` and close the form, so
 *  anything not recognisably a window is treated as no answer at all. */
function isRegistrationWindow(value: unknown): value is RegistrationWindow {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RegistrationWindow>;

  return (
    typeof candidate.isOpen === "boolean" &&
    typeof candidate.state === "string" &&
    STATES.has(candidate.state)
  );
}
