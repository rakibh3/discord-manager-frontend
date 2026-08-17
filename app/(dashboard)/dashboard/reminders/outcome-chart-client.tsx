"use client";

import { ChevronDown, Table2 } from "lucide-react";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { CHART_COLORS } from "@/components/viz/chart-tokens";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCivilDate } from "@/lib/dhaka-date";

export type OutcomePoint = {
  date: string;
  delivered: number;
  dmClosed: number;
  failed: number;
};

const SERIES = [
  {
    key: "delivered",
    label: "Delivered",
    color: CHART_COLORS.positive,
  },
  {
    key: "dmClosed",
    label: "DMs closed — mentioned in channel",
    color: CHART_COLORS.caution,
  },
  { key: "failed", label: "Failed", color: CHART_COLORS.negative },
] as const;

/**
 * Composed root → Grid → series → axes → tooltip, per the registry's rules,
 * with colours from the shared `--chart-*` tokens rather than literals.
 *
 * The legend names every series and the same figures appear in the table below,
 * so nothing here depends on telling colours apart. DMs-closed is charted
 * separately from failures on purpose — it is not a delivery failure.
 */
export function OutcomeChartClient({ points }: { points: OutcomePoint[] }) {
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
              style={{ background: series.color }}
            />
            {series.label}
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
            <Bar key={series.key} dataKey={series.key} fill={series.color} />
          ))}
          <BarXAxis />
          <ChartTooltip />
        </BarChart>
      </div>

      {/* Text equivalent — the same numbers, available without the chart. */}
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
                  <TableHead>Broadcast date</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">DMs closed</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((point) => (
                  <TableRow key={point.date}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {point.label}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {point.delivered.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {point.dmClosed.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {point.failed.toLocaleString()}
                    </TableCell>
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
