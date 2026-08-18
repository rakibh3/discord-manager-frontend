/** Fixed operational meanings for the shared chart palette, so the same outcome
 *  is the same colour everywhere. Reads `--chart-*`, so it follows the theme. */
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
