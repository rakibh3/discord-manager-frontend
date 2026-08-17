/**
 * Fixed operational meanings for the shared chart palette.
 *
 * The point of pinning these is that the same outcome is the same colour on
 * every chart in the app — "delivered" is never green on one page and blue on
 * another. Charts must still label each series; this is a consistency aid, not
 * a substitute for a legend.
 *
 * These read the `--chart-*` custom properties rather than literal colours, so
 * they follow the theme in both light and dark mode.
 */
export const CHART_COLORS = {
  /** Delivered · complete · active — the good outcome. */
  positive: "var(--chart-1)",
  /** DMs closed · missing update — attention, but not a failure. */
  caution: "var(--chart-2)",
  /** Failed · missing both — a real failure. */
  negative: "var(--chart-3)",
  /** Pending · never attempted — no outcome yet. */
  neutral: "var(--chart-4)",
  /** Departed · missing attendance — a fifth distinct category. */
  alternate: "var(--chart-5)",
} as const;
