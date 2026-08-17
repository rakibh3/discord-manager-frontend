import { CHART_COLORS } from "@/components/viz/chart-tokens";
import type { DailyStatus } from "@/lib/api/types";

export const DAILY_STATUS_LABEL: Record<DailyStatus, string> = {
  COMPLETE: "Complete",
  MISSING_UPDATE: "Missing update",
  MISSING_ATTENDANCE: "Missing attendance",
  MISSING_BOTH: "Missing both",
};

export const DAILY_STATUS_DESCRIPTION: Record<DailyStatus, string> = {
  COMPLETE: "Submitted the attendance form and posted in #daily-update.",
  MISSING_UPDATE: "Submitted attendance, but posted no daily update.",
  MISSING_ATTENDANCE: "Posted a daily update, but did not submit attendance.",
  MISSING_BOTH: "Neither attendance nor a daily update.",
};

export const DAILY_STATUS_COLOR: Record<DailyStatus, string> = {
  COMPLETE: CHART_COLORS.positive,
  MISSING_UPDATE: CHART_COLORS.caution,
  MISSING_ATTENDANCE: CHART_COLORS.alternate,
  MISSING_BOTH: CHART_COLORS.negative,
};

export const DAILY_STATUSES: DailyStatus[] = [
  "COMPLETE",
  "MISSING_UPDATE",
  "MISSING_ATTENDANCE",
  "MISSING_BOTH",
];

export function statusBadgeVariant(
  status: DailyStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "COMPLETE":
      return "secondary";
    case "MISSING_BOTH":
      return "destructive";
    default:
      return "outline";
  }
}
