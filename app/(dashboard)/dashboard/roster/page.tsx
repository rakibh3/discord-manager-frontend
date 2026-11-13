import type { Metadata } from "next";

import { RosterView } from "./roster-view";
import { getRoster, getRosterSettings } from "@/lib/api/endpoints/roster";
import type { RosterStatusFilter } from "@/lib/api/types";

export const metadata: Metadata = { title: "Enrolment roster" };

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const single = (val: string | string[] | undefined): string | undefined =>
    Array.isArray(val) ? val[0] : val;

  const rawStatus = single(params.status);
  const status: RosterStatusFilter =
    rawStatus === "inactive" || rawStatus === "all" ? rawStatus : "active";

  const search = single(params.search)?.trim() || undefined;
  const page = Math.max(1, Number.parseInt(single(params.page) ?? "1", 10) || 1);
  const limit = 50;

  const [rosterRes, settingsRes] = await Promise.all([
    getRoster({ status, search, page, limit }).catch(() => ({
      success: false,
      statusCode: 500,
      data: [],
      meta: { page: 1, limit, total: 0 },
    })),
    getRosterSettings().catch(() => ({
      enforceEmail: false,
      activeEntries: 0,
      updatedAt: null,
      updatedBy: null,
    })),
  ]);

  return (
    <RosterView
      rosterResponse={rosterRes}
      settings={settingsRes}
      currentStatus={status}
      currentSearch={search}
      currentPage={page}
      currentLimit={limit}
    />
  );
}
