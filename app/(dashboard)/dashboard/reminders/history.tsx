import Link from "next/link";

import { OutcomeChart } from "./outcome-chart";
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
import { getHistory } from "@/lib/api/endpoints/reminders";
import type { ReminderStatus } from "@/lib/api/types";
import { formatCivilDate, formatDhaka } from "@/lib/dhaka-date";
import { BROADCAST_STATUS_LABEL } from "@/lib/reminder-labels";

const PAGE_SIZE = 10;

function statusVariant(
  status: ReminderStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "COMPLETED":
      return "secondary";
    case "FAILED":
      return "destructive";
    case "PROCESSING":
    case "PENDING":
      return "default";
    case "CANCELLED":
      return "outline";
  }
}

export async function BroadcastHistory({ page }: { page: number }) {
  const { data: rows, meta } = await getHistory({
    page,
    limit: PAGE_SIZE,
  });

  const total = meta?.total ?? rows.length;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Broadcast history</CardTitle>
        <CardDescription>
          Newest first. {total.toLocaleString()} broadcast
          {total === 1 ? "" : "s"} on record.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {rows.length === 0 ? (
          <Empty>
            <EmptyTitle>No broadcasts yet</EmptyTitle>
            <EmptyDescription>
              Reminders you send will be listed here with their delivery
              outcomes.
            </EmptyDescription>
          </Empty>
        ) : (
          <>
            <OutcomeChart rows={rows} />

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Targets</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead>Sent by</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {formatCivilDate(row.reminderDate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(row.status)}>
                          {BROADCAST_STATUS_LABEL[row.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.targetCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.sentCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.failedCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {/* The audit row deliberately outlives the admin
                            account, so a null creator is expected — not a bug
                            and not "undefined". */}
                        {row.createdBy?.name ?? (
                          <span className="text-muted-foreground italic">
                            Unattributed
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDhaka(row.completedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/reminders/${row.id}`}>
                            Details
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {lastPage > 1 ? (
              <nav
                aria-label="Broadcast history pages"
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
                      <Link href={`/dashboard/reminders?page=${page - 1}`}>
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
                      <Link href={`/dashboard/reminders?page=${page + 1}`}>
                        Next
                      </Link>
                    ) : (
                      <span>Next</span>
                    )}
                  </Button>
                </div>
              </nav>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
