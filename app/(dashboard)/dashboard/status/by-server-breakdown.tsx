import { Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isRangeCounts, type DailyStatusAnyCounts } from "@/lib/api/types";

/** The per-server figures that sit alongside the combined ones.
 *
 *  ⚠️ These do **not** sum to the combined totals, and that is not a bug: the
 *  combined figures count **people** (someone in two servers counts once) and
 *  these count each server's **memberships** (they count once in each). The
 *  difference between the two is exactly the number of people in more than one
 *  server. They are presented as a separate reading rather than as a total and
 *  its parts, because reading them as parts is the mistake this shape invites. */
export function ByServerBreakdown({
  counts,
  combinedTotal,
}: {
  counts: DailyStatusAnyCounts;
  combinedTotal: number;
}) {
  const byServer = counts.byServer ?? [];
  if (byServer.length === 0) return null;

  const range = isRangeCounts(counts);
  const membershipTotal = byServer.reduce(
    (sum, server) => sum + server.totalMembers,
    0,
  );
  const overlap = membershipTotal - combinedTotal;

  return (
    <Card>
      <CardHeader>
        <CardTitle>By server</CardTitle>
        <CardDescription>
          A second reading of the same days, one row per server. Work done in one
          server counts everywhere: someone in server B who posted in server A is
          submitted in B&rsquo;s figures too.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert>
          <Info />
          <AlertTitle>These rows do not add up to the totals above</AlertTitle>
          <AlertDescription>
            The figures above count <strong>people</strong>; these count{" "}
            <strong>memberships</strong>, so anyone in two servers is counted in
            both rows.
            {overlap > 0 ? (
              <>
                {" "}
                The gap is exactly {overlap.toLocaleString()} — the number of
                people in more than one server.
              </>
            ) : null}
          </AlertDescription>
        </Alert>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Server</TableHead>
                <TableHead className="text-right">Members</TableHead>
                {range ? (
                  <>
                    <TableHead className="text-right">Complete daily</TableHead>
                    <TableHead className="text-right">Partial</TableHead>
                    <TableHead className="text-right">None</TableHead>
                    <TableHead className="text-right">Missed both</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="text-right">Attendance</TableHead>
                    <TableHead className="text-right">Update</TableHead>
                    <TableHead className="text-right">Complete</TableHead>
                    <TableHead className="text-right">Missing both</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {range && isRangeCounts(counts)
                ? (counts.byServer ?? []).map((server) => (
                    <TableRow key={server.guildId}>
                      <TableCell className="font-medium">
                        {server.label}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {server.totalMembers.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {server.allCompleteMembers.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {server.partialMembers.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {server.noneMembers.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {server.missedBothDays.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                : !range && !isRangeCounts(counts)
                  ? (counts.byServer ?? []).map((server) => (
                      <TableRow key={server.guildId}>
                        <TableCell className="font-medium">
                          {server.label}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {server.totalMembers.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {server.attendanceSubmitted.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {server.dailyUpdateSubmitted.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {server.bothComplete.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {server.missingBoth.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
