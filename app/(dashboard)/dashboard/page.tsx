import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { OutcomeChart } from "./reminders/outcome-chart";
import {
  DAILY_STATUS_COLOR,
  DAILY_STATUS_LABEL,
} from "./status/status-labels";
import { CHART_COLORS } from "@/components/viz/chart-tokens";
import { CompositionChart } from "@/components/viz/composition-chart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { getDailyStatusCounts } from "@/lib/api/endpoints/daily-status";
import { aggregateSyncState } from "@/lib/api/derive";
import { getSyncStatus } from "@/lib/api/endpoints/discord";
import { getHistory } from "@/lib/api/endpoints/reminders";
import { isRangeCounts, type DailyStatusCounts } from "@/lib/api/types";
import { dhakaToday, formatCivilDate, formatDhaka } from "@/lib/dhaka-date";
import { DAILY_STATUS_ENABLED } from "@/lib/flags";
import { datePeriod } from "@/lib/period";

export const metadata: Metadata = { title: "Overview" };

/** The overview: member composition, today's completion breakdown and recent
 *  broadcast outcomes, each from a live backend endpoint. */
async function MemberComposition() {
  const { members, servers } = await getSyncStatus();
  // Each server syncs on its own schedule; the combined reading names the
  // oldest thing on screen rather than implying one directory-wide run.
  const lastSync = aggregateSyncState(servers);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Member directory</CardTitle>
        <CardDescription>
          {lastSync.finishedAt
            ? `Last synced ${formatDhaka(lastSync.finishedAt)}.`
            : "No sync has run on this process yet."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CompositionChart
          total={members.total}
          totalLabel="Members on record"
          emptyMessage="No members synced yet."
          slices={[
            {
              label: "Active in the guild",
              value: members.active,
              color: CHART_COLORS.positive,
            },
            {
              label: "Departed",
              value: members.departed,
              color: CHART_COLORS.neutral,
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}

async function DailyCompletion() {
  const today = dhakaToday();
  let counts: DailyStatusCounts | null = null;
  try {
    const payload = await getDailyStatusCounts(datePeriod(today));
    // A single date always answers in date mode; anything else would be a
    // different unit (person-days) and must not be charted as these buckets.
    counts = isRangeCounts(payload) ? null : payload;
  } catch {
    counts = null;
  }

  if (!counts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today&rsquo;s completion</CardTitle>
          <CardDescription>
            {formatCivilDate(today)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Empty>
            <EmptyTitle>No data for today yet</EmptyTitle>
            <EmptyDescription>
              Check the daily analytics page for full breakdown.
            </EmptyDescription>
          </Empty>
          <Button variant="outline" size="sm" className="self-start" asChild>
            <Link href="/dashboard/status">
              View daily analytics
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const total = counts.totalMembers;
  const pct = total > 0 ? Math.round((counts.bothComplete / total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&rsquo;s completion</CardTitle>
        <CardDescription>
          {formatCivilDate(today)} &middot; {pct}% both complete
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <CompositionChart
          total={total}
          totalLabel="Members"
          emptyMessage="No members on record for today."
          slices={[
            {
              label: DAILY_STATUS_LABEL.COMPLETE,
              value: counts.bothComplete,
              color: DAILY_STATUS_COLOR.COMPLETE,
            },
            {
              label: DAILY_STATUS_LABEL.MISSING_UPDATE,
              value: counts.missingUpdateOnly,
              color: DAILY_STATUS_COLOR.MISSING_UPDATE,
            },
            {
              label: DAILY_STATUS_LABEL.MISSING_ATTENDANCE,
              value: counts.missingAttendanceOnly,
              color: DAILY_STATUS_COLOR.MISSING_ATTENDANCE,
            },
            {
              label: DAILY_STATUS_LABEL.MISSING_BOTH,
              value: counts.missingBoth,
              color: DAILY_STATUS_COLOR.MISSING_BOTH,
            },
          ]}
        />
        <Button variant="outline" size="sm" className="self-start" asChild>
          <Link href="/dashboard/status">
            View daily analytics
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

async function RecentBroadcasts() {
  const { data: rows } = await getHistory({ page: 1, limit: 8 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent broadcast outcomes</CardTitle>
        <CardDescription>
          Delivered, DMs closed and failed per broadcast date.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <Empty>
            <EmptyTitle>No broadcasts yet</EmptyTitle>
            <EmptyDescription>
              Once you send a reminder, its delivery outcomes appear here.
            </EmptyDescription>
          </Empty>
        ) : (
          <OutcomeChart rows={rows} />
        )}
        <Button variant="outline" size="sm" className="self-start" asChild>
          <Link href="/dashboard/reminders">
            Go to reminders
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-sm">
          Today at a glance.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <MemberComposition />
        </Suspense>

        {!DAILY_STATUS_ENABLED ? (
          <Card>
            <CardHeader>
              <CardTitle>Daily completion</CardTitle>
              <CardDescription>Not enabled.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Daily status metrics are currently disabled.
              </p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link href="/dashboard/status">
                  Go to status page
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Suspense fallback={<Skeleton className="h-64" />}>
            <DailyCompletion />
          </Suspense>
        )}
      </div>

      <Suspense fallback={<Skeleton className="h-80" />}>
        <RecentBroadcasts />
      </Suspense>
    </div>
  );
}
