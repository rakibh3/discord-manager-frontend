import type { Metadata } from "next";

import { EmailLog } from "./email-log";
import { getHistory, getReminderEmails } from "@/lib/api/endpoints/reminders";
import type { EmailLogState, ReminderEmailCounts } from "@/lib/api/types";
import { EMAIL_LOG_STATES } from "@/lib/reminder-labels";

export const metadata: Metadata = { title: "Reminder email log" };

const LIMIT = 50;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

const EMPTY_COUNTS: ReminderEmailCounts = {
  total: 0,
  pending: 0,
  awaiting: 0,
  delivered: 0,
  opened: 0,
  not_opened: 0,
  bounced: 0,
  failed: 0,
  no_address: 0,
};

/** Every reminder email with whether it was delivered and opened. Filters
 *  live in the URL so a view can be bookmarked or shared, and anything not
 *  recognised is dropped rather than forwarded — the backend would 400. */
export default async function ReminderEmailLogPage({
  searchParams,
}: PageProps<"/dashboard/reminders/emails">) {
  const params = await searchParams;
  const single = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const reminderId = single(params.reminder);
  const states = (single(params.state) ?? "")
    .split(",")
    .filter((state): state is EmailLogState =>
      (EMAIL_LOG_STATES as string[]).includes(state),
    );
  const from = single(params.from);
  const to = single(params.to);
  const search = single(params.search)?.trim() || undefined;
  const page = Math.max(1, Number.parseInt(single(params.page) ?? "1", 10) || 1);

  const filters = {
    reminderId: reminderId && UUID.test(reminderId) ? reminderId : undefined,
    states,
    from: from && DATE.test(from) ? from : undefined,
    to: to && DATE.test(to) ? to : undefined,
    search,
  };

  const [log, history] = await Promise.all([
    getReminderEmails({ ...filters, page, limit: LIMIT }).catch((error) => ({
      success: false,
      statusCode: 500,
      message: error instanceof Error ? error.message : "Could not load",
      data: { rows: [], counts: EMPTY_COUNTS },
      meta: { page: 1, limit: LIMIT, total: 0 },
    })),
    // The broadcast filter lists recent broadcasts that used email.
    getHistory({ page: 1, limit: 100 }).catch(() => ({ data: [] })),
  ]);

  const broadcasts = history.data.filter((row) =>
    row.channels?.includes("EMAIL"),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Reminder email log
        </h1>
        <p className="text-muted-foreground text-sm">
          Who each reminder email reached, and who opened it.
        </p>
      </div>

      <EmailLog
        rows={log.data.rows}
        counts={log.data.counts}
        total={log.meta?.total ?? 0}
        page={log.meta?.page ?? page}
        limit={log.meta?.limit ?? LIMIT}
        loadError={log.success ? null : (log.message ?? "Could not load")}
        filters={filters}
        broadcasts={broadcasts.map((row) => ({
          id: row.id,
          start: row.reminderStartDate,
          end: row.reminderEndDate,
          createdAt: row.createdAt,
        }))}
      />
    </div>
  );
}
