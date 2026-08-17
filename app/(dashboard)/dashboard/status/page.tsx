import type { Metadata } from "next";
import { Suspense } from "react";

import { DateFilter } from "./date-filter";
import { StatusOverview } from "./status-overview";
import { StatusTrend } from "./status-trend";
import { DailyStatusUnavailable } from "./unavailable";
import { Skeleton } from "@/components/ui/skeleton";
import { dhakaToday } from "@/lib/dhaka-date";
import { DAILY_STATUS_ENABLED } from "@/lib/flags";

export const metadata: Metadata = { title: "Daily analytics" };

export default async function StatusPage({
  searchParams,
}: PageProps<"/dashboard/status">) {
  const params = await searchParams;

  const single = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  // Selected day is an Asia/Dhaka civil date, defaulting to today in Dhaka.
  const date = single(params.date) ?? dhakaToday();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Daily analytics</h1>
        <p className="text-muted-foreground text-sm">
          Completion figures, daily status breakdown and 7-day trends across
          the guild (Asia/Dhaka).
        </p>
      </div>

      {/*
        The flag is checked before anything reads. While it is off no request is
        issued at all, so the backend never sees a call to a route that does not
        exist — and nothing that looks like a metric is rendered.
      */}
      {!DAILY_STATUS_ENABLED ? (
        <DailyStatusUnavailable />
      ) : (
        <>
          <DateFilter date={date} />

          <Suspense fallback={<Skeleton className="h-96" />}>
            <StatusOverview date={date} />
          </Suspense>

          <Suspense fallback={<Skeleton className="h-72" />}>
            <StatusTrend date={date} />
          </Suspense>
        </>
      )}
    </div>
  );
}
