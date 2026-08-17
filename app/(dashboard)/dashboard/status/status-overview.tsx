import { CompositionChart } from "@/components/viz/composition-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { getDailyStatusCounts } from "@/lib/api/endpoints/daily-status";
import type { DailyStatusCounts } from "@/lib/api/types";
import { formatCivilDate } from "@/lib/dhaka-date";
import {
  DAILY_STATUS_COLOR,
  DAILY_STATUS_DESCRIPTION,
  DAILY_STATUS_LABEL,
} from "./status-labels";

function percent(value: number, total: number): string {
  if (total === 0) return "—";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function CountCard({
  label,
  value,
  total,
  hint,
}: {
  label: string;
  value: number;
  total: number;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="font-mono text-2xl font-semibold tabular-nums">
          {value.toLocaleString()}
        </p>
        {/* Absolute value and percentage together — a percentage alone hides
            how big the denominator is, and a count alone hides the scale. */}
        <p className="text-muted-foreground text-xs">
          {percent(value, total)} of {total.toLocaleString()}
        </p>
        {hint ? (
          <p className="text-muted-foreground text-xs leading-snug">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * The seven overview figures.
 *
 * All seven come from the counts endpoint and nothing else. They interlock —
 * `bothComplete + missingUpdateOnly + missingAttendanceOnly + missingBoth`
 * must equal `totalMembers` — so substituting a similar-looking number from,
 * say, the reminder targets list would produce a set that quietly contradicts
 * itself. That endpoint counts something computed differently.
 */
export async function StatusOverview({ date }: { date: string }) {
  const counts: DailyStatusCounts = await getDailyStatusCounts(date);
  const total = counts.totalMembers;

  const allZero =
    total === 0 &&
    counts.attendanceSubmitted === 0 &&
    counts.dailyUpdateSubmitted === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard label="Total members" value={total} total={total} />
        <CountCard
          label="Attendance submitted"
          value={counts.attendanceSubmitted}
          total={total}
        />
        <CountCard
          label="Daily update submitted"
          value={counts.dailyUpdateSubmitted}
          total={total}
        />
        <CountCard
          label="Both complete"
          value={counts.bothComplete}
          total={total}
        />
        <CountCard
          label="Missing update only"
          value={counts.missingUpdateOnly}
          total={total}
          hint={DAILY_STATUS_DESCRIPTION.MISSING_UPDATE}
        />
        <CountCard
          label="Missing attendance only"
          value={counts.missingAttendanceOnly}
          total={total}
          hint={DAILY_STATUS_DESCRIPTION.MISSING_ATTENDANCE}
        />
        <CountCard
          label="Missing both"
          value={counts.missingBoth}
          total={total}
          hint={DAILY_STATUS_DESCRIPTION.MISSING_BOTH}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status breakdown</CardTitle>
          <CardDescription>
            {formatCivilDate(counts.date)} (Asia/Dhaka). Every member falls into
            exactly one of these four.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allZero ? (
            // An explicit empty state, not an empty plot — a chart with no
            // slices reads as a rendering failure.
            <Empty>
              <EmptyTitle>No data for {formatCivilDate(counts.date)}</EmptyTitle>
              <EmptyDescription>
                No members are on record for this day. If that is unexpected,
                check the Discord page — a member sync may not have run.
              </EmptyDescription>
            </Empty>
          ) : (
            <CompositionChart
              total={total}
              totalLabel="Members"
              slices={[
                {
                  label: DAILY_STATUS_LABEL.COMPLETE,
                  value: counts.bothComplete,
                  color: DAILY_STATUS_COLOR.COMPLETE,
                },
                {
                  label: DAILY_STATUS_LABEL.MISSING_UPDATE,
                  value: counts.missingUpdateOnly,
                  color: DAILY_STATUS_COLOR.MISSING_UPDATE,
                },
                {
                  label: DAILY_STATUS_LABEL.MISSING_ATTENDANCE,
                  value: counts.missingAttendanceOnly,
                  color: DAILY_STATUS_COLOR.MISSING_ATTENDANCE,
                },
                {
                  label: DAILY_STATUS_LABEL.MISSING_BOTH,
                  value: counts.missingBoth,
                  color: DAILY_STATUS_COLOR.MISSING_BOTH,
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
