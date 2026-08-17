import Link from "next/link";

import { MemberDetail } from "./member-detail";
import { DAILY_STATUS_LABEL, statusBadgeVariant } from "./status-labels";
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
import { getDailyStatusPage } from "@/lib/api/endpoints/daily-status";
import type { DailyStatus } from "@/lib/api/types";

const PAGE_SIZE = 50;

/**
 * The member status table.
 *
 * Paginated on the **server**: a guild of several thousand members must never
 * arrive in one response, and the filter and search are applied server-side too
 * so `meta.total` reflects the filtered set rather than the whole guild.
 */
export async function MemberTable({
  date,
  page,
  status,
  search,
  basePath = "/dashboard/members",
}: {
  date: string;
  page: number;
  status: DailyStatus | undefined;
  search: string | undefined;
  basePath?: string;
}) {
  const { data: rows, meta } = await getDailyStatusPage({
    date,
    page,
    limit: PAGE_SIZE,
    status,
    search,
  });

  const total = meta?.total ?? rows.length;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const linkFor = (nextPage: number) => {
    const params = new URLSearchParams({ date });
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    if (nextPage > 1) params.set("page", String(nextPage));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          {total.toLocaleString()} member{total === 1 ? "" : "s"} match
          {total === 1 ? "es" : ""} the current filters.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <Empty>
            <EmptyTitle>No members match</EmptyTitle>
            <EmptyDescription>
              Try a different status, a different date, or clear the search.
            </EmptyDescription>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Discord username</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Update</TableHead>
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
                    <TableCell>
                      <Badge variant={statusBadgeVariant(row.status)}>
                        {DAILY_STATUS_LABEL[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.hasAttendance ? "Yes" : "No"}</TableCell>
                    <TableCell>{row.hasDailyUpdate ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right">
                      <MemberDetail
                        memberId={row.memberId}
                        date={date}
                        label={
                          row.name ?? row.displayName ?? row.discordUsername
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {lastPage > 1 ? (
          <nav
            aria-label="Member pages"
            className="flex items-center justify-between gap-3"
          >
            <p className="text-muted-foreground text-sm">
              Page {page} of {lastPage}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
                {page > 1 ? (
                  <Link href={linkFor(page - 1)}>Previous</Link>
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
                  <Link href={linkFor(page + 1)}>Next</Link>
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
