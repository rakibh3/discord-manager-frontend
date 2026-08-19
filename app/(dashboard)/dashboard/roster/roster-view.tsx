"use client";

import { FileSpreadsheet, History, LineChart, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { EditEntryDialog } from "./edit-entry-dialog";
import { ImportHistoryTable } from "./import-history-table";
import { ImportRosterDialog } from "./import-dialog";
import { RosterGateCard } from "./roster-gate-card";
import { RosterTable } from "./roster-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ApiResponse,
  RosterEntry,
  RosterImportHistoryItem,
  RosterSettings,
  RosterStatusFilter,
} from "@/lib/api/types";

export function RosterView({
  rosterResponse,
  settings,
  importsResponse,
  currentStatus,
  currentSearch,
  currentPage,
  currentLimit,
  currentTab = "students",
}: {
  rosterResponse: ApiResponse<RosterEntry[]>;
  settings: RosterSettings;
  importsResponse: ApiResponse<RosterImportHistoryItem[]>;
  currentStatus: RosterStatusFilter;
  currentSearch?: string;
  currentPage: number;
  currentLimit: number;
  currentTab?: "students" | "imports";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RosterEntry | null>(null);

  const handleTabChange = (newTab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Enrolment roster
          </h1>
          <p className="text-muted-foreground text-sm">
            Maintain the enrolled student directory and gate attendance
            submissions by verified email.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <Link href="/dashboard/roster/status">
              <LineChart data-icon="inline-start" aria-hidden />
              Engagement
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={() => setImportDialogOpen(true)}
          >
            <FileSpreadsheet data-icon="inline-start" aria-hidden />
            Import spreadsheet
          </Button>
        </div>
      </div>

      <RosterGateCard initialSettings={settings} />

      <Tabs value={currentTab} onValueChange={handleTabChange}>
        {/* The rail the `line` variant's underline sits on. */}
        <div className="border-b pb-1.5">
          <TabsList variant="line">
            <TabsTrigger value="students">
              <Users data-icon="inline-start" aria-hidden />
              Enrolled students (
              {rosterResponse.meta?.total ?? rosterResponse.data.length})
            </TabsTrigger>
            <TabsTrigger value="imports">
              <History data-icon="inline-start" aria-hidden />
              Import history (
              {importsResponse.meta?.total ?? importsResponse.data.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="students" className="pt-2">
          <RosterTable
            entries={rosterResponse.data}
            total={rosterResponse.meta?.total ?? rosterResponse.data.length}
            page={currentPage}
            limit={currentLimit}
            search={currentSearch}
            status={currentStatus}
            onEdit={(entry) => setEditingEntry(entry)}
          />
        </TabsContent>

        <TabsContent value="imports" className="pt-2">
          <ImportHistoryTable
            imports={importsResponse.data}
            total={importsResponse.meta?.total ?? importsResponse.data.length}
            page={currentPage}
            limit={currentLimit}
          />
        </TabsContent>
      </Tabs>

      <ImportRosterDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={() => router.refresh()}
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
