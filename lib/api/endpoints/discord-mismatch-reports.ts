import "server-only";

import { api, apiRequest } from "@/lib/api/client";
import type {
  ApiResponse,
  DiscordMismatchReportActionInput,
  DiscordMismatchReportActionResult,
  DiscordMismatchReportList,
  DiscordMismatchReportQuery,
} from "@/lib/api/types";

/** Discord pairing mismatch reports (`API_INTEGRATION.md` §8.6B).
 *  All routes are ADMIN — these are submitted when a student ticks the
 *  `cannotEnterRealDiscordUsername` flag on `POST /api/attendance/submit`
 *  (§8.6) because the handle they entered did not match the recorded
 *  pairing for the same email. Only one open report per entry per Dhaka
 *  day can exist — closing one (reassign or dismiss) frees the entry for
 *  a fresh report the next day. */

/** `GET /api/roster/discord-mismatch-reports` — paginated list, filterable
 *  by status / search / reportedAt window. `pairedAccountId` and
 *  `submittingAccountId` are explicitly rejected server-side as 400; the
 *  listing must not let a caller enumerate Discord account snowflakes.
 *  The `data` shape here is `{ items, total }` (a mirror of `meta.total`)
 *  rather than a bare array, so the listing never has to look in two places. */
export function listDiscordMismatchReports(
  query?: DiscordMismatchReportQuery,
): Promise<ApiResponse<DiscordMismatchReportList>> {
  return apiRequest<DiscordMismatchReportList>(
    "/roster/discord-mismatch-reports",
    {
      query: {
        status: query?.status ?? "open",
        search: query?.search,
        dateFrom: query?.dateFrom,
        dateTo: query?.dateTo,
        page: query?.page ?? 1,
        limit: query?.limit ?? 50,
      },
    },
  );
}

/** `POST /api/roster/discord-mismatch-reports/:id/action` — closes the
 *  report. `reassign` rewrites the entry's pairing to the submitted account
 *  (refused as 422 if the submitted account is no longer in any configured
 *  guild; refused as 409 if the entry's pairing has moved on). `dismiss`
 *  closes the report and leaves the pairing untouched. Either action on
 *  an already-closed report is a 409. The only two valid `action` values
 *  are `reassign` and `dismiss` — anything else (or extra body fields)
 *  is a 400. */
export function actOnDiscordMismatchReport(
  id: string,
  input: DiscordMismatchReportActionInput,
): Promise<DiscordMismatchReportActionResult> {
  return api<DiscordMismatchReportActionResult>(
    `/roster/discord-mismatch-reports/${encodeURIComponent(id)}/action`,
    {
      method: "POST",
      body: input,
    },
  );
}
