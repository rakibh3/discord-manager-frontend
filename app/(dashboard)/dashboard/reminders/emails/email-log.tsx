"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  MailX,
  Search,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { loadEmailEvents, type EmailEventsResult } from "@/actions/reminders";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  EmailLogState,
  ReminderEmailCounts,
  ReminderEmailRow,
} from "@/lib/api/types";
import { formatCivilDate, formatDhaka } from "@/lib/dhaka-date";
import {
  EMAIL_EVENT_LABEL,
  EMAIL_LOG_STATES,
  EMAIL_STATE_DESCRIPTION,
  EMAIL_STATE_LABEL,
  EMAIL_STATE_VARIANT,
} from "@/lib/reminder-labels";

type Filters = {
  reminderId?: string;
  states: EmailLogState[];
  from?: string;
  to?: string;
  search?: string;
};

type BroadcastOption = {
  id: string;
  start: string;
  end: string;
  createdAt: string;
};

const ALL = "all";

const periodText = (start: string, end: string) =>
  start === end
    ? formatCivilDate(start)
    : `${formatCivilDate(start)} – ${formatCivilDate(end)}`;

export function EmailLog({
  rows,
  counts,
  total,
  page,
  limit,
  loadError,
  filters,
  broadcasts,
}: {
  rows: ReminderEmailRow[];
  counts: ReminderEmailCounts;
  total: number;
  page: number;
  limit: number;
  loadError: string | null;
  filters: Filters;
  broadcasts: BroadcastOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, startNavigation] = useTransition();

  const broadcastId = useId();
  const fromId = useId();
  const toId = useId();
  const searchId = useId();

  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [seenSearch, setSeenSearch] = useState(filters.search);
  if (seenSearch !== filters.search) {
    setSeenSearch(filters.search);
    setSearchInput(filters.search ?? "");
  }

  const [eventsFor, setEventsFor] = useState<ReminderEmailRow | null>(null);
  const [events, setEvents] = useState<EmailEventsResult | null>(null);
  const [loadingEvents, startEvents] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const filtered =
    filters.states.length > 0 ||
    Boolean(filters.reminderId || filters.from || filters.to || filters.search);

  const update = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === ALL) params.delete(key);
      else params.set(key, value);
    }
    // Any filter change returns to the first page.
    if (!("page" in updates)) params.delete("page");
    startNavigation(() => router.push(`${pathname}?${params.toString()}`));
  };

  /** Chips toggle: several states may be selected at once (OR-ed). */
  const toggleState = (state: EmailLogState) => {
    const next = filters.states.includes(state)
      ? filters.states.filter((entry) => entry !== state)
      : [...filters.states, state];
    update({ state: next.length > 0 ? next.join(",") : null });
  };

  // The export carries exactly the filters on screen, so the file matches.
  const exportParams = new URLSearchParams();
  if (filters.reminderId) exportParams.set("reminder", filters.reminderId);
  if (filters.states.length > 0) exportParams.set("state", filters.states.join(","));
  if (filters.from) exportParams.set("from", filters.from);
  if (filters.to) exportParams.set("to", filters.to);
  if (filters.search) exportParams.set("search", filters.search);
  const exportHref = `/api/reminders/emails/export${
    exportParams.size > 0 ? `?${exportParams.toString()}` : ""
  }`;

  const openEvents = (row: ReminderEmailRow) => {
    setEventsFor(row);
    setEvents(null);
    startEvents(async () => setEvents(await loadEmailEvents(row.id)));
  };

  return (
    <div className="flex flex-col gap-4">
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>The email log could not be loaded</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {/* State chips: the count is under every filter except state, so a chip
          keeps its number while it (or another) is selected. */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by delivery state"
      >
        {EMAIL_LOG_STATES.map((state) => {
          const active = filters.states.includes(state);
          return (
            <Button
              key={state}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              title={EMAIL_STATE_DESCRIPTION[state]}
              onClick={() => toggleState(state)}
              disabled={navigating}
            >
              {EMAIL_STATE_LABEL[state]}
              <span className="font-mono tabular-nums opacity-80">
                {counts[state].toLocaleString()}
              </span>
            </Button>
          );
        })}
        {filters.states.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => update({ state: null })}
          >
            <X data-icon="inline-start" aria-hidden />
            Clear states
          </Button>
        ) : null}
      </div>

      <p className="text-muted-foreground text-xs">
        &ldquo;Delivered&rdquo; includes everyone who opened. Opens are
        estimated with a tracking pixel: Apple Mail can register an open on its
        own, and mail apps that block images never report one — so &ldquo;not
        opened yet&rdquo; means no open was recorded, not that it was unread.
      </p>

      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex flex-wrap items-end gap-2.5">
          <Field className="w-full sm:w-60">
            <FieldLabel htmlFor={broadcastId} className="text-xs font-medium">
              Broadcast
            </FieldLabel>
            <Select
              value={filters.reminderId ?? ALL}
              onValueChange={(value) => update({ reminder: value })}
            >
              <SelectTrigger id={broadcastId} className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={ALL}>All broadcasts</SelectItem>
                  {broadcasts.map((broadcast) => (
                    <SelectItem key={broadcast.id} value={broadcast.id}>
                      {periodText(broadcast.start, broadcast.end)} · sent{" "}
                      {formatDhaka(broadcast.createdAt, "date")}
                    </SelectItem>
                  ))}
                  {filters.reminderId &&
                  !broadcasts.some((b) => b.id === filters.reminderId) ? (
                    <SelectItem value={filters.reminderId}>
                      This broadcast
                    </SelectItem>
                  ) : null}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field className="w-full sm:w-40">
            <FieldLabel htmlFor={fromId} className="text-xs font-medium">
              Sent from
            </FieldLabel>
            <Input
              id={fromId}
              type="date"
              value={filters.from ?? ""}
              max={filters.to}
              onChange={(event) => update({ from: event.target.value || null })}
              className="h-8 text-xs"
            />
          </Field>

          <Field className="w-full sm:w-40">
            <FieldLabel htmlFor={toId} className="text-xs font-medium">
              Sent to
            </FieldLabel>
            <Input
              id={toId}
              type="date"
              value={filters.to ?? ""}
              min={filters.from}
              onChange={(event) => update({ to: event.target.value || null })}
              className="h-8 text-xs"
            />
          </Field>

          <Field className="w-full sm:w-64">
            <FieldLabel htmlFor={searchId} className="text-xs font-medium">
              Search
            </FieldLabel>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                update({ search: searchInput.trim() || null });
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
                placeholder="Name, email or username"
                className="px-8 text-xs"
              />
              {searchInput ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setSearchInput("");
                    update({ search: null });
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

        <Button variant="outline" size="sm" asChild>
          <a href={exportHref}>
            <Download data-icon="inline-start" aria-hidden />
            Export to Excel
          </a>
        </Button>
      </div>

      <div className="bg-card overflow-hidden rounded-lg border">
        {rows.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MailX aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No reminder emails found</EmptyTitle>
              <EmptyDescription>
                {filtered
                  ? "No reminder emails match these filters."
                  : "No reminder has been sent by email yet. Tick Email when sending a reminder."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-48">Student</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Reminder for</TableHead>
                  <TableHead className="text-right">History</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{row.name ?? "—"}</span>
                        {row.discordUsername ? (
                          <span className="text-muted-foreground font-mono text-xs">
                            @{row.discordUsername}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {row.email ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge
                          variant={EMAIL_STATE_VARIANT[row.state]}
                          title={EMAIL_STATE_DESCRIPTION[row.state]}
                        >
                          {EMAIL_STATE_LABEL[row.state]}
                        </Badge>
                        {row.bounceReason || row.errorMessage ? (
                          <span className="text-muted-foreground max-w-56 truncate text-xs">
                            {row.bounceReason ?? row.errorMessage}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDhaka(row.sentAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDhaka(row.deliveredAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.firstOpenedAt ? (
                        <span>
                          {formatDhaka(row.firstOpenedAt)}
                          {row.openCount > 1 ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {row.openCount}×
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {periodText(row.reminderStartDate, row.reminderEndDate)}
                      {row.sentBy ? (
                        <span className="block text-xs">by {row.sentBy}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Tracking history for ${row.name ?? row.email ?? "this email"}`}
                        disabled={row.state === "no_address"}
                        onClick={() => openEvents(row)}
                      >
                        <History aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {total.toLocaleString()} email{total === 1 ? "" : "s"}
          {totalPages > 1 ? ` · page ${page} of ${totalPages}` : null}
        </span>
        {totalPages > 1 ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || navigating}
              onClick={() => update({ page: String(page - 1) })}
            >
              <ChevronLeft data-icon="inline-start" aria-hidden />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || navigating}
              onClick={() => update({ page: String(page + 1) })}
            >
              Next
              <ChevronRight data-icon="inline-end" aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog
        open={eventsFor !== null}
        onOpenChange={(open) => {
          if (!open) setEventsFor(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tracking history</DialogTitle>
            <DialogDescription>
              {eventsFor?.name ?? "This student"} ·{" "}
              <span className="font-mono">{eventsFor?.email}</span>
            </DialogDescription>
          </DialogHeader>
          {loadingEvents || events === null ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : !events.ok ? (
            <Alert variant="destructive">
              <AlertDescription>{events.message}</AlertDescription>
            </Alert>
          ) : events.events.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {eventsFor?.sentAt
                ? `Sent ${formatDhaka(eventsFor.sentAt)}. Mailtrap has not reported anything for this email yet.`
                : "Not sent yet."}
            </p>
          ) : (
            <ol className="flex flex-col gap-2 text-sm">
              {eventsFor?.sentAt ? (
                <li className="flex justify-between gap-4">
                  <span>Sent</span>
                  <span className="text-muted-foreground">
                    {formatDhaka(eventsFor.sentAt)}
                  </span>
                </li>
              ) : null}
              {events.events.map((event) => (
                <li key={event.id} className="flex flex-col">
                  <span className="flex justify-between gap-4">
                    <span>{EMAIL_EVENT_LABEL[event.type]}</span>
                    <span className="text-muted-foreground">
                      {formatDhaka(event.occurredAt)}
                    </span>
                  </span>
                  {event.detail ? (
                    <span className="text-muted-foreground text-xs">
                      {event.detail}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
