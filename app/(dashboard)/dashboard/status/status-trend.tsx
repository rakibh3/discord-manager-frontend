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
import { dhakaDaysAgo } from "@/lib/dhaka-date";

const TREND_DAYS = 7;

/**
 * Completion across recent days.
 *
 * Each day is a separate counts read, run in parallel and bounded to
 * `TREND_DAYS`. A day whose read fails is omitted rather than plotted as zero —
 * a zero would read as "nobody completed anything that day", which is a
 * different and much more alarming claim than "we could not load it".
 */
export async function StatusTrend({ date }: { date: string }) {
  const dates = Array.from({ length: TREND_DAYS }, (_, index) =>
    dhakaDaysAgo(TREND_DAYS - 1 - index, date),
  );

  const settled = await Promise.all(
    dates.map(async (day) => {
      try {
        return await getDailyStatusCounts(day);
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
          The last {TREND_DAYS} days up to and including the selected date.
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
