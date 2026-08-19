import type { Metadata } from "next";
import { Suspense } from "react";

import { RosterStatusFilters } from "./filters";
import { RosterStatusOverview } from "./overview";
import { RosterStatusTable } from "./table";
import { Skeleton } from "@/components/ui/skeleton";
import { getServersQuietly } from "@/lib/api/endpoints/discord";
import type {
  RosterPairingState,
  RosterStatus,
  RosterStatusSortBy,
} from "@/lib/api/types";
import { parsePeriod } from "@/lib/period";

export const metadata: Metadata = { title: "Roster engagement" };

const PAIRING_STATES = new Set<RosterPairingState>(["all", "paired", "unpaired"]);
const STATUSES = new Set<RosterStatus>([
  "COMPLETE",
  "MISSING_UPDATE",
  "MISSING_ATTENDANCE",
  "MISSING_BOTH",
  "NEVER_LINKED",
]);
const SORT_BY = new Set<RosterStatusSortBy>(["name", "email", "status", "linkedAt"]);

export default async function RosterStatusPage({
  searchParams,
}: PageProps<"/dashboard/roster/status">) {
  const params = await searchParams;

  const single = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  const period = parsePeriod({
    date: single(params.date),
    from: single(params.from),
    to: single(params.to),
    daysOfWeek: single(params.daysOfWeek),
  });

  const rawPairing = single(params.pairingState);
  const pairingState: RosterPairingState = PAIRING_STATES.has(rawPairing as RosterPairingState)
    ? (rawPairing as RosterPairingState)
    : "all";

  const rawStatus = single(params.status);
  const status = STATUSES.has(rawStatus as RosterStatus)
    ? (rawStatus as RosterStatus)
    : undefined;

  const search = single(params.search)?.trim() || undefined;
  const rawSortBy = single(params.sortBy);
  const sortBy = SORT_BY.has(rawSortBy as RosterStatusSortBy)
    ? (rawSortBy as RosterStatusSortBy)
    : undefined;
  const rawSortDir = single(params.sortDir);
  const sortDir = rawSortDir === "desc" ? "desc" : rawSortDir === "asc" ? "asc" : undefined;
  const page = Math.max(1, Number.parseInt(single(params.page) ?? "1", 10) || 1);

  // The roster is global, so there is no `guildId` filter. Server membership
  // is shown as badges when the deployment has more than one configured server.
  const servers = await getServersQuietly();
  const multiServer = servers.length > 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Roster engagement</h1>
        <p className="text-muted-foreground text-sm">
          Who that we enrolled is doing the work, measured against the enrolment
          roster (not Discord membership). The denominator here differs from
          Daily Analytics on purpose.
        </p>
      </div>

      <RosterStatusFilters
        period={period}
        pairingState={pairingState}
        status={status}
        search={search}
        exportEnabled
      />

      <Suspense
        key={`overview|${JSON.stringify(period)}`}
        fallback={<Skeleton className="h-96" />}
      >
        <RosterStatusOverview period={period} />
      </Suspense>

      <Suspense
        key={`table|${JSON.stringify(period)}|${pairingState}|${status}|${search}|${sortBy}|${sortDir}|${page}`}
        fallback={<Skeleton className="h-72" />}
      >
        <RosterStatusTable
          period={period}
          page={page}
          filters={{
            pairingState,
            status,
            search,
            sortBy,
            sortDir,
          }}
          multiServer={multiServer}
        />
      </Suspense>
    </div>
  );
}