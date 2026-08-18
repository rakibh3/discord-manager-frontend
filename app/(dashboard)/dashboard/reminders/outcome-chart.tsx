import { OutcomeChartClient } from "./outcome-chart-client";
import { getProgress } from "@/lib/api/endpoints/reminders";
import type { ReminderLogRow } from "@/lib/api/types";

/** How many broadcasts the chart covers. Each one costs a progress read. */
const CHART_ROWS = 8;

/** Delivered / DMs-closed / failed per broadcast date. The history endpoint has
 *  no DM-closed split, so progress is read per broadcast rather than inferred. */
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
      // Plotted against the day the period ended: a range covers several days
      // and cannot sit on one axis tick, and the end is when it was acted on.
      date: progress.reminderEndDate ?? progress.reminderStartDate,
      delivered: progress.delivered,
      dmClosed: progress.dmClosed,
      failed: progress.failed,
    }))
    // The history list is newest-first; a trend reads left-to-right oldest-first.
    .reverse();

  if (points.length === 0) return null;

  return <OutcomeChartClient points={points} />;
}
