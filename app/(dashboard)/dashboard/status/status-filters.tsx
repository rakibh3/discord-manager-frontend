"use client";

import { Download, Info, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";

import { PeriodFilter } from "./period-filter";
import { ServerFilter } from "./server-filter";
import {
  DAILY_STATUSES,
  DAILY_STATUS_LABEL,
  RANGE_STATUSES,
  RANGE_STATUS_LABEL,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DiscordServer } from "@/lib/api/types";
import { countedDays, periodSearchParams, type Period } from "@/lib/period";

/** Period, server, status filter and search, all held in the URL so a view is
 *  shareable and reloadable. They combine into one request, so the figures on
 *  screen and the exported file always describe the same set. */
export function StatusFilters({
  period,
  servers,
  guildId,
  status,
  rangeStatus,
  minMissedBothDays,
  search,
  exportEnabled,
}: {
  period: Period;
  servers: DiscordServer[];
  guildId: string | undefined;
  status: string | undefined;
  rangeStatus: string | undefined;
  minMissedBothDays: number | undefined;
  search: string | undefined;
  exportEnabled: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [term, setTerm] = useState(search ?? "");
  const statusId = useId();
  const searchId = useId();
  const thresholdId = useId();

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

  const counted = countedDays(period);

  const exportHref = `/api/daily-status/export?${new URLSearchParams({
    ...periodSearchParams(period),
    ...(guildId ? { guildId } : {}),
    ...(period.mode === "date" && status ? { status } : {}),
    ...(period.mode === "range" && rangeStatus ? { rangeStatus } : {}),
    ...(period.mode === "range" && minMissedBothDays !== undefined
      ? { minMissedBothDays: String(minMissedBothDays) }
      : {}),
    ...(search ? { search } : {}),
    format: "csv",
  }).toString()}`;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col gap-2">
        <PeriodFilter period={period} />

        <div className="flex flex-wrap items-end gap-2.5">
          <ServerFilter servers={servers} guildId={guildId} />

          {period.mode === "date" ? (
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
                    {DAILY_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {DAILY_STATUS_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <>
              <Field className="w-full sm:w-52">
                <FieldLabel htmlFor={statusId} className="text-xs font-medium">
                  Across the range
                </FieldLabel>
                <Select
                  value={rangeStatus ?? "ALL"}
                  onValueChange={(value) =>
                    push({ rangeStatus: value === "ALL" ? undefined : value })
                  }
                >
                  <SelectTrigger id={statusId} className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="ALL">Everyone</SelectItem>
                      {RANGE_STATUSES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {RANGE_STATUS_LABEL[value]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field className="w-full sm:w-44">
                <div className="flex items-center gap-1">
                  <FieldLabel htmlFor={thresholdId} className="text-xs font-medium">
                    Missed both min
                  </FieldLabel>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground/60 hover:text-foreground cursor-help inline-flex items-center">
                        <Info className="size-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Days with neither submission, out of {counted}. This is the same
                      set a reminder with that threshold would DM.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id={thresholdId}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={counted}
                  value={minMissedBothDays ?? ""}
                  placeholder="Any"
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10);
                    push({
                      minMissedBothDays:
                        Number.isInteger(value) && value >= 1
                          ? String(value)
                          : undefined,
                    });
                  }}
                  className="h-8 text-xs"
                />
              </Field>
            </>
          )}

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
                placeholder="Name, phone, email or username"
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
    </TooltipProvider>
  );
}
