import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { OutcomeChart } from "./reminders/outcome-chart";
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
import { getSyncStatus } from "@/lib/api/endpoints/discord";
import { getHistory } from "@/lib/api/endpoints/reminders";
import { formatDhaka } from "@/lib/dhaka-date";
import { DAILY_STATUS_ENABLED } from "@/lib/flags";

export const metadata: Metadata = { title: "Overview" };

/**
 * The overview.
 *
 * Charts here are built **only** from data the backend actually exposes today —
 * member directory composition and reminder broadcast outcomes. The PRD's
 * attendance-versus-update figures belong to the daily-status feature, which
 * has no HTTP surface; while that is off, this page shows a pointer to the
 * Status page rather than a plausible-looking placeholder metric.
 */
async function MemberComposition() {
  const { members, lastSync } = await getSyncStatus();

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
          System health and the data that exists today.
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
              <CardDescription>
                Not available yet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* No figure of any kind here — see app/(dashboard)/dashboard/status/unavailable.tsx. */}
              <p className="text-muted-foreground text-sm">
                Attendance-versus-update completion needs backend endpoints that
                do not exist yet, so no figure is shown rather than a placeholder
                one.
              </p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link href="/dashboard/status">
                  What this will show
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Suspense fallback={<Skeleton className="h-80" />}>
        <RecentBroadcasts />
      </Suspense>
    </div>
  );
}
