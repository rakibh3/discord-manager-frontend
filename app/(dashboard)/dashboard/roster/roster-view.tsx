"use client";

import { ClipboardList, LineChart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EditEntryDialog } from "./edit-entry-dialog";
import { RosterGateCard } from "./roster-gate-card";
import { RosterTable } from "./roster-table";
import { Button } from "@/components/ui/button";
import type {
  ApiResponse,
  RosterEntry,
  RosterSettings,
  RosterStatusFilter,
} from "@/lib/api/types";

/** The enrolment roster. Registration is the only way onto it — there is no
 *  spreadsheet import — and a registered student is linked to their Discord
 *  account automatically when they join a server with the handle they
 *  registered. The edit dialog is the repair path for a wrong or missing link. */
export function RosterView({
  rosterResponse,
  settings,
  currentStatus,
  currentSearch,
  currentPage,
  currentLimit,
}: {
  rosterResponse: ApiResponse<RosterEntry[]>;
  settings: RosterSettings;
  currentStatus: RosterStatusFilter;
  currentSearch?: string;
  currentPage: number;
  currentLimit: number;
}) {
  const router = useRouter();
  const [editingEntry, setEditingEntry] = useState<RosterEntry | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Enrolment roster
          </h1>
          <p className="text-muted-foreground text-sm">
            Everyone who registered. Linked to Discord when they join.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/registration">
              <ClipboardList data-icon="inline-start" aria-hidden />
              Registrations
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/members?view=enrolled">
              <LineChart data-icon="inline-start" aria-hidden />
              Engagement
            </Link>
          </Button>
        </div>
      </div>

      <RosterGateCard initialSettings={settings} />

      <RosterTable
        entries={rosterResponse.data}
        total={rosterResponse.meta?.total ?? rosterResponse.data.length}
        page={currentPage}
        limit={currentLimit}
        search={currentSearch}
        status={currentStatus}
        onEdit={(entry) => setEditingEntry(entry)}
      />

      <EditEntryDialog
        entry={editingEntry}
        open={Boolean(editingEntry)}
        onOpenChange={(open) => !open && setEditingEntry(null)}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
