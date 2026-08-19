"use client";

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { actOnMismatchReport } from "@/actions/discord-mismatch-reports";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  DiscordMismatchReport,
  DiscordMismatchReportStatus,
} from "@/lib/api/types";
import { formatCivilDate, formatDhaka } from "@/lib/dhaka-date";

const FILTER_STATUS_LABEL: Record<DiscordMismatchReportStatus, string> = {
  open: "Open only",
  reassigned: "Reassigned only",
  dismissed: "Dismissed only",
};

type ActTarget = {
  report: DiscordMismatchReport;
  action: "reassign" | "dismiss";
};

/** The dashboard's list-and-act surface for §8.6B discord pairing-mismatch
 *  reports. Mirrors `RosterTable`: filter bar drives the URL, the table
 *  renders paginated rows, and a single `AlertDialog` confirms the only
 *  state-changing action (reassign or dismiss). */
export function ReportsTable({
  reports,
  total,
  page,
  limit,
  status: initialStatus = "open",
  search: initialSearch,
  dateFrom: initialDateFrom,
  dateTo: initialDateTo,
}: {
  reports: DiscordMismatchReport[];
  total: number;
  page: number;
  limit: number;
  status?: DiscordMismatchReportStatus;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statusId = useId();
  const searchId = useId();
  const dateFromId = useId();
  const dateToId = useId();

  const [pending, startTransition] = useTransition();
  const [actingTarget, setActingTarget] = useState<ActTarget | null>(null);

  const [searchInput, setSearchInput] = useState(initialSearch ?? "");
  const [dateFromInput, setDateFromInput] = useState(initialDateFrom ?? "");
  const [dateToInput, setDateToInput] = useState(initialDateTo ?? "");

  // Keep the inputs in step with the URL — including browser back/forward,
  // which changes the prop without remounting the component.
  const [seenSearch, setSeenSearch] = useState(initialSearch);
  if (seenSearch !== initialSearch) {
    setSeenSearch(initialSearch);
    setSearchInput(initialSearch ?? "");
  }
  const [seenDateFrom, setSeenDateFrom] = useState(initialDateFrom);
  if (seenDateFrom !== initialDateFrom) {
    setSeenDateFrom(initialDateFrom);
    setDateFromInput(initialDateFrom ?? "");
  }
  const [seenDateTo, setSeenDateTo] = useState(initialDateTo);
  if (seenDateTo !== initialDateTo) {
    setSeenDateTo(initialDateTo);
    setDateToInput(initialDateTo ?? "");
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const updateQueryParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleApply = (event: React.FormEvent) => {
    event.preventDefault();
    updateQueryParams({
      search: searchInput.trim() || null,
      dateFrom: dateFromInput || null,
      dateTo: dateToInput || null,
      page: "1",
    });
  };

  const handleClearAll = () => {
    setSearchInput("");
    setDateFromInput("");
    setDateToInput("");
    updateQueryParams({
      search: null,
      dateFrom: null,
      dateTo: null,
      page: "1",
    });
  };

  const handleClearSearch = () => {
    setSearchInput("");
    updateQueryParams({ search: null, page: "1" });
  };

  const handleStatusChange = (newStatus: string) => {
    updateQueryParams({
      status: newStatus as DiscordMismatchReportStatus,
      page: "1",
    });
  };

  const handlePageChange = (newPage: number) => {
    updateQueryParams({ page: String(newPage) });
  };

  const confirmAct = () => {
    if (!actingTarget) return;
    startTransition(async () => {
      const res = await actOnMismatchReport(
        actingTarget.report.id,
        actingTarget.action,
      );
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(
          actingTarget.action === "reassign"
            ? "Could not reassign report"
            : "Could not dismiss report",
          { description: res.message },
        );
      }
      setActingTarget(null);
    });
  };

  const hasActiveFilters =
    Boolean(initialSearch) ||
    Boolean(initialDateFrom) ||
    Boolean(initialDateTo) ||
    initialStatus !== "open";

  return (
    <div className="flex flex-col gap-4">
      {/*
        Filter bar — same labelled `Field` row as `RosterTable` and
        `StatusFilters` so the dashboard's three list screens all look like
        one product. The status `Select` updates the URL on change; the
        search/date inputs share a form so they only refetch when the user
        clicks Apply.
      */}
      <form
        onSubmit={handleApply}
        className="flex flex-wrap items-end gap-2.5"
      >
        <Field className="w-full sm:w-48">
          <FieldLabel htmlFor={statusId} className="text-xs font-medium">
            Status
          </FieldLabel>
          <Select
            value={initialStatus}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger id={statusId} className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {(
                  Object.keys(FILTER_STATUS_LABEL) as DiscordMismatchReportStatus[]
                ).map((value) => (
                  <SelectItem key={value} value={value}>
                    {FILTER_STATUS_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field className="w-full sm:w-72">
          <FieldLabel htmlFor={searchId} className="text-xs font-medium">
            Search
          </FieldLabel>
          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id={searchId}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Student name or email"
              className="px-8 text-xs"
            />
            {searchInput ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="absolute top-1/2 right-1 -translate-y-1/2"
              >
                <X aria-hidden />
              </Button>
            ) : null}
          </div>
        </Field>

        <Field className="w-full sm:w-40">
          <FieldLabel htmlFor={dateFromId} className="text-xs font-medium">
            From
          </FieldLabel>
          <Input
            id={dateFromId}
            type="date"
            value={dateFromInput}
            onChange={(e) => setDateFromInput(e.target.value)}
            className="text-xs"
            aria-describedby={`${dateFromId}-hint`}
          />
        </Field>

        <Field className="w-full sm:w-40">
          <FieldLabel htmlFor={dateToId} className="text-xs font-medium">
            To
          </FieldLabel>
          <Input
            id={dateToId}
            type="date"
            value={dateToInput}
            onChange={(e) => setDateToInput(e.target.value)}
            className="text-xs"
          />
        </Field>

        <div className="flex items-end gap-2 pb-1">
          <Button type="submit" size="sm" variant="outline">
            Apply
          </Button>
          {hasActiveFilters ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleClearAll}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </form>

      <div className="bg-card overflow-hidden rounded-lg border">
        {reports.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AlertTriangle aria-hidden />
              </EmptyMedia>
              <EmptyTitle>
                {hasActiveFilters
                  ? "No reports match these filters"
                  : initialStatus === "open"
                    ? "No open reports"
                    : initialStatus === "reassigned"
                      ? "No reassigned reports"
                      : "No dismissed reports"}
              </EmptyTitle>
              <EmptyDescription>
                {initialSearch
                  ? `Nothing matches "${initialSearch}". Try a different search term.`
                  : initialStatus === "open"
                    ? "When a student ticks \"I cannot enter my real Discord username\" on the attendance form, their mismatch report lands here."
                    : initialStatus === "reassigned"
                      ? "Reports you reassign appear here for audit."
                      : "Reports you dismiss appear here for audit."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-56">Student</TableHead>
                  <TableHead>Pairing → Submitted</TableHead>
                  <TableHead>Filed for</TableHead>
                  <TableHead>Reported</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => {
                  const isOpen = report.status === "open";
                  return (
                    <TableRow key={report.id}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="truncate font-medium">
                            {report.entryName}
                          </span>
                          <span className="text-muted-foreground font-mono text-xs">
                            {report.entryEmail}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-muted-foreground font-mono text-xs">
                            @{report.pairedDiscordUsername}
                            {report.pairedDisplayName
                              ? ` (${report.pairedDisplayName})`
                              : ""}
                          </span>
                          <span className="flex items-center gap-1 font-mono text-xs">
                            <ChevronRight
                              aria-hidden
                              className="text-muted-foreground size-3 -rotate-90"
                            />
                            @{report.submittingDiscordUsername}
                            {report.submittingDisplayName
                              ? ` (${report.submittingDisplayName})`
                              : ""}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatCivilDate(report.submissionDhakaDate)}
                      </TableCell>

                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDhaka(report.reportedAt, "datetime")}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={report.status} />
                      </TableCell>

                      <TableCell className="text-right">
                        {isOpen ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() =>
                                setActingTarget({
                                  report,
                                  action: "reassign",
                                })
                              }
                              aria-label={`Reassign ${report.entryName}'s pairing`}
                            >
                              <UserCheck aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                setActingTarget({
                                  report,
                                  action: "dismiss",
                                })
                              }
                              aria-label={`Dismiss ${report.entryName}'s report`}
                            >
                              <CircleX aria-hidden />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Closed
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
            aria-label="Result pages"
            className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm"
          >
            <p>
              Showing {Math.min((page - 1) * limit + 1, total)} &ndash;{" "}
              {Math.min(page * limit, total)} of {total.toLocaleString()}{" "}
              report{total === 1 ? "" : "s"}
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

      <AlertDialog
        open={Boolean(actingTarget)}
        onOpenChange={(open) => !open && setActingTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {actingTarget?.action === "reassign" ? (
                <UserCheck className="size-4" aria-hidden />
              ) : (
                <CircleX className="size-4" aria-hidden />
              )}
              {actingTarget?.action === "reassign"
                ? "Reassign this report?"
                : "Dismiss this report?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actingTarget
                ? actingTarget.action === "reassign"
                  ? `Update ${actingTarget.report.entryName}'s Discord pairing to @${actingTarget.report.submittingDiscordUsername}. The open report will be closed and the student's next submission will be matched against this account.`
                  : `Close this report without changing ${actingTarget.report.entryName}'s pairing. The recorded Discord username remains @${actingTarget.report.pairedDiscordUsername}.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={confirmAct}>
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              {actingTarget?.action === "reassign"
                ? "Reassign pairing"
                : "Dismiss report"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: DiscordMismatchReportStatus;
}) {
  if (status === "open") {
    return (
      <Badge variant="warning">
        <AlertTriangle data-icon="inline-start" aria-hidden />
        Open
      </Badge>
    );
  }
  if (status === "reassigned") {
    return (
      <Badge variant="success">
        <UserCheck data-icon="inline-start" aria-hidden />
        Reassigned
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <CircleX data-icon="inline-start" aria-hidden />
      Dismissed
    </Badge>
  );
}