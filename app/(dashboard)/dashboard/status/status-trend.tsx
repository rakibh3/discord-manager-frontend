import { StatusTrendChart } from "./status-trend-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { getDailyStatusCounts } from "@/lib/api/endpoints/daily-status";
import { isRangeCounts } from "@/lib/api/types";
import { dhakaDaysAgo } from "@/lib/dhaka-date";
import { datePeriod, type Period } from "@/lib/period";

const TREND_DAYS = 7;

/** Completion across recent days — one counts read per day, run in parallel. A
 *  failed day is omitted rather than plotted as zero, which would read as real.
 *
 *  Always single-day reads, even when the page is showing a range: a trend is a
 *  sequence of days by definition, and reading the range endpoint per day would
 *  answer in person-days, which is a different unit from the four buckets here. */
export async function StatusTrend({
  period,
  guildId,
}: {
  period: Period;
  guildId: string | undefined;
}) {
  const anchor = period.mode === "date" ? period.date : period.to;

  const dates = Array.from({ length: TREND_DAYS }, (_, index) =>
    dhakaDaysAgo(TREND_DAYS - 1 - index, anchor),
  );

  const settled = await Promise.all(
    dates.map(async (day) => {
      try {
        const counts = await getDailyStatusCounts(datePeriod(day), { guildId });
        // A range payload here would be a different unit entirely, so it is
        // dropped rather than plotted against single-day buckets.
        return isRangeCounts(counts) ? null : counts;
      } catch {
        return null;
      }
    }),
  );

  const points = settled
    .filter((counts) => counts !== null)
    .map((counts) => ({
      date: counts.date,
      complete: counts.bothComplete,
      missingUpdate: counts.missingUpdateOnly,
      missingAttendance: counts.missingAttendanceOnly,
      missingBoth: counts.missingBoth,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent days</CardTitle>
        <CardDescription>
          The last {TREND_DAYS} days up to and including{" "}
          {period.mode === "date" ? "the selected date" : "the end of the range"}
          . Each day is read on its own, so these are single-day figures whatever
          period is selected above.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <Empty>
            <EmptyTitle>No trend available</EmptyTitle>
            <EmptyDescription>
              None of the recent days could be read.
            </EmptyDescription>
          </Empty>
        ) : (
          <StatusTrendChart points={points} />
        )}
      </CardContent>
    </Card>
  );
}
