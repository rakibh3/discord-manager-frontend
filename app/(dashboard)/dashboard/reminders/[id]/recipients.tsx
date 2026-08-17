import Link from "next/link";

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
import { getRecipients } from "@/lib/api/endpoints/reminders";
import type { ReminderDeliveryStatus } from "@/lib/api/types";
import { formatDhaka } from "@/lib/dhaka-date";
import { DELIVERY_STATUS_LABEL } from "@/lib/reminder-labels";

const PAGE_SIZE = 50;

const FILTERS: { value: ReminderDeliveryStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "DM_CLOSED", label: "DMs closed" },
  { value: "FAILED", label: "Failed" },
  { value: "PENDING", label: "Not attempted" },
];

function badgeVariant(
  status: ReminderDeliveryStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "DELIVERED":
      return "secondary";
    case "FAILED":
      return "destructive";
    case "DM_CLOSED":
      return "default";
    case "PENDING":
      return "outline";
  }
}

/**
 * The delivery audit.
 *
 * Contact details are deliberately absent — the backend does not expose phone
 * or email on this endpoint, because this is a record of what was delivered,
 * not a member directory.
 */
export async function RecipientAudit({
  id,
  page,
  status,
}: {
  id: string;
  page: number;
  status: ReminderDeliveryStatus | undefined;
}) {
  const { data: rows, meta } = await getRecipients(id, {
    page,
    limit: PAGE_SIZE,
    status,
  });

  const total = meta?.total ?? rows.length;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const linkFor = (next: { page?: number; status?: string }) => {
    const params = new URLSearchParams();
    const nextStatus = next.status ?? status;
    if (nextStatus && nextStatus !== "ALL") params.set("status", nextStatus);
    const nextPage = next.page ?? page;
    if (nextPage > 1) params.set("page", String(nextPage));
    const query = params.toString();
    return `/dashboard/reminders/${id}${query ? `?${query}` : ""}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recipients</CardTitle>
        <CardDescription>
          {total.toLocaleString()} recipient{total === 1 ? "" : "s"}
          {status ? ` with status ${DELIVERY_STATUS_LABEL[status]}` : ""}.
          Sorted by Discord username.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <nav aria-label="Filter by delivery outcome" className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const active =
              filter.value === "ALL" ? status === undefined : status === filter.value;
            return (
              <Button
                key={filter.value}
                variant={active ? "default" : "outline"}
                size="sm"
                aria-current={active ? "true" : undefined}
                asChild
              >
                <Link href={linkFor({ status: filter.value, page: 1 })}>
                  {filter.label}
                </Link>
              </Button>
            );
          })}
        </nav>

        {rows.length === 0 ? (
          <Empty>
            <EmptyTitle>No recipients match this filter</EmptyTitle>
            <EmptyDescription>
              Try a different delivery outcome.
            </EmptyDescription>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Discord username</TableHead>
                  <TableHead>Display name</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {row.member.discordUsername}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.member.displayName ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant(row.status)}>
                        {DELIVERY_STATUS_LABEL[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate text-xs">
                      {row.errorMessage ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDhaka(row.sentAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {lastPage > 1 ? (
          <nav
            aria-label="Recipient pages"
            className="flex items-center justify-between gap-3"
          >
            <p className="text-muted-foreground text-sm">
              Page {page} of {lastPage}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
                {page > 1 ? (
                  <Link href={linkFor({ page: page - 1 })}>Previous</Link>
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
                  <Link href={linkFor({ page: page + 1 })}>Next</Link>
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
