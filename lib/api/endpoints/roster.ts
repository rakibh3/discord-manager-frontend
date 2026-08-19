import "server-only";

import { api, apiRequest } from "@/lib/api/client";
import type {
  ApiResponse,
  RosterEntry,
  RosterImportHistoryItem,
  RosterImportResult,
  RosterQuery,
  RosterSettings,
  UpdateRosterEntryInput,
  UpdateRosterSettingsInput,
} from "@/lib/api/types";

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
