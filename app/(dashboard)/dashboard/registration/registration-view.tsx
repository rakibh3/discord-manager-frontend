import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { RegistrationsTable } from "./registrations-table";
import { RegistrationSettingsCard } from "./settings-card";
import { Button } from "@/components/ui/button";
import type {
  ApiResponse,
  Registration,
  RegistrationSettings,
  RegistrationStatusFilter,
  WelcomeEmailStatusFilter,
} from "@/lib/api/types";

export function RegistrationView({
  settings,
  registrationsResponse,
  currentStatus,
  currentEmailStatus,
  currentSearch,
  currentPage,
  currentLimit,
}: {
  settings: RegistrationSettings;
  registrationsResponse: ApiResponse<Registration[]>;
  currentStatus: RegistrationStatusFilter;
  currentEmailStatus: WelcomeEmailStatusFilter;
  currentSearch?: string;
  currentPage: number;
  currentLimit: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Registration</h1>
          <p className="text-muted-foreground text-sm">
            Control when the public sign-up form accepts registrations, and
            review who has registered.
          </p>
        </div>

        <Button variant="outline" size="sm" asChild className="self-start">
          <Link href="/register" target="_blank" rel="noreferrer">
            <ExternalLink data-icon="inline-start" aria-hidden />
            Open the form
          </Link>
        </Button>
      </div>

      {/* Keyed on `updatedAt` so a save (which revalidates this page) remounts
       *  the card on the stored values instead of leaving stale local state. */}
      <RegistrationSettingsCard
        key={settings.updatedAt ?? "initial"}
        initialSettings={settings}
      />

      <RegistrationsTable
        registrations={registrationsResponse.data}
        total={
          registrationsResponse.meta?.total ?? registrationsResponse.data.length
        }
        page={currentPage}
        limit={currentLimit}
        search={currentSearch}
        status={currentStatus}
        emailStatus={currentEmailStatus}
        counts={settings.counts}
        emailActionsBlockedReason={emailBlockedReason(settings)}
      />
    </div>
  );
}

/** Why a welcome email cannot be queued right now, or `null` when it can. The
 *  backend refuses for the same three reasons; saying so on the button saves
 *  the admin a click that can only fail. */
function emailBlockedReason(settings: RegistrationSettings): string | null {
  if (!settings.welcomeEmailEnabled) return "Welcome emails are switched off.";
  if (!settings.mail.configured) {
    return settings.mail.reason ?? "Mailtrap is not configured.";
  }
  if (!settings.queue.redisAvailable) {
    return "The email queue (Redis) is unavailable.";
  }
  return null;
}
