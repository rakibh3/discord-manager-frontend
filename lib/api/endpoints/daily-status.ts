import "server-only";

import { api, apiRequest } from "@/lib/api/client";
import type {
  ApiResponse,
  DailyStatusAnyCounts,
  DailyStatusAnyMemberDetail,
  DailyStatusQuery,
  DailyStatusRow,
} from "@/lib/api/types";
import { periodQuery, periodSearchParams, type Period } from "@/lib/period";

/** Daily status endpoints (`API_INTEGRATION.md` §8.8, §5A): counts, paginated
 *  list, per-member detail and CSV export.
 *
 *  Every one of them answers in one of two modes — a single Dhaka `date`, or a
 *  `from`/`to` span — and returns a different payload shape for each. The two
 *  are mutually exclusive on the wire, so callers pass a `Period` and
 *  `lib/period.ts` decides which parameters are sent. */
const PATHS = {
  counts: "/daily-status/counts",
  page: "/daily-status",
  member: (memberId: string) => `/daily-status/members/${memberId}`,
  export: "/daily-status/export",
} as const;

export type DailyStatusListOptions = Omit<
  DailyStatusQuery,
  "date" | "from" | "to"
>;

/** `GET /api/daily-status/counts` — the overview figures. In date mode these
 *  are the seven single-day counts of **people**; in range mode they are the
 *  rollup buckets plus person-day totals, named differently on purpose.
 *
 *  ⚠️ `byServer` never sums to the combined totals: the combined figures count
 *  people, `byServer` counts memberships. The gap is the overlap between servers. */
export function getDailyStatusCounts(
  period: Period,
  options: { guildId?: string } = {},
): Promise<DailyStatusAnyCounts> {
  return api<DailyStatusAnyCounts>(PATHS.counts, {
    query: { ...periodQuery(period), guildId: options.guildId },
  });
}

/** `GET /api/daily-status` — server-paginated list, one row per **person**
 *  rather than per server membership. Filters combine (AND) and `meta.total` is
 *  post-filter. `status` is date-mode only and `rangeStatus` /
 *  `minMissedBothDays` are range-mode only; the wrong one for the mode is a 400
 *  rather than a filter that silently does nothing. */
export function getDailyStatusPage(
  period: Period,
  options: DailyStatusListOptions = {},
): Promise<ApiResponse<DailyStatusRow[]>> {
  return apiRequest<DailyStatusRow[]>(PATHS.page, {
    query: {
      ...periodQuery(period),
      guildId: options.guildId,
      page: options.page,
      limit: options.limit,
      status: options.status,
      rangeStatus: options.rangeStatus,
      minMissedBothDays: options.minMissedBothDays,
      search: options.search,
      sortBy: options.sortBy,
      sortDir: options.sortDir,
    },
  });
}

/** `GET /api/daily-status/members/:memberId` — the whole **person**, whichever
 *  server's member record the id names. `messages` merges every server's
 *  messages into one timeline, each tagged with where it was posted; range mode
 *  adds a `days` array with one entry per counted day. */
export function getDailyStatusMember(
  memberId: string,
  period: Period,
): Promise<DailyStatusAnyMemberDetail> {
  return api<DailyStatusAnyMemberDetail>(PATHS.member(memberId), {
    query: periodQuery(period),
  });
}

/** `GET /api/daily-status/export` — returns a path so the browser or route
 *  handler can stream the CSV directly. The export gains a leading `servers`
 *  column, and names the server in the filename when one is filtered. */
export function dailyStatusExportPath(
  period: Period,
  options: DailyStatusListOptions & { format: "csv" | "xlsx" },
): string {
  const params = new URLSearchParams({
    ...periodSearchParams(period),
    format: options.format,
  });
  if (options.guildId) params.set("guildId", options.guildId);
  if (options.status) params.set("status", options.status);
  if (options.rangeStatus) params.set("rangeStatus", options.rangeStatus);
  if (options.minMissedBothDays !== undefined) {
    params.set("minMissedBothDays", String(options.minMissedBothDays));
  }
  if (options.search) params.set("search", options.search);
  // Comma-joined to match the listing convention (`periodQuery` joins with
  // "," too). Range-mode only — an admin who narrowed the dashboard by
  // weekday exports the unfiltered CSV without this.
  if (options.daysOfWeek && options.daysOfWeek.length > 0) {
    params.set("daysOfWeek", options.daysOfWeek.join(","));
  }
  return `${PATHS.export}?${params.toString()}`;
}
