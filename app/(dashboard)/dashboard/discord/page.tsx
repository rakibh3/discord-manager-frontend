import { CheckCircle2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ServerPanels } from "./server-panels";
import { SyncControl } from "./sync-control";
import { CHART_COLORS } from "@/components/viz/chart-tokens";
import { CompositionChart } from "@/components/viz/composition-chart";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { aggregateSyncState } from "@/lib/api/derive";
import { getSyncStatus } from "@/lib/api/endpoints/discord";
import { formatDhaka, formatDuration } from "@/lib/dhaka-date";

export const metadata: Metadata = { title: "Discord" };

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-mono text-sm font-medium tabular-nums">{value}</dd>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

async function BotPanel() {
  const status = await getSyncStatus();
  const { bot } = status;
  // Sync state is reported per server and has no combined form on the wire, so
  // the headline reading is derived — the per-server detail is in ServerPanels.
  const lastSync = aggregateSyncState(status.servers);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Bot connection
          <Badge variant={bot.connected ? "secondary" : "destructive"}>
            {bot.connected ? (
              <CheckCircle2 data-icon="inline-start" />
            ) : (
              <XCircle data-icon="inline-start" />
            )}
            {bot.connected ? "Connected" : "Disconnected"}
          </Badge>
        </CardTitle>
        <CardDescription>
          The gateway connection. The REST API keeps serving even when this is
          down, which is why an outage here is easy to miss.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Stat label="Bot tag" value={bot.tag ?? "—"} />
          <Stat
            label="Servers reachable"
            value={`${bot.reachableServers} of ${bot.configuredServers}`}
            hint={
              bot.reachableServers < bot.configuredServers
                ? "A server the bot cannot reach records nothing, while the others look healthy."
                : undefined
            }
          />
        </dl>
        <SyncControl initial={status} botConnected={bot.connected} />
        {lastSync.lastError ? (
          <p className="text-destructive text-sm">
            Last sync reported: {lastSync.lastError}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

async function MembersPanel() {
  const { members } = await getSyncStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Member directory</CardTitle>
        <CardDescription>
          Counted across every configured server. Departed members are kept
          rather than deleted, so their past attendance and daily updates stay
          attributable.
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

async function LastSyncPanel() {
  const { servers } = await getSyncStatus();
  // Summed across servers: each syncs independently, so "fetched" here is the
  // total work done, not one run's figure.
  const lastSync = aggregateSyncState(servers);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Last sync</CardTitle>
        <CardDescription>
          {lastSync.running
            ? "A sync is running now — these counts are still climbing."
            : lastSync.finishedAt
              ? `Finished ${formatDhaka(lastSync.finishedAt)}.`
              : "No sync has run on this process since it started."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Stat label="Started" value={formatDhaka(lastSync.startedAt, "time")} />
          <Stat
            label="Duration"
            value={formatDuration(lastSync.durationMs)}
          />
          <Stat
            label="Fetched from Discord"
            value={lastSync.fetched.toLocaleString()}
          />
          <Stat
            label="Written to the directory"
            value={lastSync.synced.toLocaleString()}
          />
          <Stat
            label="Marked departed"
            value={lastSync.markedDeparted.toLocaleString()}
            hint={
              lastSync.guardTripped
                ? "The departure guard skipped this step."
                : undefined
            }
          />
          <Stat
            label="Failed"
            value={lastSync.failed.toLocaleString()}
            hint={lastSync.failed > 0 ? "See the error below." : undefined}
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function PanelSkeleton({ className }: { className?: string }) {
  return <Skeleton className={className ?? "h-64"} />;
}

export default function DiscordPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Discord</h1>
        <p className="text-muted-foreground text-sm">
          Bot health and the member directory that every other feature reads
          from, per configured server.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<PanelSkeleton className="h-72" />}>
          <BotPanel />
        </Suspense>
        <Suspense fallback={<PanelSkeleton className="h-72" />}>
          <MembersPanel />
        </Suspense>
      </div>

      <Suspense fallback={<PanelSkeleton className="h-56" />}>
        <ServerPanels />
      </Suspense>

      <Suspense fallback={<PanelSkeleton className="h-56" />}>
        <LastSyncPanel />
      </Suspense>
    </div>
  );
}
