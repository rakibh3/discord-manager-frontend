import type { Metadata } from "next";

import { ReportsView } from "./reports-view";
import { listDiscordMismatchReports } from "@/lib/api/endpoints/discord-mismatch-reports";
import type {
  ApiResponse,
  DiscordMismatchReportList,
  DiscordMismatchReportStatus,
} from "@/lib/api/types";

export const metadata: Metadata = { title: "Discord pairing reports" };

const STATUS_OPTIONS: DiscordMismatchReportStatus[] = [
  "open",
  "reassigned",
  "dismissed",
];

const FALLBACK_RESPONSE: ApiResponse<DiscordMismatchReportList> = {
  success: false,
  statusCode: 500,
  data: { items: [], total: 0 },
  meta: { page: 1, limit: 50, total: 0 },
};

export default async function MismatchReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const single = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  const rawStatus = single(params.status);
  const status: DiscordMismatchReportStatus = STATUS_OPTIONS.includes(
    rawStatus as DiscordMismatchReportStatus,
  )
    ? (rawStatus as DiscordMismatchReportStatus)
    : "open";

  const search = single(params.search)?.trim() || undefined;
  const dateFrom = single(params.dateFrom) || undefined;
  const dateTo = single(params.dateTo) || undefined;
  const page = Math.max(
    1,
    Number.parseInt(single(params.page) ?? "1", 10) || 1,
  );
  const limit = 50;

  // The dashboard segment-level error boundary catches thrown errors, but a
  // temporary backend outage should still render the empty state rather than
  // a partial page — matching the pattern used by `roster/page.tsx`.
  const reportsRes = await listDiscordMismatchReports({
    status,
    search,
    dateFrom,
    dateTo,
    page,
    limit,
  }).catch(() => FALLBACK_RESPONSE);

  return (
    <ReportsView
      reportsResponse={reportsRes}
      currentStatus={status}
      currentSearch={search}
      currentDateFrom={dateFrom}
      currentDateTo={dateTo}
      currentPage={page}
      currentLimit={limit}
    />
  );
}
