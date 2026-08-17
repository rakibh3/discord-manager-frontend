"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import {
  cancelReminder,
  getTargets,
  sendReminder,
} from "@/lib/api/endpoints/reminders";
import type { ReminderProgress, ReminderTarget } from "@/lib/api/types";
import { dhakaToday } from "@/lib/dhaka-date";
import { REMINDER_MESSAGE_MAX_LENGTH } from "@/lib/reminder-labels";

/** How many target rows the preview ships to the browser. */
const PREVIEW_SLICE = 50;

export type TargetPreview =
  | {
      ok: true;
      date: string;
      targetCount: number;
      /** A bounded slice — the endpoint itself returns thousands of rows. */
      sample: ReminderTarget[];
    }
  | { ok: false; message: string };

/**
 * The dry run. Sends nothing.
 *
 * Only `targetCount` and a bounded slice cross to the client: the endpoint
 * returns every target unpaginated, and serializing thousands of rows into the
 * RSC payload would freeze the tab for a number the admin only needs once.
 */
export async function previewTargets(date: string): Promise<TargetPreview> {
  if (date > dhakaToday()) {
    return {
      ok: false,
      message: "That date is in the future in Dhaka. Pick today or earlier.",
    };
  }

  try {
    const payload = await getTargets(date);
    return {
      ok: true,
      date: payload.date,
      targetCount: payload.targetCount,
      sample: payload.targets.slice(0, PREVIEW_SLICE),
    };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { ok: false, message: error.message };
  }
}

export type SendResult =
  /** 400 "nobody to remind" — a good outcome, not a red error. */
  | { outcome: "nobody-to-remind"; message: string }
  | { outcome: "conflict"; message: string; existingId: string | null }
  | { outcome: "queue-unavailable"; message: string }
  | { outcome: "error"; message: string };

/** The 409 message embeds the existing broadcast's id, so it can be linked. */
function extractExistingId(message: string): string | null {
  const match = message.match(/\(id[:\s]+([A-Za-z0-9_-]+)\)?/i);
  return match?.[1] ?? null;
}

/**
 * Queues a broadcast.
 *
 * On 202 this redirects to the progress view and never returns. Every other
 * outcome comes back as a discriminated result so the composer can render copy
 * matched to what actually happened.
 */
export async function sendBroadcast(input: {
  date: string;
  message: string;
}): Promise<SendResult> {
  const message = input.message.trim();

  if (message.length === 0) {
    return { outcome: "error", message: "Write a message before sending." };
  }

  if (message.length > REMINDER_MESSAGE_MAX_LENGTH) {
    return {
      outcome: "error",
      message: `The message is ${message.length} characters. The cap is ${REMINDER_MESSAGE_MAX_LENGTH}.`,
    };
  }

  if (input.date > dhakaToday()) {
    return {
      outcome: "error",
      message: "That date is in the future in Dhaka. Pick today or earlier.",
    };
  }

  let queuedId: string;

  try {
    // `date` is always explicit and never inferred — an inferred date near
    // midnight would DM the wrong day's members, and there is no undo.
    const queued = await sendReminder({ date: input.date, message });
    queuedId = queued.id;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    // 400 covers Zod *and* "there is nobody to remind" — every member already
    // submitted. That second case is the system working, so it must not be
    // presented as a failure.
    if (error.status === 400 && /nobody to remind/i.test(error.message)) {
      return { outcome: "nobody-to-remind", message: error.message };
    }

    // 409: the double-click guard. A broadcast for this date is already
    // running, which usually means the send *succeeded* a moment ago.
    if (error.status === 409) {
      return {
        outcome: "conflict",
        message: error.message,
        existingId: extractExistingId(error.message),
      };
    }

    if (error.status === 503) {
      return { outcome: "queue-unavailable", message: error.message };
    }

    return { outcome: "error", message: error.message };
  }

  revalidatePath("/dashboard/reminders");
  redirect(`/dashboard/reminders/${queuedId}`);
}

export type CancelResult =
  | { ok: true; progress: ReminderProgress }
  | { ok: false; message: string };

/**
 * Cancels an in-flight broadcast.
 *
 * The 200 payload already shows `CANCELLED`, so it replaces the displayed
 * progress directly and polling can stop immediately. 409 means the broadcast
 * finished on its own between render and click.
 */
export async function cancelBroadcast(id: string): Promise<CancelResult> {
  try {
    const progress = await cancelReminder(id);
    revalidatePath(`/dashboard/reminders/${id}`);
    revalidatePath("/dashboard/reminders");
    return { ok: true, progress };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { ok: false, message: error.message };
  }
}
