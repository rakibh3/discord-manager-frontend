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
import type { Period } from "@/lib/period";

const PAIRING_STATES = new Set<RosterPairingState>(["all", "paired", "unpaired"]);
const STATUSES = new Set<RosterStatus>([
  "COMPLETE",
  "MISSING_UPDATE",
  "MISSING_ATTENDANCE",
  "MISSING_BOTH",
  "NEVER_LINKED",
]);
const SORT_BY = new Set<RosterStatusSortBy>(["name", "email", "status", "linkedAt"]);

/** The "Enrolled students" view of Member status: one row per registered
 *  student (name, email, phone), measured against the roster rather than
 *  Discord membership — so a student who registered but has not joined yet is
 *  listed here as "Not joined Discord". Formerly the Roster engagement page. */
export async function EnrolledView({
  period,
  params,
}: {
  period: Period;
  params: Record<string, string | string[] | undefined>;
}) {
  const single = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  const rawPairing = single(params.pairingState);
  const pairingState: RosterPairingState = PAIRING_STATES.has(
    rawPairing as RosterPairingState,
  )
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
  const sortDir =
    rawSortDir === "desc" ? "desc" : rawSortDir === "asc" ? "asc" : undefined;
  const page = Math.max(1, Number.parseInt(single(params.page) ?? "1", 10) || 1);

  // The roster is global, so there is no `guildId` filter. Server membership
  // is shown as badges when the deployment has more than one configured server.
  const servers = await getServersQuietly();

  return (
    <>
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
          filters={{ pairingState, status, search, sortBy, sortDir }}
          multiServer={servers.length > 1}
        />
      </Suspense>
    </>
  );
}
