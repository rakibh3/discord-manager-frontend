"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  addRegistrationsToRoster,
  patchRegistrationSettings,
  resendWelcomeEmail,
  retryUnsentWelcomeEmails,
} from "@/lib/api/endpoints/registration";
import type {
  AddRegistrationsToRosterResult,
  Registration,
  RegistrationSettings,
  RetryWelcomeEmailsResult,
  UpdateRegistrationSettingsInput,
} from "@/lib/api/types";

const REGISTRATION_PATH = "/dashboard/registration";

type ActionResult<T> =
  | { ok: true; data: T; message: string }
  | { ok: false; message: string };

/** The backend's own message when it sent one, our fallback otherwise. */
function failure(error: unknown, fallback: string): { ok: false; message: string } {
  return {
    ok: false,
    message: error instanceof ApiError ? error.message : fallback,
  };
}

export async function saveRegistrationSettings(
  input: UpdateRegistrationSettingsInput,
): Promise<ActionResult<RegistrationSettings>> {
  try {
    const data = await patchRegistrationSettings(input);
    revalidatePath(REGISTRATION_PATH);
    return { ok: true, data, message: "Registration settings saved." };
  } catch (error) {
    return failure(
      error,
      "An unexpected error occurred while saving the registration settings.",
    );
  }
}

/** `ids` omitted adds every pending registration. */
export async function addToRoster(
  ids?: string[],
): Promise<ActionResult<AddRegistrationsToRosterResult>> {
  try {
    const data = await addRegistrationsToRoster(ids);
    revalidatePath(REGISTRATION_PATH);
    // The roster page and the overview both count roster entries.
    revalidatePath("/dashboard/roster");
    revalidatePath("/dashboard");

    const message =
      data.requested === 0
        ? "Nothing to add — no pending registrations matched."
        : data.blockedByRemovedEntry > 0
          ? `Added ${data.enrolled} of ${data.requested} to the roster. ${data.blockedByRemovedEntry} could not be added because the roster holds a removed entry for that email — restore it on the roster page.`
          : `Added ${data.enrolled} registration${data.enrolled === 1 ? "" : "s"} to the roster.`;

    return { ok: true, data, message };
  } catch (error) {
    return failure(error, "Could not add the registrations to the roster.");
  }
}

export async function resendRegistrationEmail(
  id: string,
): Promise<ActionResult<Registration>> {
  try {
    const data = await resendWelcomeEmail(id);
    revalidatePath(REGISTRATION_PATH);
    return {
      ok: true,
      data,
      message: `Welcome email queued for ${data.email}.`,
    };
  } catch (error) {
    return failure(error, "Could not queue the welcome email.");
  }
}

export async function retryUnsentEmails(): Promise<
  ActionResult<RetryWelcomeEmailsResult>
> {
  try {
    const data = await retryUnsentWelcomeEmails();
    revalidatePath(REGISTRATION_PATH);
    return {
      ok: true,
      data,
      message:
        data.queued === 0
          ? "No unsent welcome emails to retry."
          : `Queued ${data.queued} welcome email${data.queued === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    return failure(error, "Could not retry the unsent welcome emails.");
  }
}
