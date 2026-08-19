"use client";

import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  History,
  Info,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { OutcomeTile } from "./outcome-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RosterImportHistoryItem } from "@/lib/api/types";
import { formatDhaka } from "@/lib/dhaka-date";

export function ImportHistoryTable({
  imports,
  total,
  page,
  limit,
}: {
  imports: RosterImportHistoryItem[];
  total: number;
  page: number;
  limit: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [inspectItem, setInspectItem] =
    useState<RosterImportHistoryItem | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card overflow-hidden rounded-lg border">
        {imports.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No import history</EmptyTitle>
              <EmptyDescription>
                Past spreadsheet uploads and their audit logs appear here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>File</TableHead>
                  <TableHead>Uploaded by</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                  <TableHead className="text-right">Skipped</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((item) => {
                  const uploader = item.importedBy ?? item.uploadedBy;
                  const dateVal = item.importedAt ?? item.createdAt;
                  const inspectable =
                    (item.rejectedRows?.length ?? 0) > 0 ||
                    (item.duplicateAddresses?.length ?? 0) > 0;

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet
                            className="text-muted-foreground size-4 shrink-0"
                            aria-hidden
                          />
                          <span className="font-medium">{item.fileName}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {uploader ? (
                          <>
                            <span className="text-foreground block font-medium">
                              {uploader.name}
                            </span>
                            <span className="font-mono text-xs">
                              {uploader.email}
                            </span>
                          </>
                        ) : (
                          "System"
                        )}
                      </TableCell>

                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDhaka(dateVal)}
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        {item.totalRows.toLocaleString()}
                      </TableCell>

                      <TableCell className="text-success text-right font-medium tabular-nums">
                        {item.created.toLocaleString()}
                      </TableCell>

                      <TableCell className="text-info text-right font-medium tabular-nums">
                        {item.updated.toLocaleString()}
                      </TableCell>

                      <TableCell className="text-right">
                        {item.skipped > 0 ? (
                          <Badge variant="warning">
                            {item.skipped.toLocaleString()} skipped
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground tabular-nums">
                            0
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {inspectable ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setInspectItem(item)}
                          >
                            <Info data-icon="inline-start" aria-hidden />
                            Inspect
                          </Button>
                        ) : (
                          <span
                            className="text-muted-foreground"
                            aria-label="Nothing to inspect"
                          >
                            &mdash;
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {total > 0 ? (
          <nav
            aria-label="Import history pages"
            className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm"
          >
            <p>
              Showing {Math.min((page - 1) * limit + 1, total)} &ndash;{" "}
              {Math.min(page * limit, total)} of {total.toLocaleString()} import
              runs
            </p>

            <div className="flex items-center gap-2">
              <span className="font-medium">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                <ChevronLeft data-icon="inline-start" aria-hidden />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                Next
                <ChevronRight data-icon="inline-end" aria-hidden />
              </Button>
            </div>
          </nav>
        ) : null}
      </div>

      <Dialog
        open={Boolean(inspectItem)}
        onOpenChange={(open) => !open && setInspectItem(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {inspectItem ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="size-4" aria-hidden />
                  <span className="truncate">{inspectItem.fileName}</span>
                </DialogTitle>
                <DialogDescription>
                  Import audit for{" "}
                  {formatDhaka(inspectItem.importedAt ?? inspectItem.createdAt)}
                  .
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <OutcomeTile label="Total" value={inspectItem.totalRows} />
                  <OutcomeTile
                    label="Created"
                    value={inspectItem.created}
                    tone="success"
                  />
                  <OutcomeTile
                    label="Updated"
                    value={inspectItem.updated}
                    tone="info"
                  />
                  <OutcomeTile
                    label="Skipped"
                    value={inspectItem.skipped}
                    tone="warning"
                  />
                </div>

                {inspectItem.rejectedRows &&
                inspectItem.rejectedRows.length > 0 ? (
                  <section className="flex flex-col gap-2">
                    <h3 className="text-destructive flex items-center gap-1.5 text-sm font-medium">
                      <AlertCircle className="size-4" aria-hidden />
                      Rejected rows ({inspectItem.rejectedRows.length})
                    </h3>
                    <div className="max-h-48 overflow-y-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-20">Row</TableHead>
                            <TableHead>Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inspectItem.rejectedRows.map((row) => (
                            <TableRow key={`${row.rowNumber}-${row.reason}`}>
                              <TableCell className="text-muted-foreground font-mono text-xs">
                                {row.rowNumber}
                              </TableCell>
                              <TableCell className="text-destructive">
                                {row.reason}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                ) : null}

                {inspectItem.duplicateAddresses &&
                inspectItem.duplicateAddresses.length > 0 ? (
                  <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium">Duplicate addresses</h3>
                    <ul className="text-muted-foreground max-h-32 list-disc overflow-y-auto pl-5 text-sm">
                      {inspectItem.duplicateAddresses.map((dup) => (
                        <li key={dup.email}>
                          <code className="font-mono text-xs">{dup.email}</code>{" "}
                          on rows {dup.rowNumbers.join(", ")}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
