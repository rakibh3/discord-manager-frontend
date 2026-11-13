import type { Metadata } from "next";

import { RegistrationView } from "./registration-view";
import {
  getRegistrationSettings,
  getRegistrations,
} from "@/lib/api/endpoints/registration";
import type {
  RegistrationStatusFilter,
  WelcomeEmailStatusFilter,
} from "@/lib/api/types";

export const metadata: Metadata = { title: "Registration" };

const LIMIT = 50;

const EMAIL_STATUSES = new Set(["PENDING", "SENT", "FAILED", "SKIPPED"]);

export default async function RegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const single = (val: string | string[] | undefined): string | undefined =>
    Array.isArray(val) ? val[0] : val;

  const rawStatus = single(params.status);
  const status: RegistrationStatusFilter =
    rawStatus === "PENDING" || rawStatus === "ENROLLED" ? rawStatus : "all";

  const rawEmailStatus = single(params.emailStatus);
  const emailStatus: WelcomeEmailStatusFilter =
    rawEmailStatus && EMAIL_STATUSES.has(rawEmailStatus)
      ? (rawEmailStatus as WelcomeEmailStatusFilter)
      : "all";

  const search = single(params.search)?.trim() || undefined;
  const page = Math.max(1, Number.parseInt(single(params.page) ?? "1", 10) || 1);

  // The settings read is NOT given a fallback, unlike the listing. A made-up
  // settings object would render the form as "switched off" with empty dates,
  // and saving from that screen would overwrite the real window with the
  // invented one. If the settings cannot be read, the dashboard error boundary
  // says so.
  const [settings, registrations] = await Promise.all([
    getRegistrationSettings(),
    getRegistrations({ status, emailStatus, search, page, limit: LIMIT }).catch(
      () => ({
        success: false,
        statusCode: 500,
        data: [],
        meta: { page: 1, limit: LIMIT, total: 0 },
      }),
    ),
  ]);

  return (
    <RegistrationView
      settings={settings}
      registrationsResponse={registrations}
      currentStatus={status}
      currentEmailStatus={emailStatus}
      currentSearch={search}
      currentPage={page}
      currentLimit={LIMIT}
    />
  );
}
