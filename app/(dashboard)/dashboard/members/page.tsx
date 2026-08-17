import type { Metadata } from "next";
import { Suspense } from "react";

import { MemberTable } from "@/app/(dashboard)/dashboard/status/member-table";
import { StatusFilters } from "@/app/(dashboard)/dashboard/status/status-filters";
import { DailyStatusUnavailable } from "@/app/(dashboard)/dashboard/status/unavailable";
import { Skeleton } from "@/components/ui/skeleton";
import type { DailyStatus } from "@/lib/api/types";
import { dhakaToday } from "@/lib/dhaka-date";
import { DAILY_STATUS_ENABLED } from "@/lib/flags";
import { DAILY_STATUSES } from "@/app/(dashboard)/dashboard/status/status-labels";

export const metadata: Metadata = { title: "Member status" };

export default async function MembersPage({
  searchParams,
}: PageProps<"/dashboard/members">) {
  const params = await searchParams;

  const single = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  // Selected day is an Asia/Dhaka civil date, defaulting to today in Dhaka —
  // never the viewer's local day.
  const date = single(params.date) ?? dhakaToday();
  const page = Math.max(1, Number.parseInt(single(params.page) ?? "1", 10) || 1);
  const rawStatus = single(params.status);
  const status = DAILY_STATUSES.includes(rawStatus as DailyStatus)
    ? (rawStatus as DailyStatus)
    : undefined;
  const search = single(params.search)?.trim() || undefined;

  return (
    <div className="flex flex-col gap-4">
      {/*
        The flag is checked before anything reads. While it is off no request is
        issued at all, so the backend never sees a call to a route that does not
        exist — and nothing that looks like a metric is rendered.
      */}
      {!DAILY_STATUS_ENABLED ? (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">Member status</h1>
            <p className="text-muted-foreground text-sm">
              Who submitted attendance and who posted a daily update, per Asia/Dhaka
              day.
            </p>
          </div>
          <DailyStatusUnavailable />
        </>
      ) : (
        <>
          <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-14 z-10 -mx-3 -mt-3 flex flex-col gap-3 border-b px-3 py-3 backdrop-blur md:-mx-6 md:-mt-6 md:px-6 md:py-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-semibold tracking-tight">Member status</h1>
              <p className="text-muted-foreground text-sm">
                Who submitted attendance and who posted a daily update, per Asia/Dhaka
                day.
              </p>
            </div>

            <StatusFilters
              date={date}
              status={status}
              search={search}
              exportEnabled
            />
          </div>

          <Suspense fallback={<Skeleton className="h-96" />}>
            <MemberTable
              date={date}
              page={page}
              status={status}
              search={search}
              basePath="/dashboard/members"
            />
          </Suspense>
        </>
      )}
    </div>
  );
}
