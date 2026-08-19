"use client";

import { ReportsTable } from "./reports-table";
import type {
  ApiResponse,
  DiscordMismatchReportList,
  DiscordMismatchReportStatus,
} from "@/lib/api/types";

/** The Reports page is a single panel — heading + table. The filter bar
 *  (status, search, date range) lives inside `ReportsTable` to match the
 *  pattern `RosterTable` uses, so every dashboard list has its filters in
 *  the same place. */
export function ReportsView({
  reportsResponse,
  currentStatus,
  currentSearch,
  currentDateFrom,
  currentDateTo,
  currentPage,
  currentLimit,
}: {
  reportsResponse: ApiResponse<DiscordMismatchReportList>;
  currentStatus: DiscordMismatchReportStatus;
  currentSearch?: string;
  currentDateFrom?: string;
  currentDateTo?: string;
  currentPage: number;
  currentLimit: number;
}) {
  const total = reportsResponse.meta?.total ?? reportsResponse.data.total;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Discord pairing reports
          </h1>
          <p className="text-muted-foreground text-sm">
            Triage Discord pairing-mismatch reports filed from the attendance
            form. Reassign rewrites the entry&rsquo;s pairing to the submitted
            account; dismiss closes the report without changing the pairing.
          </p>
        </div>
      </div>

      <ReportsTable
        reports={reportsResponse.data.items}
        total={total}
        page={currentPage}
        limit={currentLimit}
        status={currentStatus}
        search={currentSearch}
        dateFrom={currentDateFrom}
        dateTo={currentDateTo}
      />
    </div>
  );
}
