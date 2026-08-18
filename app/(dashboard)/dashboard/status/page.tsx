import type { Metadata } from "next";
import { Suspense } from "react";

import { PeriodFilter } from "./period-filter";
import { ServerFilter } from "./server-filter";
import { StatusOverview } from "./status-overview";
import { StatusTrend } from "./status-trend";
import { DailyStatusUnavailable } from "./unavailable";
import { Skeleton } from "@/components/ui/skeleton";
import { getServersQuietly } from "@/lib/api/endpoints/discord";
import { DAILY_STATUS_ENABLED } from "@/lib/flags";
import { parsePeriod } from "@/lib/period";

export const metadata: Metadata = { title: "Daily analytics" };

export default async function StatusPage({
  searchParams,
}: PageProps<"/dashboard/status">) {
  const params = await searchParams;

  const single = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  // One Asia/Dhaka day, or an inclusive span of them. Never the viewer's day.
  const period = parsePeriod({
    date: single(params.date),
    from: single(params.from),
    to: single(params.to),
    daysOfWeek: single(params.daysOfWeek),
  });

  const guildId = single(params.guildId) || undefined;
  const servers = DAILY_STATUS_ENABLED ? await getServersQuietly() : [];
  const multiServer = servers.length > 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Daily analytics</h1>
        <p className="text-muted-foreground text-sm">
          Completion figures and trends across every configured server
          (Asia/Dhaka). Figures count people, so someone in two servers counts
          once.
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
          <div className="flex flex-col gap-3">
            <PeriodFilter period={period} />
            <ServerFilter servers={servers} guildId={guildId} />
          </div>

          <Suspense
            key={`${JSON.stringify(period)}|${guildId}`}
            fallback={<Skeleton className="h-96" />}
          >
            <StatusOverview
              period={period}
              guildId={guildId}
              showByServer={multiServer && !guildId}
            />
          </Suspense>

          <Suspense
            key={`trend|${JSON.stringify(period)}|${guildId}`}
            fallback={<Skeleton className="h-72" />}
          >
            <StatusTrend period={period} guildId={guildId} />
          </Suspense>
        </>
      )}
    </div>
  );
}
