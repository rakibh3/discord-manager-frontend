"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PeriodPicker } from "@/components/dashboard/period-picker";
import { periodSearchParams, type Period } from "@/lib/period";

/** The URL-backed period selector for the roster engagement screen. The roster
 *  is global (no `guildId`), so a mode switch only clears the period itself and
 *  the filters that belong to the previous mode — the roster-side filters
 *  (`pairingState`, the roster `status`/`search`) are kept. */
export function PeriodFilter({ period }: { period: Period }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const apply = (next: Period) => {
    const search = new URLSearchParams(params.toString());

    for (const key of ["date", "from", "to", "daysOfWeek", "page"]) {
      search.delete(key);
    }

    for (const [key, value] of Object.entries(periodSearchParams(next))) {
      search.set(key, value);
    }

    router.push(`${pathname}?${search.toString()}`);
  };

  return <PeriodPicker value={period} onChange={apply} />;
}