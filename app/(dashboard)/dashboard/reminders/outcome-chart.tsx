import { OutcomeChartClient } from "./outcome-chart-client";
import { getProgress } from "@/lib/api/endpoints/reminders";
import type { ReminderLogRow } from "@/lib/api/types";

/** How many broadcasts the chart covers. Each one costs a progress read. */
const CHART_ROWS = 8;

/**
 * Delivered / DMs-closed / failed per broadcast date.
 *
 * The history endpoint only carries `sentCount` and `failedCount` — cached
 * counters on the session row with no DM-closed split. The three-way breakdown
 * lives on `GET /reminders/:id`, which reads the recipient rows directly, so
 * this fetches progress for the most recent few broadcasts rather than
 * inferring a DM-closed figure by subtraction. A derived number here would look
 * authoritative and be wrong, which is worse than one fewer series.
 *
 * The reads run in parallel and are bounded to `CHART_ROWS`; a broadcast whose
 * progress read fails is simply left out rather than charted as zeros.
 */
export async function OutcomeChart({ rows }: { rows: ReminderLogRow[] }) {
  const recent = rows.slice(0, CHART_ROWS);

  const settled = await Promise.all(
    recent.map(async (row) => {
      try {
        return await getProgress(row.id);
      } catch {
        return null;
      }
    }),
  );

  const points = settled
    .filter((progress) => progress !== null)
    .map((progress) => ({
      date: progress.reminderDate,
      delivered: progress.delivered,
      dmClosed: progress.dmClosed,
      failed: progress.failed,
    }))
    // The history list is newest-first; a trend reads left-to-right oldest-first.
    .reverse();

  if (points.length === 0) return null;

  return <OutcomeChartClient points={points} />;
}
