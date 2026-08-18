"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PeriodPicker } from "@/components/dashboard/period-picker";
import { periodSearchParams, type Period } from "@/lib/period";

/** The URL-backed period selector for the daily-status screens. Everything lives
 *  in the query string, so a view stays shareable and survives a reload.
 *
 *  Switching mode clears the other mode's parameters *and* the filters that only
 *  exist in it — `status` is date-mode only, `rangeStatus` and
 *  `minMissedBothDays` are range-mode only, and sending the wrong one is a 400
 *  rather than a filter that is quietly ignored. */
export function PeriodFilter({
  period,
  className,
}: {
  period: Period;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const apply = (next: Period) => {
    const search = new URLSearchParams(params.toString());

    for (const key of [
      "date",
      "from",
      "to",
      "daysOfWeek",
      // Any change of period invalidates the page number, and a mode change
      // invalidates the mode-specific filters and sorts.
      "page",
    ]) {
      search.delete(key);
    }

    if (next.mode !== period.mode) {
      for (const key of [
        "status",
        "rangeStatus",
        "minMissedBothDays",
        "sortBy",
        "sortDir",
      ]) {
        search.delete(key);
      }
    }

    for (const [key, value] of Object.entries(periodSearchParams(next))) {
      search.set(key, value);
    }

    router.push(`${pathname}?${search.toString()}`);
  };

  return (
    <PeriodPicker value={period} onChange={apply} className={className} />
  );
}
