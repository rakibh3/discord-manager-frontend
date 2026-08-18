import type { Metadata } from "next";
import { Suspense } from "react";

import { MemberTable } from "@/app/(dashboard)/dashboard/status/member-table";
import { StatusFilters } from "@/app/(dashboard)/dashboard/status/status-filters";
import {
  DAILY_STATUSES,
  RANGE_STATUSES,
} from "@/app/(dashboard)/dashboard/status/status-labels";
import { DailyStatusUnavailable } from "@/app/(dashboard)/dashboard/status/unavailable";
import { Skeleton } from "@/components/ui/skeleton";
import { getServersQuietly } from "@/lib/api/endpoints/discord";
import type {
  DailyStatus,
  DailyStatusSortBy,
  RangeStatus,
} from "@/lib/api/types";
import { DAILY_STATUS_ENABLED } from "@/lib/flags";
import { parsePeriod } from "@/lib/period";

export const metadata: Metadata = { title: "Member status" };

const RANGE_SORTS: DailyStatusSortBy[] = [
  "missedBothDays",
  "completeDays",
  "rangeStatus",
];

export default async function MembersPage({
  searchParams,
}: PageProps<"/dashboard/members">) {
  const params = await searchParams;

  const single = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  // One Asia/Dhaka day or a span of them — never the viewer's local day. The
  // two modes are mutually exclusive on the wire, so `parsePeriod` picks one.
  const period = parsePeriod({
    date: single(params.date),
    from: single(params.from),
    to: single(params.to),
    daysOfWeek: single(params.daysOfWeek),
  });

  const page = Math.max(1, Number.parseInt(single(params.page) ?? "1", 10) || 1);
  const search = single(params.search)?.trim() || undefined;
  const guildId = single(params.guildId) || undefined;

  // Each filter belongs to exactly one mode; passing the wrong one is a 400
  // rather than a filter that is accepted and silently does nothing.
  const rawStatus = single(params.status);
  const status =
    period.mode === "date" && DAILY_STATUSES.includes(rawStatus as DailyStatus)
      ? (rawStatus as DailyStatus)
      : undefined;

  const rawRangeStatus = single(params.rangeStatus);
  const rangeStatus =
    period.mode === "range" &&
    RANGE_STATUSES.includes(rawRangeStatus as RangeStatus)
      ? (rawRangeStatus as RangeStatus)
      : undefined;

  const rawThreshold = Number.parseInt(single(params.minMissedBothDays) ?? "", 10);
  const minMissedBothDays =
    period.mode === "range" && Number.isInteger(rawThreshold) && rawThreshold >= 1
      ? rawThreshold
      : undefined;

  const rawSort = single(params.sortBy) as DailyStatusSortBy | undefined;
  const sortBy =
    period.mode === "range" && rawSort && RANGE_SORTS.includes(rawSort)
      ? rawSort
      : undefined;
  const sortDir = single(params.sortDir) === "asc" ? "asc" : undefined;

  const servers = DAILY_STATUS_ENABLED ? await getServersQuietly() : [];

  const heading = (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold tracking-tight">Member status</h1>
      <p className="text-muted-foreground text-sm">
        Who submitted attendance and who posted a daily update, per Asia/Dhaka
        day. One row is one person, however many servers they are in.
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/*
        The flag is checked before anything reads. While it is off no request is
        issued at all, so the backend never sees a call to a route that does not
        exist — and nothing that looks like a metric is rendered.
      */}
      {!DAILY_STATUS_ENABLED ? (
        <>
          {heading}
          <DailyStatusUnavailable />
        </>
      ) : (
        <>
          <div className="bg-background sticky top-14 z-10 -mx-3 -mt-3 flex flex-col gap-3 border-b px-3 pt-3 pb-3 md:-mx-6 md:-mt-6 md:top-0 md:px-6 md:pt-6 md:pb-4">
            {heading}

            <StatusFilters
              period={period}
              servers={servers}
              guildId={guildId}
              status={status}
              rangeStatus={rangeStatus}
              minMissedBothDays={minMissedBothDays}
              search={search}
              exportEnabled
            />
          </div>

          <Suspense
            key={`${JSON.stringify(period)}|${guildId}|${status}|${rangeStatus}|${minMissedBothDays}|${search}|${sortBy}|${sortDir}|${page}`}
            fallback={<Skeleton className="h-96" />}
          >
            <MemberTable
              period={period}
              page={page}
              multiServer={servers.length > 1}
              filters={{
                guildId,
                status,
                rangeStatus,
                minMissedBothDays,
                search,
                sortBy,
                sortDir,
              }}
              basePath="/dashboard/members"
            />
          </Suspense>
        </>
      )}
    </div>
  );
}
