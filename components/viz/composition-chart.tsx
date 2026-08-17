"use client";

import { useId, useState } from "react";

import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { cn } from "@/lib/utils";

export type CompositionSlice = {
  label: string;
  value: number;
  /** A `--chart-*` token. Fixed per outcome so a colour means the same thing everywhere. */
  color: string;
  /** Optional plain-language note shown in the text equivalent. */
  note?: string;
};

/**
 * Part-to-whole chart with a mandatory text equivalent.
 *
 * Two rules from the design system are enforced here rather than left to each
 * call site: every series is identified by a **label**, never by colour alone,
 * and the same figures are always available as text. The legend is a real
 * definition list, so the numbers are readable by a screen reader, copyable,
 * and still there if the chart fails to render at all.
 */
export function CompositionChart({
  slices,
  total,
  totalLabel,
  emptyMessage = "No data to show for this period.",
  className,
}: {
  slices: CompositionSlice[];
  total: number;
  totalLabel: string;
  emptyMessage?: string;
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const captionId = useId();

  const visible = slices.filter((slice) => slice.value > 0);
  const isEmpty = total === 0 || visible.length === 0;

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center", className)}>
      <div className="mx-auto size-40 shrink-0 sm:mx-0">
        {isEmpty ? (
          <div className="border-muted text-muted-foreground flex size-full items-center justify-center rounded-full border-2 border-dashed p-4 text-center text-xs">
            {emptyMessage}
          </div>
        ) : (
          <PieChart
            data={visible}
            innerRadius={44}
            padAngle={0.02}
            cornerRadius={3}
            hoveredIndex={hovered}
            onHoverChange={setHovered}
            aria-describedby={captionId}
          >
            {visible.map((slice, index) => (
              <PieSlice key={slice.label} index={index} color={slice.color} />
            ))}
          </PieChart>
        )}
      </div>

      {/* The text equivalent — not a fallback, the primary reading of the data. */}
      <dl id={captionId} className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3 border-b pb-2">
          <dt className="text-muted-foreground text-xs">{totalLabel}</dt>
          <dd className="font-mono text-sm font-semibold tabular-nums">
            {total.toLocaleString()}
          </dd>
        </div>
        {slices.map((slice) => (
          <div
            key={slice.label}
            className="flex items-baseline justify-between gap-3"
          >
            <dt className="flex min-w-0 items-center gap-2 text-sm">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ background: slice.color }}
              />
              <span className="truncate">{slice.label}</span>
            </dt>
            <dd className="text-muted-foreground shrink-0 font-mono text-sm tabular-nums">
              {slice.value.toLocaleString()}
              {total > 0 ? (
                <span className="ml-1.5 text-xs">
                  ({Math.round((slice.value / total) * 100)}%)
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
