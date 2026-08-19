"use client";

import { Download, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";

import { PeriodFilter } from "./period-filter";
import {
  PAIRING_LABEL,
  ROSTER_STATUSES,
  ROSTER_STATUS_LABEL,
} from "./status-labels";
import { Button } from "@/components/ui/button";
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
import type { RosterPairingState } from "@/lib/api/types";
import { periodSearchParams, type Period } from "@/lib/period";

/** Roster engagement filters — pairing state, status, and search. The roster
 *  has no `guildId`: enrolment is global, not per server. Period, filters and
 *  search combine into one request, so the figures on screen and the exported
 *  file describe the same set. */
export function RosterStatusFilters({
  period,
  pairingState,
  status,
  search,
  exportEnabled,
}: {
  period: Period;
  pairingState: RosterPairingState;
  status: string | undefined;
  search: string | undefined;
  exportEnabled: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [term, setTerm] = useState(search ?? "");
  const pairingId = useId();
  const statusId = useId();
  const searchId = useId();

  const [seenSearch, setSeenSearch] = useState(search);
  if (seenSearch !== search) {
    setSeenSearch(search);
    setTerm(search ?? "");
  }

  const push = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "") next.delete(key);
      else next.set(key, value);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  const exportHref = `/api/roster/status/export?${new URLSearchParams({
    ...periodSearchParams(period),
    ...(pairingState !== "all" ? { pairingState } : {}),
    ...(status ? { status } : {}),
    ...(search ? { search } : {}),
    format: "csv",
  }).toString()}`;

  return (
    <div className="flex flex-col gap-2">
      <PeriodFilter period={period} />

      <div className="flex flex-wrap items-end gap-2.5">
        <Field className="w-full sm:w-48">
          <FieldLabel htmlFor={pairingId} className="text-xs font-medium">
            Pairing
          </FieldLabel>
          <Select
            value={pairingState}
            onValueChange={(value) => push({ pairingState: value })}
          >
            <SelectTrigger id={pairingId} className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All enrolments</SelectItem>
                <SelectItem value="paired">
                  {PAIRING_LABEL.paired}
                </SelectItem>
                <SelectItem value="unpaired">
                  {PAIRING_LABEL.unpaired}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field className="w-full sm:w-48">
          <FieldLabel htmlFor={statusId} className="text-xs font-medium">
            Status
          </FieldLabel>
          <Select
            value={status ?? "ALL"}
            onValueChange={(value) =>
              push({ status: value === "ALL" ? undefined : value })
            }
          >
            <SelectTrigger id={statusId} className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ALL">All statuses</SelectItem>
                {ROSTER_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {ROSTER_STATUS_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field className="min-w-56 flex-1">
          <FieldLabel htmlFor={searchId} className="text-xs font-medium">
            Search
          </FieldLabel>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              push({ search: term.trim() || undefined });
            }}
            className="flex gap-1.5"
          >
            <Input
              id={searchId}
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Name or email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="h-8 text-xs"
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              aria-label="Search"
              className="h-8 px-2.5"
            >
              <Search className="size-3.5" />
            </Button>
          </form>
        </Field>

        {exportEnabled ? (
          <Field className="w-auto">
            <Button variant="outline" size="sm" asChild className="h-8 text-xs">
              <a href={exportHref}>
                <Download data-icon="inline-start" className="size-3.5" />
                Export
              </a>
            </Button>
          </Field>
        ) : null}
      </div>
    </div>
  );
}