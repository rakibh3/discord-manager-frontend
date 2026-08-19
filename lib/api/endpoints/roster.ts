import "server-only";

import { api, apiRequest } from "@/lib/api/client";
import type {
  ApiResponse,
  RosterEntry,
  RosterImportHistoryItem,
  RosterImportResult,
  RosterQuery,
  RosterSettings,
  RosterStatusCountsPayload,
  RosterStatusEntry,
  RosterStatusQuery,
  UpdateRosterEntryInput,
  UpdateRosterSettingsInput,
} from "@/lib/api/types";
import { periodQuery, periodSearchParams, type Period } from "@/lib/period";

/** Roster endpoints (`API_INTEGRATION.md` §8.6A). All require ADMIN auth. */

/** `GET /api/roster` — Paginated, searchable listing of enrolled students. */
export function getRoster(
  query?: RosterQuery,
): Promise<ApiResponse<RosterEntry[]>> {
  return apiRequest<RosterEntry[]>("/roster", {
    query: {
      status: query?.status ?? "active",
      search: query?.search,
      page: query?.page ?? 1,
      limit: query?.limit ?? 50,
    },
  });
}

/** `POST /api/roster/import` — Multipart spreadsheet upload (.xlsx or .csv). */
export function importRoster(
  formData: FormData,
): Promise<RosterImportResult> {
  return api<RosterImportResult>("/roster/import", {
    method: "POST",
    body: formData,
  });
}

/** `PATCH /api/roster/:id` — Update one entry's name, email, or phone. */
export function updateRosterEntry(
  id: string,
  input: UpdateRosterEntryInput,
): Promise<RosterEntry> {
  return api<RosterEntry>(`/roster/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}

/** `DELETE /api/roster/:id` — Deactivates the entry (reversible, audit survives). */
export function deactivateRosterEntry(id: string): Promise<RosterEntry> {
  return api<RosterEntry>(`/roster/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/** `PATCH /api/roster/:id/restore` — Reinstates a deactivated entry. */
export function restoreRosterEntry(id: string): Promise<RosterEntry> {
  return api<RosterEntry>(`/roster/${encodeURIComponent(id)}/restore`, {
    method: "PATCH",
  });
}

/** `GET /api/roster/imports` — Paginated import audit history, most recent first. */
export function getRosterImports(query?: {
  page?: number;
  limit?: number;
}): Promise<ApiResponse<RosterImportHistoryItem[]>> {
  return apiRequest<RosterImportHistoryItem[]>("/roster/imports", {
    query: {
      page: query?.page ?? 1,
      limit: query?.limit ?? 20,
    },
  });
}

/** `GET /api/roster/settings` — Reports `enforceEmail` and `activeEntries`. */
export function getRosterSettings(): Promise<RosterSettings> {
  return api<RosterSettings>("/roster/settings");
}

/** `PATCH /api/roster/settings` — Arms or disarms the roster gate on submit. */
export function patchRosterSettings(
  input: UpdateRosterSettingsInput,
): Promise<RosterSettings> {
  return api<RosterSettings>("/roster/settings", {
    method: "PATCH",
    body: input,
  });
}

// ── Roster engagement (the read model — §8.6A "The roster engagement read model") ──

export type RosterStatusListOptions = Omit<
  RosterStatusQuery,
  "date" | "from" | "to" | "daysOfWeek"
>;

/** `GET /api/roster/status/counts` — the seven date-mode figures or the
 *  range-mode rollup. The denominator is ENROLMENT, not Discord membership,
 *  so these will not equal the dashboard totals. `meta.mode` declares which
 *  shape the response took. */
export function getRosterStatusCounts(
  period: Period,
): Promise<RosterStatusCountsPayload> {
  return api<RosterStatusCountsPayload>("/roster/status/counts", {
    query: periodQuery(period),
  });
}

/** `GET /api/roster/status` — paginated, one row per ENROLLED PERSON (not per
 *  Discord member). Unpaired entries carry the roster details with a `null`
 *  Discord identity; they are unreachable on Discord, so outreach happens by
 *  email outside this system. The roster takes no `guildId`. */
export function getRosterStatusPage(
  period: Period,
  options: RosterStatusListOptions = {},
): Promise<ApiResponse<RosterStatusEntry[]>> {
  return apiRequest<RosterStatusEntry[]>("/roster/status", {
    query: {
      ...periodQuery(period),
      pairingState: options.pairingState,
      status: options.status,
      search: options.search,
      sortBy: options.sortBy,
      sortDir: options.sortDir,
      page: options.page,
      limit: options.limit,
    },
  });
}

/** `GET /api/roster/status/export` — direct file download, no paging.
 *  Filenames carry the period (`roster-status-YYYY-MM-DD.csv` for a date,
 *  `roster-status-YYYY-MM-DD_to_YYYY-MM-DD.csv` for a range). `format=xlsx`
 *  is a 501 Not Implemented. */
export function rosterStatusExportPath(
  period: Period,
  options: RosterStatusListOptions & { format: "csv" | "xlsx" },
): string {
  const params = new URLSearchParams({
    ...periodSearchParams(period),
    format: options.format,
  });
  if (options.pairingState) params.set("pairingState", options.pairingState);
  if (options.status) params.set("status", options.status);
  if (options.search) params.set("search", options.search);
  return `/roster/status/export?${params.toString()}`;
}
