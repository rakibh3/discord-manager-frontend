"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  deactivateRosterEntry,
  patchRosterSettings,
  restoreRosterEntry,
  updateRosterEntry,
} from "@/lib/api/endpoints/roster";
import type {
  RosterEntry,
  RosterSettings,
  UpdateRosterEntryInput,
} from "@/lib/api/types";

export type RosterSettingsResult =
  | { ok: true; data: RosterSettings; message: string }
  | { ok: false; message: string };

export async function saveRosterSettings(
  enforceEmail: boolean,
): Promise<RosterSettingsResult> {
  try {
    const data = await patchRosterSettings({ enforceEmail });
    revalidatePath("/dashboard/roster");
    revalidatePath("/dashboard");
    const message = enforceEmail
      ? "Enrolment email verification is now armed. Attendance submissions require an enrolled email."
      : "Email check disabled. Attendance submissions are open to all Discord members.";
    return { ok: true, data, message };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.message };
    }
    return {
      ok: false,
      message: "An unexpected error occurred while saving roster settings.",
    };
  }
}

export type RosterEntryActionResult =
  | { ok: true; data: RosterEntry; message: string }
  | { ok: false; message: string };

export async function editRosterEntry(
  id: string,
  input: UpdateRosterEntryInput,
): Promise<RosterEntryActionResult> {
  try {
    const data = await updateRosterEntry(id, input);
    revalidatePath("/dashboard/roster");
    // The roster engagement read model at `/dashboard/roster/status` reflects
    // `name` / `email` / `isActive` per entry — editing one without
    // revalidating the engagement surface would leave the status listing
    // showing the stale row until a hard refresh.
    revalidatePath("/dashboard/roster/status");
    return {
      ok: true,
      data,
      message: "Roster entry updated successfully.",
    };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.message };
    }
    return {
      ok: false,
      message: "Could not update roster entry. Please try again.",
    };
  }
}

export async function deactivateEntry(
  id: string,
): Promise<RosterEntryActionResult> {
  try {
    const data = await deactivateRosterEntry(id);
    revalidatePath("/dashboard/roster");
    revalidatePath("/dashboard/roster/status");
    return {
      ok: true,
      data,
      message: `Deactivated ${data.name}. This student will no longer pass attendance verification.`,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.message };
    }
    return {
      ok: false,
      message: "Could not deactivate roster entry.",
    };
  }
}

export async function restoreEntry(
  id: string,
): Promise<RosterEntryActionResult> {
  try {
    const data = await restoreRosterEntry(id);
    revalidatePath("/dashboard/roster");
    revalidatePath("/dashboard/roster/status");
    return {
      ok: true,
      data,
      message: `Restored ${data.name}. Enrolment reinstated.`,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.message };
    }
    return {
      ok: false,
      message: "Could not restore roster entry.",
    };
  }
}
