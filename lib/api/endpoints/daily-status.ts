import "server-only";

import { api, apiRequest } from "@/lib/api/client";
import type {
  ApiResponse,
  DailyStatusCounts,
  DailyStatusMember,
  DailyStatusMemberDetail,
  DailyStatusQuery,
} from "@/lib/api/types";
import { DAILY_STATUS_ENABLED } from "@/lib/flags";

/**
 * ⚠️ **None of these endpoints exist on the backend today.**
 *
 * `API_INTEGRATION.md` §13 is explicit: `getDailyStatusPage()` and
 * `getDailyStatusCounts()` are written and tested in the backend's repository
 * layer, but no module exposes them over HTTP. Every path below would answer
 * `404 API Not Found!`.
 *
 * They are written to the documented contract so the feature is genuinely ready
 * to switch on rather than needing to be built later — and every one of them is
 * guarded, so a call cannot escape while the flag is off. The guard throws
 * rather than returning empty data on purpose: a silent empty result would show
 * up as "0 members complete", which is a fabricated figure, and fabricated
 * figures are exactly what this design refuses to produce.
 */
const PATHS = {
  counts: "/daily-status/counts",
  page: "/daily-status",
  member: (memberId: string) => `/daily-status/members/${memberId}`,
  export: "/daily-status/export",
} as const;

function assertEnabled(caller: string): void {
  if (!DAILY_STATUS_ENABLED) {
    throw new Error(
      `${caller} was called while DAILY_STATUS_ENABLED is off. The backend exposes no daily-status route (API_INTEGRATION.md §13), so this request would 404. Guard the call site with the flag instead of calling this.`,
    );
  }
}

/**
 * The seven overview figures, from **one** source.
 *
 * They interlock and must agree with each other, so none of them may be
 * assembled from the reminder targets list or anywhere else — the two are
 * computed differently and would quietly contradict each other.
 */
export function getDailyStatusCounts(date: string): Promise<DailyStatusCounts> {
  assertEnabled("getDailyStatusCounts");
  return api<DailyStatusCounts>(PATHS.counts, { query: { date } });
}

/** Server-paginated member list. Filter and search combine into one request. */
export function getDailyStatusPage(
  query: DailyStatusQuery,
): Promise<ApiResponse<DailyStatusMember[]>> {
  assertEnabled("getDailyStatusPage");
  return apiRequest<DailyStatusMember[]>(PATHS.page, {
    query: {
      date: query.date,
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search,
    },
  });
}

/** One member's contact details, attendance time and that day's messages. */
export function getDailyStatusMember(
  memberId: string,
  date: string,
): Promise<DailyStatusMemberDetail> {
  assertEnabled("getDailyStatusMember");
  return api<DailyStatusMemberDetail>(PATHS.member(memberId), {
    query: { date },
  });
}

/**
 * Export URL for the currently filtered set.
 *
 * Returns a path rather than fetching, so the browser can stream the file
 * directly. The active date, status filter and search term are all carried, so
 * the export matches what is on screen rather than exporting everything.
 */
export function dailyStatusExportPath(
  query: DailyStatusQuery & { format: "csv" | "xlsx" },
): string {
  assertEnabled("dailyStatusExportPath");
  const params = new URLSearchParams({ date: query.date, format: query.format });
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);
  return `${PATHS.export}?${params.toString()}`;
}
