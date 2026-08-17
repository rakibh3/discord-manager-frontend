"use client";

import { Download, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dhakaToday } from "@/lib/dhaka-date";
import { DAILY_STATUSES, DAILY_STATUS_LABEL } from "./status-labels";

/**
 * Date, status filter and search — all reflected in the URL.
 *
 * Keeping this state in the query string rather than in component state is what
 * makes a view shareable and reloadable: "everyone who missed both on the 14th"
 * is a link someone can paste into Discord. All three combine into one server
 * request, so the pager totals always match the filter.
 */
export function StatusFilters({
  date,
  status,
  search,
  exportEnabled,
}: {
  date: string;
  status: string | undefined;
  search: string | undefined;
  exportEnabled: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [term, setTerm] = useState(search ?? "");
  const dateId = useId();
  const statusId = useId();
  const searchId = useId();

  // Keep the input in step with the URL — including a back navigation, which
  // changes `search` without remounting. Adjusted during render.
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
    // Any change to the filters invalidates the current page number.
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <FieldGroup className="sm:flex-row sm:items-end sm:gap-3">
      <Field className="sm:w-auto">
        <FieldLabel htmlFor={dateId}>Date</FieldLabel>
        <Input
          id={dateId}
          type="date"
          value={date}
          max={dhakaToday()}
          onChange={(event) => push({ date: event.target.value })}
          className="w-auto"
        />
      </Field>

      <Field className="sm:w-52">
        <FieldLabel htmlFor={statusId}>Status</FieldLabel>
        <Select
          value={status ?? "ALL"}
          onValueChange={(value) =>
            push({ status: value === "ALL" ? undefined : value })
          }
        >
          <SelectTrigger id={statusId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="ALL">All statuses</SelectItem>
              {DAILY_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {DAILY_STATUS_LABEL[value]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      <Field className="sm:flex-1">
        <FieldLabel htmlFor={searchId}>Search</FieldLabel>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            push({ search: term.trim() || undefined });
          }}
          className="flex gap-2"
        >
          <Input
            id={searchId}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Name, phone, email or username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button type="submit" variant="outline" aria-label="Search">
            <Search />
          </Button>
        </form>
      </Field>

      {/*
        Absent, not disabled, while the feature is off. A visible export button
        that does nothing is worse than no button — it looks like a bug.
      */}
      {exportEnabled ? (
        <Field className="sm:w-auto">
          <Button variant="outline" asChild>
            <a
              href={`/api/daily-status/export?${new URLSearchParams({
                date,
                ...(status ? { status } : {}),
                ...(search ? { search } : {}),
                format: "csv",
              }).toString()}`}
            >
              <Download data-icon="inline-start" />
              Export
            </a>
          </Button>
        </Field>
      ) : null}
    </FieldGroup>
  );
}
