import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";

import { ServerBadges } from "@/components/dashboard/server-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ROSTER_RANGE_STATUS_LABEL,
  ROSTER_RANGE_STATUSES,
  ROSTER_STATUS_LABEL,
  ROSTER_STATUSES,
  rosterRangeStatusBadgeVariant,
  rosterStatusBadgeVariant,
} from "./status-labels";
import {
  getRosterStatusPage,
  type RosterStatusListOptions,
} from "@/lib/api/endpoints/roster";
import {
  isRosterRangeEntry,
  type RosterPairingState,
  type RosterRangeStatus,
  type RosterStatus,
  type RosterStatusSortBy,
} from "@/lib/api/types";
import { countedDays, periodSearchParams, type Period } from "@/lib/period";

const PAGE_SIZE = 50;

function SortableHead({
  href,
  active,
  direction,
  children,
}: {
  href: string;
  active: boolean;
  direction: "asc" | "desc";
  children: React.ReactNode;
}) {
  return (
    <TableHead
      className="text-right"
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <Link
        href={href}
        className="hover:text-foreground inline-flex items-center gap-1"
      >
        {children}
        {active ? (
          direction === "asc" ? (
            <ArrowUp aria-hidden className="size-3.5" />
          ) : (
            <ArrowDown aria-hidden className="size-3.5" />
          )
        ) : null}
      </Link>
    </TableHead>
  );
}

/** One row per enrolled person. Unpaired enrollees have a `null` Discord
 *  identity and read `NEVER_LINKED`; paired enrollees read one of the four
 *  date-mode buckets, or `ALL_COMPLETE`/`PARTIAL`/`NONE` for a range. */
export async function RosterStatusTable({
  period,
  page,
  filters,
  multiServer,
}: {
  period: Period;
  page: number;
  filters: RosterStatusListOptions;
  multiServer: boolean;
}) {
  const { data: rows, meta } = await getRosterStatusPage(period, {
    ...filters,
    page,
    limit: PAGE_SIZE,
  });

  const total = meta?.total ?? rows.length;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isRange = period.mode === "range";
  const counted = countedDays(period);

  const linkWith = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams({
      ...periodSearchParams(period),
      ...(filters.pairingState && filters.pairingState !== "all"
        ? { pairingState: filters.pairingState }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.sortBy ? { sortBy: filters.sortBy } : {}),
      ...(filters.sortDir ? { sortDir: filters.sortDir } : {}),
      ...(page > 1 ? { page: String(page) } : {}),
    });
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) params.delete(key);
      else params.set(key, value);
    }
    // This view lives on the Member status page; `view` keeps it selected.
    params.set("view", "enrolled");
    return `/dashboard/members?${params.toString()}`;
  };

  const sortDirection = (column: RosterStatusSortBy): "asc" | "desc" =>
    filters.sortBy === column && filters.sortDir === "asc" ? "asc" : "desc";

  const sortHref = (column: RosterStatusSortBy) =>
    linkWith({
      sortBy: column,
      sortDir: sortDirection(column) === "desc" ? "asc" : "desc",
      page: undefined,
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enrolments</CardTitle>
        <CardDescription>
          {total.toLocaleString()} {total === 1 ? "person" : "people"} match
          {total === 1 ? "es" : ""} the current filters.
          {isRange
            ? ` Counts are out of ${counted.toLocaleString()} counted day${counted === 1 ? "" : "s"}.`
            : null}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <Empty>
            <EmptyTitle>Nobody matches</EmptyTitle>
            <EmptyDescription>
              Try a different status, pairing filter, or clear the search.
            </EmptyDescription>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Discord</TableHead>
                  {multiServer ? <TableHead>Servers</TableHead> : null}
                  {isRange ? (
                    <>
                      <TableHead>Across the range</TableHead>
                      <SortableHead
                        href={sortHref("name")}
                        active={filters.sortBy === "name"}
                        direction={sortDirection("name")}
                      >
                        Name
                      </SortableHead>
                      <SortableHead
                        href={sortHref("email")}
                        active={filters.sortBy === "email"}
                        direction={sortDirection("email")}
                      >
                        Email
                      </SortableHead>
                      <SortableHead
                        href={sortHref("status")}
                        active={filters.sortBy === "status"}
                        direction={sortDirection("status")}
                      >
                        Status
                      </SortableHead>
                      <SortableHead
                        href={sortHref("linkedAt")}
                        active={filters.sortBy === "linkedAt"}
                        direction={sortDirection("linkedAt")}
                      >
                        Linked
                      </SortableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Status</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead>Update</TableHead>
                      <TableHead>Active</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.entryId}>
                    <TableCell className="whitespace-nowrap">
                      <span className="font-medium">{row.name}</span>
                      {row.phone ? (
                        <span className="text-muted-foreground block text-xs">
                          {row.phone}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {row.email}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.discordUsername ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {multiServer ? (
                      <TableCell>
                        <ServerBadges
                          servers={row.servers}
                          serverCount={row.serverCount}
                        />
                      </TableCell>
                    ) : null}

                    {isRosterRangeEntry(row) ? (
                      <>
                        <TableCell>
                          <Badge
                            variant={rosterRangeStatusBadgeVariant(
                              row.rangeStatus,
                            )}
                          >
                            {ROSTER_RANGE_STATUS_LABEL[row.rangeStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {row.completeDays.toLocaleString()}
                          <span className="text-muted-foreground">
                            /{row.daysInRange.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {row.missedBothDays.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {row.incompleteDays.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {row.linkedAt ? (
                            new Date(row.linkedAt).toLocaleDateString()
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          <Badge
                            variant={rosterStatusBadgeVariant(row.status)}
                          >
                            {ROSTER_STATUS_LABEL[row.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.hasAttendance ? "Yes" : "No"}</TableCell>
                        <TableCell>{row.hasDailyUpdate ? "Yes" : "No"}</TableCell>
                        <TableCell>
                          {row.isActive ? (
                            <Badge variant="secondary">Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {isRange ? (
          <p className="text-muted-foreground text-xs">
            <strong>Missed both</strong> counts days with neither submission —
            the figure a reminder threshold acts on. <strong>Incomplete</strong>{" "}
            counts days that were not fully done, which includes attendance
            without an update. They are different numbers.
          </p>
        ) : null}

        {lastPage > 1 ? (
          <nav
            aria-label="Result pages"
            className="flex items-center justify-between gap-3"
          >
            <p className="text-muted-foreground text-sm">
              Page {page} of {lastPage}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                asChild={page > 1}
              >
                {page > 1 ? (
                  <Link
                    href={linkWith({
                      page: page - 1 > 1 ? String(page - 1) : undefined,
                    })}
                  >
                    Previous
                  </Link>
                ) : (
                  <span>Previous</span>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= lastPage}
                asChild={page < lastPage}
              >
                {page < lastPage ? (
                  <Link href={linkWith({ page: String(page + 1) })}>Next</Link>
                ) : (
                  <span>Next</span>
                )}
              </Button>
            </div>
          </nav>
        ) : null}
      </CardContent>
    </Card>
  );
}

// Re-export the status arrays for callers building the filter selects.
export { ROSTER_STATUSES, ROSTER_RANGE_STATUSES };
export type { RosterStatus, RosterRangeStatus, RosterPairingState };