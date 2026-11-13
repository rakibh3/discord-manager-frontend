import "server-only";

import { api, apiRequest } from "@/lib/api/client";
import type {
  AddRegistrationsToRosterResult,
  ApiResponse,
  Registration,
  RegistrationQuery,
  RegistrationSettings,
  RegistrationWindow,
  RetryWelcomeEmailsResult,
  UpdateRegistrationSettingsInput,
} from "@/lib/api/types";

/** Registration endpoints (`API_INTEGRATION.md` §8.6B).
 *
 *  Two backend paths, on purpose: `/registration/*` is PUBLIC (window + submit)
 *  and `/registrations/*` is ADMIN-only. The public submit is NOT here — the
 *  form posts browser-direct, so the backend's per-IP rate limit counts the
 *  registrant's address rather than this server's. */

/** `GET /api/registration/window` — public; no `Authorization` header. */
export function getRegistrationWindow(): Promise<RegistrationWindow> {
  return api<RegistrationWindow>("/registration/window", {
    anonymous: true,
    cache: "no-store",
  });
}

/** `GET /api/registrations/settings` — the window, the switches, whether mail
 *  can be sent, and the headline counts. */
export function getRegistrationSettings(): Promise<RegistrationSettings> {
  return api<RegistrationSettings>("/registrations/settings");
}

/** `PATCH /api/registrations/settings` — at least one key. The window rules are
 *  checked against the MERGED result: a date without its time, or a closing at
 *  or before the opening, is a 400. */
export function patchRegistrationSettings(
  input: UpdateRegistrationSettingsInput,
): Promise<RegistrationSettings> {
  return api<RegistrationSettings>("/registrations/settings", {
    method: "PATCH",
    body: input,
  });
}

/** The filter keys shared by the listing and the export. `all` is the backend
 *  default, so it is omitted rather than sent. */
function filterQuery(query?: RegistrationQuery) {
  return {
    search: query?.search || undefined,
    status: query?.status && query.status !== "all" ? query.status : undefined,
    emailStatus:
      query?.emailStatus && query.emailStatus !== "all"
        ? query.emailStatus
        : undefined,
  };
}

/** `GET /api/registrations` — paginated, newest first. */
export function getRegistrations(
  query?: RegistrationQuery,
): Promise<ApiResponse<Registration[]>> {
  return apiRequest<Registration[]>("/registrations", {
    query: {
      ...filterQuery(query),
      page: query?.page ?? 1,
      limit: query?.limit ?? 50,
    },
  });
}

/** `POST /api/registrations/add-to-roster` — `ids` omitted means every pending
 *  registration. Create-only on the roster: an existing entry is never
 *  modified, and a removed one is never reinstated. */
export function addRegistrationsToRoster(
  ids?: string[],
): Promise<AddRegistrationsToRosterResult> {
  return api<AddRegistrationsToRosterResult>("/registrations/add-to-roster", {
    method: "POST",
    body: ids ? { ids } : {},
  });
}

/** `POST /api/registrations/:id/resend-email` — 400 when welcome emails are off
 *  or Mailtrap is not configured, 503 when the queue is unavailable. */
export function resendWelcomeEmail(id: string): Promise<Registration> {
  return api<Registration>(
    `/registrations/${encodeURIComponent(id)}/resend-email`,
    { method: "POST" },
  );
}

/** `POST /api/registrations/emails/retry` — queues every welcome email that is
 *  pending or failed. */
export function retryUnsentWelcomeEmails(): Promise<RetryWelcomeEmailsResult> {
  return api<RetryWelcomeEmailsResult>("/registrations/emails/retry", {
    method: "POST",
  });
}

/** The backend path (with query) for the CSV export, for the route handler that
 *  streams it through. */
export function registrationsExportPath(query?: RegistrationQuery): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filterQuery(query))) {
    if (value !== undefined) params.set(key, value);
  }

  const suffix = params.toString();

  return `/registrations/export${suffix ? `?${suffix}` : ""}`;
}
