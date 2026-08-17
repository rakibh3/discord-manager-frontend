"use client";

import { ChevronDown, Table2 } from "lucide-react";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCivilDate } from "@/lib/dhaka-date";
import { DAILY_STATUS_COLOR, DAILY_STATUS_LABEL } from "./status-labels";

export type TrendPoint = {
  date: string;
  complete: number;
  missingUpdate: number;
  missingAttendance: number;
  missingBoth: number;
};

const SERIES = [
  { key: "complete", status: "COMPLETE" },
  { key: "missingUpdate", status: "MISSING_UPDATE" },
  { key: "missingAttendance", status: "MISSING_ATTENDANCE" },
  { key: "missingBoth", status: "MISSING_BOTH" },
] as const;

/** Stacked daily totals, labelled rather than distinguished by colour alone. */
export function StatusTrendChart({ points }: { points: TrendPoint[] }) {
  const data = points.map((point) => ({
    ...point,
    label: formatCivilDate(point.date),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {SERIES.map((series) => (
          <span
            key={series.key}
            className="text-muted-foreground flex items-center gap-1.5 text-xs"
          >
            <span
              aria-hidden
              className="size-2.5 rounded-[2px]"
              style={{ background: DAILY_STATUS_COLOR[series.status] }}
            />
            {DAILY_STATUS_LABEL[series.status]}
          </span>
        ))}
      </div>

      <div className="pb-3">
        <BarChart
          data={data}
          xDataKey="label"
          stacked
          aspectRatio="3 / 1"
          margin={{ top: 16, right: 8, bottom: 36, left: 16 }}
        >
          <Grid horizontal />
          {SERIES.map((series) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              fill={DAILY_STATUS_COLOR[series.status]}
            />
          ))}
          <BarXAxis />
          <ChartTooltip />
        </BarChart>
      </div>

      <details className="group border-border/60 bg-muted/20 hover:bg-muted/30 open:bg-card mt-1 rounded-lg border transition-colors">
        <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center justify-between rounded-lg px-3.5 py-2.5 text-xs font-medium transition-colors select-none focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <Table2 className="size-3.5" />
            Show these figures as a table
          </span>
          <ChevronDown className="text-muted-foreground size-4 transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="border-border/50 border-t p-3 pt-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {SERIES.map((series) => (
                    <TableHead key={series.key} className="text-right">
                      {DAILY_STATUS_LABEL[series.status]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((point) => (
                  <TableRow key={point.date}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {point.label}
                    </TableCell>
                    {SERIES.map((series) => (
                      <TableCell
                        key={series.key}
                        className="text-right font-mono tabular-nums"
                      >
                        {point[series.key].toLocaleString()}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </details>
    </div>
  );
}
