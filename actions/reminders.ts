"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import {
  cancelReminder,
  getTargets,
  sendReminder,
} from "@/lib/api/endpoints/reminders";
import type {
  ReminderCriterion,
  ReminderProgress,
  ReminderTarget,
} from "@/lib/api/types";
import {
  countedDays,
  periodProblem,
  type Period,
} from "@/lib/period";
import { REMINDER_MESSAGE_MAX_LENGTH } from "@/lib/reminder-labels";

/** How many target rows the preview ships to the browser. */
const PREVIEW_SLICE = 50;

/** What the admin chose, shared verbatim between the preview and the send so
 *  the two derive their target set from one query and cannot disagree. */
export type ReminderSelectionInput = {
  period: Period;
  criterion: ReminderCriterion;
  minMissedDays: number;
  guildIds: string[];
};

export type TargetPreview =
  | {
      ok: true;
      /** Recipient rows — the per-server audit trail. */
      targetCount: number;
      /** People actually DMed. One account targeted through two servers still
       *  receives exactly one DM, so this is the number that matters. */
      uniqueRecipients: number;
      /** A bounded slice — the endpoint itself returns thousands of rows. */
      sample: ReminderTarget[];
    }
  | { ok: false; message: string };

/** Refuses a selection the backend would reject anyway, next to the control
 *  that caused it rather than as an opaque 400. */
function selectionProblem(selection: ReminderSelectionInput): string | null {
  const problem = periodProblem(selection.period);
  if (problem) return problem;

  const days = countedDays(selection.period);
  if (days === 0) {
    return "No days are counted — the chosen weekdays never occur inside this range.";
  }
  // A threshold higher than the number of counted days could never be met, and
  // a broadcast that always finds nobody is better refused than run.
  if (selection.minMissedDays > days) {
    return `The range counts ${days} day${days === 1 ? "" : "s"}, so a threshold of ${selection.minMissedDays} can never be met.`;
  }
  return null;
}

/** The dry run; sends nothing. Only the counts and a bounded slice cross to the
 *  client — the endpoint returns every target unpaginated. */
export async function previewTargets(
  selection: ReminderSelectionInput,
): Promise<TargetPreview> {
  const problem = selectionProblem(selection);
  if (problem) return { ok: false, message: problem };

  try {
    const payload = await getTargets(selection);
    return {
      ok: true,
      targetCount: payload.targetCount,
      uniqueRecipients: payload.uniqueRecipients ?? payload.targetCount,
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

/** The 409 message embeds the running broadcast's id, so it can be linked. */
function extractExistingId(message: string): string | null {
  const match = message.match(/\(id[:\s]+([A-Za-z0-9_-]+)\)?/i);
  return match?.[1] ?? null;
}

/** Queues a broadcast. On 202 this redirects to the progress view and never
 *  returns; every other outcome comes back as a discriminated result. */
export async function sendBroadcast(
  selection: ReminderSelectionInput & { message: string },
): Promise<SendResult> {
  const message = selection.message.trim();

  if (message.length === 0) {
    return { outcome: "error", message: "Write a message before sending." };
  }

  if (message.length > REMINDER_MESSAGE_MAX_LENGTH) {
    return {
      outcome: "error",
      message: `The message is ${message.length} characters. The cap is ${REMINDER_MESSAGE_MAX_LENGTH}.`,
    };
  }

  const problem = selectionProblem(selection);
  if (problem) return { outcome: "error", message: problem };

  let queuedId: string;

  try {
    // The period is always explicit and never inferred — an inferred date near
    // midnight would DM the wrong day's members, and there is no undo.
    const queued = await sendReminder({ ...selection, message });
    queuedId = queued.id;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    // 400 also covers "there is nobody to remind" — everyone already submitted,
    // which is the system working, not a failure.
    if (error.status === 400 && /nobody to remind/i.test(error.message)) {
      return { outcome: "nobody-to-remind", message: error.message };
    }

    // 409: the one-at-a-time guard, which is an *overlap* check rather than
    // date equality — any unfinished run sharing a single day refuses this one.
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

/** Cancels an in-flight broadcast. The 200 payload already shows `CANCELLED`;
 *  409 means it finished on its own between render and click. */
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
