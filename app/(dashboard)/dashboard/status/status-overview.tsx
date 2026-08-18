import { ByServerBreakdown } from "./by-server-breakdown";
import {
  DAILY_STATUS_COLOR,
  DAILY_STATUS_DESCRIPTION,
  DAILY_STATUS_LABEL,
  RANGE_STATUS_COLOR,
  RANGE_STATUS_DESCRIPTION,
  RANGE_STATUS_LABEL,
} from "./status-labels";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { CompositionChart } from "@/components/viz/composition-chart";
import { getDailyStatusCounts } from "@/lib/api/endpoints/daily-status";
import { isRangeCounts } from "@/lib/api/types";
import { formatPeriod, type Period } from "@/lib/period";

function percent(value: number, total: number): string {
  if (total === 0) return "—";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function CountCard({
  label,
  value,
  total,
  unit,
  hint,
}: {
  label: string;
  value: number;
  total: number;
  /** What the denominator counts, so a percentage is never read as the wrong
   *  unit — people and person-days look identical as bare numbers. */
  unit: string;
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
          {percent(value, total)} of {total.toLocaleString()} {unit}
        </p>
        {hint ? (
          <p className="text-muted-foreground text-xs leading-snug">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** The overview figures, all from the counts endpoint. They interlock, so a
 *  similar-looking number from elsewhere would quietly contradict the rest.
 *
 *  In date mode these are the seven single-day figures, counting **people**. In
 *  range mode they are the three rollup buckets plus person-day totals, which
 *  are named differently on purpose — they count person-days, not people. */
export async function StatusOverview({
  period,
  guildId,
  showByServer,
}: {
  period: Period;
  guildId: string | undefined;
  showByServer: boolean;
}) {
  const counts = await getDailyStatusCounts(period, { guildId });
  const total = counts.totalMembers;

  if (isRangeCounts(counts)) {
    const personDays = total * counts.daysInRange;

    return (
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CountCard
            label="People"
            value={total}
            total={total}
            unit="people"
            hint={`Over ${counts.daysInRange.toLocaleString()} counted day${counts.daysInRange === 1 ? "" : "s"}.`}
          />
          <CountCard
            label="Complete every day"
            value={counts.allCompleteMembers}
            total={total}
            unit="people"
            hint={RANGE_STATUS_DESCRIPTION.ALL_COMPLETE}
          />
          <CountCard
            label="Complete some days"
            value={counts.partialMembers}
            total={total}
            unit="people"
            hint={RANGE_STATUS_DESCRIPTION.PARTIAL}
          />
          <CountCard
            label="Complete on no day"
            value={counts.noneMembers}
            total={total}
            unit="people"
            hint={RANGE_STATUS_DESCRIPTION.NONE}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Person-days</CardTitle>
            <CardDescription>
              {/* Spelled out because the two units are a step apart and look
                  identical as numbers: the cards above count people, these count
                  one person on one day. */}
              A different unit from the figures above: one person on one counted
              day. The maximum is {personDays.toLocaleString()} —{" "}
              {total.toLocaleString()} people × {counts.daysInRange} day
              {counts.daysInRange === 1 ? "" : "s"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CountCard
              label="Attendance days"
              value={counts.attendanceDays}
              total={personDays}
              unit="person-days"
            />
            <CountCard
              label="Update days"
              value={counts.updateDays}
              total={personDays}
              unit="person-days"
              hint="Posted in any server — one update covers every server the person is in."
            />
            <CountCard
              label="Complete days"
              value={counts.completeDays}
              total={personDays}
              unit="person-days"
            />
            <CountCard
              label="Missed both"
              value={counts.missedBothDays}
              total={personDays}
              unit="person-days"
              hint="Neither submission. This is the figure a reminder threshold acts on."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Range breakdown</CardTitle>
            <CardDescription>
              {formatPeriod(period)} (Asia/Dhaka). Every person falls into
              exactly one of these three.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {total === 0 ? (
              <Empty>
                <EmptyTitle>No data for this range</EmptyTitle>
                <EmptyDescription>
                  Nobody is on record for these days. If that is unexpected,
                  check the Discord page — a member sync may not have run.
                </EmptyDescription>
              </Empty>
            ) : (
              <CompositionChart
                total={total}
                totalLabel="People"
                slices={[
                  {
                    label: RANGE_STATUS_LABEL.ALL_COMPLETE,
                    value: counts.allCompleteMembers,
                    color: RANGE_STATUS_COLOR.ALL_COMPLETE,
                  },
                  {
                    label: RANGE_STATUS_LABEL.PARTIAL,
                    value: counts.partialMembers,
                    color: RANGE_STATUS_COLOR.PARTIAL,
                  },
                  {
                    label: RANGE_STATUS_LABEL.NONE,
                    value: counts.noneMembers,
                    color: RANGE_STATUS_COLOR.NONE,
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>

        {showByServer ? (
          <ByServerBreakdown counts={counts} combinedTotal={total} />
        ) : null}
      </div>
    );
  }

  const allZero =
    total === 0 &&
    counts.attendanceSubmitted === 0 &&
    counts.dailyUpdateSubmitted === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard label="Total people" value={total} total={total} unit="people" />
        <CountCard
          label="Attendance submitted"
          value={counts.attendanceSubmitted}
          total={total}
          unit="people"
        />
        <CountCard
          label="Daily update submitted"
          value={counts.dailyUpdateSubmitted}
          total={total}
          unit="people"
        />
        <CountCard
          label="Both complete"
          value={counts.bothComplete}
          total={total}
          unit="people"
        />
        <CountCard
          label="Missing update only"
          value={counts.missingUpdateOnly}
          total={total}
          unit="people"
          hint={DAILY_STATUS_DESCRIPTION.MISSING_UPDATE}
        />
        <CountCard
          label="Missing attendance only"
          value={counts.missingAttendanceOnly}
          total={total}
          unit="people"
          hint={DAILY_STATUS_DESCRIPTION.MISSING_ATTENDANCE}
        />
        <CountCard
          label="Missing both"
          value={counts.missingBoth}
          total={total}
          unit="people"
          hint={DAILY_STATUS_DESCRIPTION.MISSING_BOTH}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status breakdown</CardTitle>
          <CardDescription>
            {formatPeriod(period)} (Asia/Dhaka). Every person falls into exactly
            one of these four.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allZero ? (
            // An explicit empty state, not an empty plot — a chart with no
            // slices reads as a rendering failure.
            <Empty>
              <EmptyTitle>No data for {formatPeriod(period)}</EmptyTitle>
              <EmptyDescription>
                Nobody is on record for this day. If that is unexpected, check
                the Discord page — a member sync may not have run.
              </EmptyDescription>
            </Empty>
          ) : (
            <CompositionChart
              total={total}
              totalLabel="People"
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

      {showByServer ? (
        <ByServerBreakdown counts={counts} combinedTotal={total} />
      ) : null}
    </div>
  );
}
