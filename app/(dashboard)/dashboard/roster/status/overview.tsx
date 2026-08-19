import { Info } from "lucide-react";

import {
  ROSTER_RANGE_STATUS_COLOR,
  ROSTER_RANGE_STATUS_DESCRIPTION,
  ROSTER_RANGE_STATUS_LABEL,
  ROSTER_STATUS_COLOR,
  ROSTER_STATUS_DESCRIPTION,
  ROSTER_STATUS_LABEL,
} from "./status-labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { CompositionChart } from "@/components/viz/composition-chart";
import { getRosterStatusCounts } from "@/lib/api/endpoints/roster";
import { isRosterRangeCounts } from "@/lib/api/types";
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
  /** What the denominator counts — keeps a percentage from being read as the
   *  wrong unit (enrolled vs person-days look identical as bare numbers). */
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

/** The seven-figure overview. ⚠️ The denominator is ENROLMENT, not Discord
 *  membership — these will not equal the dashboard totals. They are two
 *  different readings, not a sum and its parts. */
export async function RosterStatusOverview({ period }: { period: Period }) {
  const payload = await getRosterStatusCounts(period);

  if (isRosterRangeCounts(payload)) {
    const counts = payload.counts;
    const total = counts.enrolled;
    const personDays = total * (payload.meta.daysInRange ?? 1);

    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <Info />
          <AlertTitle>Roster totals do not equal dashboard totals</AlertTitle>
          <AlertDescription>
            The figures here count <strong>enrolled people</strong>. The daily
            analytics count <strong>Discord accounts</strong>. The gap between
            the two is exactly the people on one list but not the other —
            enrolled but never joined a server, or in a server without being on
            the roll.
          </AlertDescription>
        </Alert>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CountCard
            label="Enrolled"
            value={total}
            total={total}
            unit="people"
            hint={`Over ${payload.meta.daysInRange ?? 1} counted day${(payload.meta.daysInRange ?? 1) === 1 ? "" : "s"}.`}
          />
          <CountCard
            label="Paired to Discord"
            value={counts.paired}
            total={total}
            unit="enrolled"
            hint="A Discord account has been linked."
          />
          <CountCard
            label="Unpaired"
            value={counts.unpaired}
            total={total}
            unit="enrolled"
            hint="On the roll but no Discord account linked — outreach happens by email."
          />
          <CountCard
            label="Complete every day"
            value={counts.allComplete}
            total={total}
            unit="people"
            hint={ROSTER_RANGE_STATUS_DESCRIPTION.ALL_COMPLETE}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Person-days</CardTitle>
            <CardDescription>
              A different unit from the cards above: one person on one counted
              day. The maximum is {personDays.toLocaleString()} —{" "}
              {total.toLocaleString()} enrolled × {payload.meta.daysInRange ?? 1}{" "}
              day{(payload.meta.daysInRange ?? 1) === 1 ? "" : "s"}.
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
              hint="Neither submission. The reminder threshold acts on this."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Range breakdown</CardTitle>
            <CardDescription>
              {formatPeriod(period)} (Asia/Dhaka). Every enrolled person falls
              into exactly one of these buckets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {total === 0 ? (
              <Empty>
                <EmptyTitle>No enrolled students on record</EmptyTitle>
                <EmptyDescription>
                  The roster is empty for this range. Import a spreadsheet from
                  the Roster page to get started.
                </EmptyDescription>
              </Empty>
            ) : (
              <CompositionChart
                total={total}
                totalLabel="Enrolled"
                slices={[
                  {
                    label: ROSTER_RANGE_STATUS_LABEL.ALL_COMPLETE,
                    value: counts.allComplete,
                    color: ROSTER_RANGE_STATUS_COLOR.ALL_COMPLETE,
                  },
                  {
                    label: ROSTER_RANGE_STATUS_LABEL.PARTIAL,
                    value: counts.partial,
                    color: ROSTER_RANGE_STATUS_COLOR.PARTIAL,
                  },
                  {
                    label: ROSTER_RANGE_STATUS_LABEL.NONE,
                    value: counts.none,
                    color: ROSTER_RANGE_STATUS_COLOR.NONE,
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const counts = payload.counts;
  const total = counts.enrolled;
  const allZero =
    total === 0 &&
    counts.bothComplete === 0 &&
    counts.missingUpdateOnly === 0 &&
    counts.missingAttendanceOnly === 0 &&
    counts.missingBoth === 0;

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <Info />
        <AlertTitle>Roster totals do not equal dashboard totals</AlertTitle>
        <AlertDescription>
          The figures here count <strong>enrolled people</strong>. The daily
          analytics count <strong>Discord accounts</strong>. The gap between the
          two is exactly the people on one list but not the other.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard
          label="Enrolled"
          value={total}
          total={total}
          unit="people"
        />
        <CountCard
          label="Paired to Discord"
          value={counts.paired}
          total={total}
          unit="enrolled"
        />
        <CountCard
          label="Unpaired"
          value={counts.unpaired}
          total={total}
          unit="enrolled"
          hint="No Discord account linked — outreach happens by email."
        />
        <CountCard
          label="Both complete"
          value={counts.bothComplete}
          total={total}
          unit="people"
          hint={ROSTER_STATUS_DESCRIPTION.COMPLETE}
        />
        <CountCard
          label="Missing update only"
          value={counts.missingUpdateOnly}
          total={total}
          unit="people"
          hint={ROSTER_STATUS_DESCRIPTION.MISSING_UPDATE}
        />
        <CountCard
          label="Missing attendance only"
          value={counts.missingAttendanceOnly}
          total={total}
          unit="people"
          hint={ROSTER_STATUS_DESCRIPTION.MISSING_ATTENDANCE}
        />
        <CountCard
          label="Missing both"
          value={counts.missingBoth}
          total={total}
          unit="people"
          hint={ROSTER_STATUS_DESCRIPTION.MISSING_BOTH}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status breakdown</CardTitle>
          <CardDescription>
            {formatPeriod(period)} (Asia/Dhaka). Paired enrollees fall into one
            of these four buckets; unpaired enrollees are read separately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allZero ? (
            <Empty>
              <EmptyTitle>No enrolled students for {formatPeriod(period)}</EmptyTitle>
              <EmptyDescription>
                Nobody is on the roster for this day. Import a spreadsheet from
                the Roster page to get started.
              </EmptyDescription>
            </Empty>
          ) : (
            <CompositionChart
              total={total}
              totalLabel="Enrolled"
              slices={[
                {
                  label: ROSTER_STATUS_LABEL.COMPLETE,
                  value: counts.bothComplete,
                  color: ROSTER_STATUS_COLOR.COMPLETE,
                },
                {
                  label: ROSTER_STATUS_LABEL.MISSING_UPDATE,
                  value: counts.missingUpdateOnly,
                  color: ROSTER_STATUS_COLOR.MISSING_UPDATE,
                },
                {
                  label: ROSTER_STATUS_LABEL.MISSING_ATTENDANCE,
                  value: counts.missingAttendanceOnly,
                  color: ROSTER_STATUS_COLOR.MISSING_ATTENDANCE,
                },
                {
                  label: ROSTER_STATUS_LABEL.MISSING_BOTH,
                  value: counts.missingBoth,
                  color: ROSTER_STATUS_COLOR.MISSING_BOTH,
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}