"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  actOnDiscordMismatchReport,
} from "@/lib/api/endpoints/discord-mismatch-reports";
import type {
  DiscordMismatchReportAction,
  DiscordMismatchReportActionResult,
} from "@/lib/api/types";

export type MismatchReportActionOutcome =
  | {
      ok: true;
      data: DiscordMismatchReportActionResult;
      message: string;
    }
  | { ok: false; message: string };

/** Server-side wrapper around `actOnDiscordMismatchReport`. Either action
 *  (`reassign` or `dismiss`) closes the report and may rewrite the entry's
 *  Discord pairing — we revalidate both surfaces so the dashboard and the
 *  roster listing refresh together. */
export async function actOnMismatchReport(
  id: string,
  action: DiscordMismatchReportAction,
): Promise<MismatchReportActionOutcome> {
  try {
    const data = await actOnDiscordMismatchReport(id, { action });
    revalidatePath("/dashboard/mismatch-reports");
    revalidatePath("/dashboard/roster");
    revalidatePath("/dashboard");
    const message =
      action === "reassign"
        ? "Report closed; the entry pairing has been updated to the submitted account."
        : "Report dismissed; the recorded pairing is unchanged.";
    return { ok: true, data, message };
  } catch (error) {
    if (error instanceof ApiError) {
      // The server's message already names the conflict (entry pairing moved
      // on, submitted account no longer in any guild, report already closed),
      // so we surface it directly without wrapping.
      return { ok: false, message: error.message };
    }
    return {
      ok: false,
      message: "Could not act on the mismatch report. Please try again.",
    };
  }
}
