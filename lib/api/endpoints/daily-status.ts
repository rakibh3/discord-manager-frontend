import "server-only";

import { api, apiRequest } from "@/lib/api/client";
import type {
  ApiResponse,
  DailyStatusCounts,
  DailyStatusMember,
  DailyStatusMemberDetail,
  DailyStatusQuery,
} from "@/lib/api/types";

/**
 * Daily Status API Endpoints (`/api/daily-status`)
 *
 * Fully integrated reference implementation as documented in `API_INTEGRATION.md` §8.8
 * and `postman-collection.json`.
 *
 * Endpoints:
 * - `GET /api/daily-status/counts?date=YYYY-MM-DD`
 * - `GET /api/daily-status?date=YYYY-MM-DD&page=1&limit=50&status=&search=`
 * - `GET /api/daily-status/members/:memberId?date=YYYY-MM-DD`
 * - `GET /api/daily-status/export?date=YYYY-MM-DD&status=&search=&format=csv`
 */
const PATHS = {
  counts: "/daily-status/counts",
  page: "/daily-status",
  member: (memberId: string) => `/daily-status/members/${memberId}`,
  export: "/daily-status/export",
} as const;

/**
 * The seven overview figures for a given Asia/Dhaka civil date.
 *
 * `GET /api/daily-status/counts?date=YYYY-MM-DD`
 *
 * Invariant: `bothComplete + missingUpdateOnly + missingAttendanceOnly + missingBoth === totalMembers`.
 */
export function getDailyStatusCounts(date: string): Promise<DailyStatusCounts> {
  return api<DailyStatusCounts>(PATHS.counts, { query: { date } });
}

/**
 * Server-paginated active member list and daily completion status.
 *
 * `GET /api/daily-status?date=YYYY-MM-DD&page=1&limit=50&status=&search=`
 *
 * Filter (`status`) and search combine into one request. `meta.total` reflects
 * the filtered row count.
 */
export function getDailyStatusPage(
  query: DailyStatusQuery,
): Promise<ApiResponse<DailyStatusMember[]>> {
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

/**
 * One member's contact details, attendance time, and posted `#daily-update` messages.
 *
 * `GET /api/daily-status/members/:memberId?date=YYYY-MM-DD`
 */
export function getDailyStatusMember(
  memberId: string,
  date: string,
): Promise<DailyStatusMemberDetail> {
  return api<DailyStatusMemberDetail>(PATHS.member(memberId), {
    query: { date },
  });
}

/**
 * Export URL for the currently filtered daily status set.
 *
 * `GET /api/daily-status/export?date=YYYY-MM-DD&status=&search=&format=csv`
 *
 * Returns a path so the browser or route handler can stream the CSV directly.
 */
export function dailyStatusExportPath(
  query: DailyStatusQuery & { format: "csv" | "xlsx" },
): string {
  const params = new URLSearchParams({ date: query.date, format: query.format });
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);
  return `${PATHS.export}?${params.toString()}`;
}
