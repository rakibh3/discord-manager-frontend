"use client";

import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  MailCheck,
  MailWarning,
  RefreshCw,
  Search,
  Send,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addToRoster,
  resendRegistrationEmail,
  retryUnsentEmails,
} from "@/actions/registration";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  Registration,
  RegistrationSettings,
  RegistrationStatusFilter,
  WelcomeEmailStatus,
  WelcomeEmailStatusFilter,
} from "@/lib/api/types";
import { formatDhaka } from "@/lib/dhaka-date";

const STATUS_LABEL: Record<RegistrationStatusFilter, string> = {
  all: "Everyone",
  ENROLLED: "On the roster",
  PENDING: "Waiting to be added",
};

const EMAIL_STATUS_LABEL: Record<WelcomeEmailStatusFilter, string> = {
  all: "Any email status",
  SENT: "Sent",
  PENDING: "Queued",
  FAILED: "Failed",
  SKIPPED: "Not sent",
};

export function RegistrationsTable({
  registrations,
  total,
  page,
  limit,
  search: initialSearch,
  status,
  emailStatus,
  counts,
  emailActionsBlockedReason,
}: {
  registrations: Registration[];
  total: number;
  page: number;
  limit: number;
  search?: string;
  status: RegistrationStatusFilter;
  emailStatus: WelcomeEmailStatusFilter;
  counts: RegistrationSettings["counts"];
  /** Why a welcome email cannot be queued right now, or `null`. */
  emailActionsBlockedReason: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statusId = useId();
  const emailStatusId = useId();
  const searchId = useId();

  const [pending, startTransition] = useTransition();
  const [confirmRetryOpen, setConfirmRetryOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(initialSearch ?? "");

  // Keep the input in step with the URL — including a back navigation, which
  // changes `initialSearch` without remounting.
  const [seenSearch, setSeenSearch] = useState(initialSearch);
  if (seenSearch !== initialSearch) {
    setSeenSearch(initialSearch);
    setSearchInput(initialSearch ?? "");
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const unsentEmails = counts.emailPending + counts.emailFailed;
  const emailsBlocked = emailActionsBlockedReason !== null;

  const updateQueryParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  // The export carries the filters on screen, so the file matches the list.
  const exportParams = new URLSearchParams();
  if (initialSearch) exportParams.set("search", initialSearch);
  if (status !== "all") exportParams.set("status", status);
  if (emailStatus !== "all") exportParams.set("emailStatus", emailStatus);
  const exportHref = `/api/registrations/export${
    exportParams.size > 0 ? `?${exportParams.toString()}` : ""
  }`;

  const run = (
    action: () => Promise<{ ok: boolean; message: string }>,
    failureTitle: string,
  ) => {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(failureTitle, { description: result.message });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex flex-wrap items-end gap-2.5">
          <Field className="w-full sm:w-44">
            <FieldLabel htmlFor={statusId} className="text-xs font-medium">
              Roster
            </FieldLabel>
            <Select
              value={status}
              onValueChange={(value) =>
                updateQueryParams({ status: value, page: "1" })
              }
            >
              <SelectTrigger id={statusId} className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(
                    Object.keys(STATUS_LABEL) as RegistrationStatusFilter[]
                  ).map((value) => (
                    <SelectItem key={value} value={value}>
                      {STATUS_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field className="w-full sm:w-44">
            <FieldLabel htmlFor={emailStatusId} className="text-xs font-medium">
              Welcome email
            </FieldLabel>
            <Select
              value={emailStatus}
              onValueChange={(value) =>
                updateQueryParams({ emailStatus: value, page: "1" })
              }
            >
              <SelectTrigger id={emailStatusId} className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(
                    Object.keys(
                      EMAIL_STATUS_LABEL,
                    ) as WelcomeEmailStatusFilter[]
                  ).map((value) => (
                    <SelectItem key={value} value={value}>
                      {EMAIL_STATUS_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field className="w-full sm:w-64">
            <FieldLabel htmlFor={searchId} className="text-xs font-medium">
              Search
            </FieldLabel>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                updateQueryParams({
                  search: searchInput.trim() || null,
                  page: "1",
                });
              }}
              className="relative"
            >
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                aria-hidden
              />
              <Input
                id={searchId}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Name, email, phone or username"
                className="px-8 text-xs"
              />
              {searchInput ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setSearchInput("");
                    updateQueryParams({ search: null, page: "1" });
                  }}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                >
                  <X aria-hidden />
                </Button>
              ) : null}
            </form>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pending || counts.pending === 0}
            onClick={() =>
              run(() => addToRoster(), "Could not add to the roster")
            }
          >
            <UserPlus data-icon="inline-start" aria-hidden />
            Add all waiting to roster ({counts.pending.toLocaleString()})
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || unsentEmails === 0 || emailsBlocked}
            title={emailActionsBlockedReason ?? undefined}
            onClick={() => setConfirmRetryOpen(true)}
          >
            <RefreshCw data-icon="inline-start" aria-hidden />
            Retry unsent emails ({unsentEmails.toLocaleString()})
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={exportHref}>
              <Download data-icon="inline-start" aria-hidden />
              Export CSV
            </a>
          </Button>
        </div>
      </div>

      {/* The reason the email buttons are off, in words — a `title` alone is
       *  invisible on touch and to keyboard users. */}
      {emailsBlocked && unsentEmails > 0 ? (
        <p className="text-muted-foreground text-sm">
          {unsentEmails.toLocaleString()} welcome email
          {unsentEmails === 1 ? " has" : "s have"} not been sent.{" "}
          {emailActionsBlockedReason}
        </p>
      ) : null}

      <div className="bg-card overflow-hidden rounded-lg border">
        {registrations.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClipboardList aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No registrations found</EmptyTitle>
              <EmptyDescription>
                {initialSearch || status !== "all" || emailStatus !== "all"
                  ? "No registrations match these filters."
                  : "Nobody has registered yet. Registrations appear here as soon as the form is submitted."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-52">Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Discord username</TableHead>
                  <TableHead>Roster</TableHead>
                  <TableHead>Welcome email</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.map((registration) => (
                  <TableRow key={registration.id}>
                    <TableCell className="font-medium">
                      {registration.name}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {registration.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {registration.phone}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-mono text-xs">
                          @{registration.discordUsername}
                        </span>
                        {registration.linked ? (
                          <Badge variant="success">Linked</Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            title="Linked automatically when this username joins a server"
                          >
                            Not joined Discord
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {registration.status === "ENROLLED" ? (
                        <Badge variant="success">
                          <UserCheck data-icon="inline-start" aria-hidden />
                          On the roster
                        </Badge>
                      ) : (
                        <Badge variant="warning">Waiting</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <EmailStatusCell registration={registration} />
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDhaka(registration.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {registration.status === "PENDING" ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () => addToRoster([registration.id]),
                                "Could not add to the roster",
                              )
                            }
                            aria-label={`Add ${registration.name} to the roster`}
                          >
                            <UserPlus aria-hidden />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={pending || emailsBlocked}
                          title={emailActionsBlockedReason ?? undefined}
                          onClick={() =>
                            run(
                              () => resendRegistrationEmail(registration.id),
                              "Could not send the welcome email",
                            )
                          }
                          aria-label={`${registration.welcomeEmailStatus === "SENT" ? "Resend" : "Send"} the welcome email to ${registration.name}`}
                        >
                          <Send aria-hidden />
                        </Button>
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
              registrations
            </p>

            <div className="flex items-center gap-2">
              <span className="font-medium">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateQueryParams({ page: String(page - 1) })}
              >
                <ChevronLeft data-icon="inline-start" aria-hidden />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => updateQueryParams({ page: String(page + 1) })}
              >
                Next
                <ChevronRight data-icon="inline-end" aria-hidden />
              </Button>
            </div>
          </nav>
        ) : null}
      </div>

      {/* A bulk send reaches real inboxes, so it is confirmed with the number
       *  it will reach. Adding to the roster is not confirmed: it is
       *  create-only and changes nobody who is already there. */}
      <AlertDialog open={confirmRetryOpen} onOpenChange={setConfirmRetryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Send {unsentEmails.toLocaleString()} welcome email
              {unsentEmails === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This queues the welcome email for every registration whose email
              is still queued or has failed. Each address is emailed once.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                setConfirmRetryOpen(false);
                run(retryUnsentEmails, "Could not retry the welcome emails");
              }}
            >
              <Send data-icon="inline-start" aria-hidden />
              Send {unsentEmails.toLocaleString()} email
              {unsentEmails === 1 ? "" : "s"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const EMAIL_BADGE: Record<
  WelcomeEmailStatus,
  { label: string; variant: "success" | "secondary" | "destructive" | "outline" }
> = {
  SENT: { label: "Sent", variant: "success" },
  PENDING: { label: "Queued", variant: "secondary" },
  FAILED: { label: "Failed", variant: "destructive" },
  SKIPPED: { label: "Not sent", variant: "outline" },
};

function EmailStatusCell({ registration }: { registration: Registration }) {
  const { label, variant } = EMAIL_BADGE[registration.welcomeEmailStatus];

  return (
    <div className="flex max-w-64 flex-col gap-1">
      <Badge variant={variant}>
        {registration.welcomeEmailStatus === "SENT" ? (
          <MailCheck data-icon="inline-start" aria-hidden />
        ) : registration.welcomeEmailStatus === "FAILED" ? (
          <MailWarning data-icon="inline-start" aria-hidden />
        ) : null}
        {label}
      </Badge>
      {/* The reason is shown, not hidden behind a hover: it is what tells the
       *  admin whether to fix the config or the address. */}
      {registration.welcomeEmailStatus === "FAILED" &&
      registration.welcomeEmailError ? (
        <p className="text-destructive text-xs whitespace-normal">
          {registration.welcomeEmailError}
        </p>
      ) : null}
      {registration.welcomeEmailStatus === "SENT" &&
      registration.welcomeEmailSentAt ? (
        <p className="text-muted-foreground text-xs">
          {formatDhaka(registration.welcomeEmailSentAt)}
        </p>
      ) : null}
    </div>
  );
}
