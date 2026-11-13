"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  GraduationCap,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { deactivateEntry, restoreEntry } from "@/actions/roster";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RosterEntry, RosterStatusFilter } from "@/lib/api/types";
import { formatDhaka } from "@/lib/dhaka-date";

const STATUS_LABEL: Record<RosterStatusFilter, string> = {
  active: "Active only",
  inactive: "Deactivated only",
  all: "All records",
};

export function RosterTable({
  entries,
  total,
  page,
  limit,
  search: initialSearch,
  status: initialStatus = "active",
  onEdit,
}: {
  entries: RosterEntry[];
  total: number;
  page: number;
  limit: number;
  search?: string;
  status?: RosterStatusFilter;
  onEdit: (entry: RosterEntry) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statusId = useId();
  const searchId = useId();

  const [pending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<RosterEntry | null>(
    null,
  );
  const [restoreTarget, setRestoreTarget] = useState<RosterEntry | null>(null);

  const [searchInput, setSearchInput] = useState(initialSearch ?? "");

  // Keep the input in step with the URL — including a back navigation, which
  // changes `initialSearch` without remounting.
  const [seenSearch, setSeenSearch] = useState(initialSearch);
  if (seenSearch !== initialSearch) {
    setSeenSearch(initialSearch);
    setSearchInput(initialSearch ?? "");
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQueryParams({ search: searchInput.trim() || null, page: "1" });
  };

  const handleClearSearch = () => {
    setSearchInput("");
    updateQueryParams({ search: null, page: "1" });
  };

  const handleStatusChange = (newStatus: string) => {
    updateQueryParams({ status: newStatus as RosterStatusFilter, page: "1" });
  };

  const handlePageChange = (newPage: number) => {
    updateQueryParams({ page: String(newPage) });
  };

  const handleCopyEmail = async (email: string, id: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedId(id);
      toast.success("Email copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy email");
    }
  };

  const confirmDeactivate = () => {
    if (!deactivateTarget) return;
    startTransition(async () => {
      const res = await deactivateEntry(deactivateTarget.id);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error("Could not deactivate student", {
          description: res.message,
        });
      }
      setDeactivateTarget(null);
    });
  };

  const confirmRestore = () => {
    if (!restoreTarget) return;
    startTransition(async () => {
      const res = await restoreEntry(restoreTarget.id);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error("Could not restore student", { description: res.message });
      }
      setRestoreTarget(null);
    });
  };

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      {/* Filters — same labelled `Field` row the daily-status screens use, so
       *  the two filter bars in this app do not look like different products. */}
      <div className="flex flex-wrap items-end gap-2.5">
        <Field className="w-full sm:w-48">
          <FieldLabel htmlFor={statusId} className="text-xs font-medium">
            Enrolment status
          </FieldLabel>
          <Select value={initialStatus} onValueChange={handleStatusChange}>
            <SelectTrigger id={statusId} className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {(
                  Object.keys(STATUS_LABEL) as RosterStatusFilter[]
                ).map((value) => (
                  <SelectItem key={value} value={value}>
                    {STATUS_LABEL[value]}
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
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id={searchId}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name or email"
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
          </form>
        </Field>

        <p className="text-muted-foreground pb-1.5 text-sm">
          {total.toLocaleString()} student{total === 1 ? "" : "s"}
        </p>
      </div>

      <div className="bg-card overflow-hidden rounded-lg border">
        {entries.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <GraduationCap aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No students found</EmptyTitle>
              <EmptyDescription>
                {initialSearch
                  ? `No roster records match "${initialSearch}". Try a different search term.`
                  : initialStatus === "inactive"
                    ? "There are no deactivated student records."
                    : "No students in the enrolment roster yet. Import a spreadsheet to populate it."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-64">Student</TableHead>
                  <TableHead>Enrolment email</TableHead>
                  <TableHead>Discord username</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-7">
                          <AvatarFallback className="text-xs">
                            {initials(entry.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate font-medium">
                          {entry.name}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{entry.email}</span>
                        {/* Always rendered, never hover-revealed: a control that
                         *  only exists on hover is unreachable by keyboard and
                         *  invisible on touch. */}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleCopyEmail(entry.email, entry.id)}
                          aria-label={`Copy ${entry.email}`}
                        >
                          {copiedId === entry.id ? (
                            <Check className="text-success" aria-hidden />
                          ) : (
                            <Copy aria-hidden />
                          )}
                        </Button>
                      </div>
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {entry.discordUsername ? (
                        <span className="font-mono text-xs">
                          @{entry.discordUsername}
                        </span>
                      ) : entry.discordUserId ? (
                        <span className="text-xs">Paired account left the server</span>
                      ) : (
                        <span aria-label="No Discord username paired">&mdash;</span>
                      )}
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {entry.phone ? (
                        <span className="font-mono text-xs">{entry.phone}</span>
                      ) : (
                        <span aria-label="No phone number">&mdash;</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {entry.isActive ? (
                        <Badge variant="success">
                          <UserCheck data-icon="inline-start" aria-hidden />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <UserX data-icon="inline-start" aria-hidden />
                          Deactivated
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDhaka(entry.updatedAt, "date")}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onEdit(entry)}
                          aria-label={`Edit ${entry.name}`}
                        >
                          <Pencil aria-hidden />
                        </Button>

                        {entry.isActive ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeactivateTarget(entry)}
                            aria-label={`Deactivate ${entry.name}`}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-success hover:text-success hover:bg-success/10"
                            onClick={() => setRestoreTarget(entry)}
                            aria-label={`Restore ${entry.name}`}
                          >
                            <RotateCcw aria-hidden />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
              students
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
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserX className="size-4" aria-hidden />
              Deactivate this student?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget?.name} ({deactivateTarget?.email}) will no
              longer be able to submit attendance while the email verification
              gate is armed.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <p className="text-muted-foreground text-sm">
            This is reversible and keeps the student&rsquo;s history.
          </p>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={confirmDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate student
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(restoreTarget)}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="size-4" aria-hidden />
              Restore this student?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Reinstating {restoreTarget?.name} ({restoreTarget?.email}) re-enables
              attendance submissions for them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={confirmRestore}>
              Restore enrolment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
