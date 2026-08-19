import type { Metadata } from "next";

import { RosterView } from "./roster-view";
import {
  getRoster,
  getRosterImports,
  getRosterSettings,
} from "@/lib/api/endpoints/roster";
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

  const rawTab = single(params.tab);
  const tab: "students" | "imports" = rawTab === "imports" ? "imports" : "students";

  // Fetch roster listing, settings, and import history in parallel
  const [rosterRes, settingsRes, importsRes] = await Promise.all([
    getRoster({ status, search, page: tab === "students" ? page : 1, limit }).catch(() => ({
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
    getRosterImports({ page: tab === "imports" ? page : 1, limit: 20 }).catch(() => ({
      success: false,
      statusCode: 500,
      data: [],
      meta: { page: 1, limit: 20, total: 0 },
    })),
  ]);

  return (
    <RosterView
      rosterResponse={rosterRes}
      settings={settingsRes}
      importsResponse={importsRes}
      currentStatus={status}
      currentSearch={search}
      currentPage={page}
      currentLimit={tab === "imports" ? 20 : limit}
      currentTab={tab}
    />
  );
}
