import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";

import { MemberDetail } from "./member-detail";
import {
  DAILY_STATUS_LABEL,
  RANGE_STATUS_LABEL,
  rangeStatusBadgeVariant,
  statusBadgeVariant,
} from "./status-labels";
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
  getDailyStatusPage,
  type DailyStatusListOptions,
} from "@/lib/api/endpoints/daily-status";
import { isRangeRow, type DailyStatusSortBy } from "@/lib/api/types";
import { countedDays, periodSearchParams, type Period } from "@/lib/period";

const PAGE_SIZE = 50;

/** A sortable range column header. Clicking the active column flips the
 *  direction, which is the only way to ask "who is closest to done" as well as
 *  "who is worst". Declared at module scope so it is one component rather than a
 *  new one on every render. */
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

/** The member table, paginated, filtered and searched on the **server**, so
 *  `meta.total` reflects the filtered set rather than the whole directory.
 *
 *  Every row is one **person**: someone in two servers has one row, one day's
 *  work and one reminder. Rows are never merged or split here — the API already
 *  did it, and doing it again in the client would double-count the overlap. */
export async function MemberTable({
  period,
  page,
  filters,
  basePath = "/dashboard/members",
  multiServer,
}: {
  period: Period;
  page: number;
  filters: DailyStatusListOptions;
  basePath?: string;
  multiServer: boolean;
}) {
  const { data: rows, meta } = await getDailyStatusPage(period, {
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
      ...(filters.guildId ? { guildId: filters.guildId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.rangeStatus ? { rangeStatus: filters.rangeStatus } : {}),
      ...(filters.minMissedBothDays !== undefined
        ? { minMissedBothDays: String(filters.minMissedBothDays) }
        : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.sortBy ? { sortBy: filters.sortBy } : {}),
      ...(filters.sortDir ? { sortDir: filters.sortDir } : {}),
      ...(page > 1 ? { page: String(page) } : {}),
    });
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) params.delete(key);
      else params.set(key, value);
    }
    return `${basePath}?${params.toString()}`;
  };

  const sortDirection = (column: DailyStatusSortBy): "asc" | "desc" =>
    filters.sortBy === column && filters.sortDir === "asc" ? "asc" : "desc";

  /** Clicking the active column flips it; a new column starts descending,
   *  because "who is worst" is the question this table is opened to answer. */
  const sortHref = (column: DailyStatusSortBy) =>
    linkWith({
      sortBy: column,
      sortDir: sortDirection(column) === "desc" ? "asc" : "desc",
      page: undefined,
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isRange ? "People" : "Members"}</CardTitle>
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
              Try a different status, a different period, or clear the search.
            </EmptyDescription>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Discord username</TableHead>
                  <TableHead>Name</TableHead>
                  {multiServer ? <TableHead>Servers</TableHead> : null}
                  {isRange ? (
                    <>
                      <TableHead>Across the range</TableHead>
                      <SortableHead
                        href={sortHref("completeDays")}
                        active={filters.sortBy === "completeDays"}
                        direction={sortDirection("completeDays")}
                      >
                        Complete
                      </SortableHead>
                      {/* Shown next to the threshold control on purpose: this is
                          the figure the reminder send acts on. */}
                      <SortableHead
                        href={sortHref("missedBothDays")}
                        active={filters.sortBy === "missedBothDays"}
                        direction={sortDirection("missedBothDays")}
                      >
                        Missed both
                      </SortableHead>
                      <TableHead className="text-right">Incomplete</TableHead>
                      <TableHead className="text-right">No update</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Status</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead>Update</TableHead>
                    </>
                  )}
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.memberId}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {row.discordUsername}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.name ?? row.displayName ?? (
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

                    {isRangeRow(row) ? (
                      <>
                        <TableCell>
                          <Badge variant={rangeStatusBadgeVariant(row.rangeStatus)}>
                            {RANGE_STATUS_LABEL[row.rangeStatus]}
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
                          {row.missedUpdateDays.toLocaleString()}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(row.status)}>
                            {DAILY_STATUS_LABEL[row.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.hasAttendance ? "Yes" : "No"}</TableCell>
                        <TableCell>{row.hasDailyUpdate ? "Yes" : "No"}</TableCell>
                      </>
                    )}

                    <TableCell className="text-right">
                      <MemberDetail
                        memberId={row.memberId}
                        period={period}
                        label={row.name ?? row.displayName ?? row.discordUsername}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {isRange ? (
          // The two look interchangeable and are not; someone who files
          // attendance daily and never posts has incompleteDays = every day and
          // missedBothDays = 0. Saying so where both columns are visible.
          <p className="text-muted-foreground text-xs">
            <strong>Missed both</strong> counts days with neither submission —
            it is what a reminder threshold acts on. <strong>Incomplete</strong>{" "}
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
