import { CHART_COLORS } from "@/components/viz/chart-tokens";
import type { RosterRangeStatus, RosterStatus } from "@/lib/api/types";

// ── Roster date-mode status (API_INTEGRATION.md §8.6A) ───────────────────────

export const ROSTER_STATUS_LABEL: Record<RosterStatus, string> = {
  COMPLETE: "Complete",
  MISSING_UPDATE: "Missing update",
  MISSING_ATTENDANCE: "Missing attendance",
  MISSING_BOTH: "Missing both",
  NEVER_LINKED: "Never linked",
};

export const ROSTER_STATUS_DESCRIPTION: Record<RosterStatus, string> = {
  COMPLETE: "Submitted attendance and posted a daily update.",
  MISSING_UPDATE: "Submitted attendance, but posted no daily update.",
  MISSING_ATTENDANCE: "Posted a daily update, but did not submit attendance.",
  MISSING_BOTH: "Neither attendance nor a daily update.",
  NEVER_LINKED:
    "On the roster, but no Discord account has ever linked to this entry. Outreach happens by email.",
};

export const ROSTER_STATUS_COLOR: Record<RosterStatus, string> = {
  COMPLETE: CHART_COLORS.positive,
  MISSING_UPDATE: CHART_COLORS.caution,
  MISSING_ATTENDANCE: CHART_COLORS.alternate,
  MISSING_BOTH: CHART_COLORS.negative,
  NEVER_LINKED: CHART_COLORS.neutral,
};

/** The four-bucket set drives the date-mode filter — `NEVER_LINKED` only appears
 *  when an admin explicitly filters for it (paired/unpaired takes care of the
 *  default case). */
export const ROSTER_STATUSES: RosterStatus[] = [
  "COMPLETE",
  "MISSING_UPDATE",
  "MISSING_ATTENDANCE",
  "MISSING_BOTH",
  "NEVER_LINKED",
];

export function rosterStatusBadgeVariant(
  status: RosterStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "COMPLETE":
      return "secondary";
    case "MISSING_BOTH":
      return "destructive";
    case "NEVER_LINKED":
      return "outline";
    default:
      return "outline";
  }
}

// ── Roster range rollup ───────────────────────────────────────────────────────

export const ROSTER_RANGE_STATUS_LABEL: Record<RosterRangeStatus, string> = {
  ALL_COMPLETE: "Complete every day",
  PARTIAL: "Complete some days",
  NONE: "Complete on no day",
  NEVER_LINKED: "Never linked",
};

export const ROSTER_RANGE_STATUS_DESCRIPTION: Record<RosterRangeStatus, string> = {
  ALL_COMPLETE: "Submitted attendance and posted a daily update on every counted day.",
  PARTIAL: "Did both on some counted days, but not all of them.",
  NONE: "Did not complete both on any counted day.",
  NEVER_LINKED:
    "On the roster, but no Discord account has ever linked to this entry.",
};

export const ROSTER_RANGE_STATUS_COLOR: Record<RosterRangeStatus, string> = {
  ALL_COMPLETE: CHART_COLORS.positive,
  PARTIAL: CHART_COLORS.caution,
  NONE: CHART_COLORS.negative,
  NEVER_LINKED: CHART_COLORS.neutral,
};

export const ROSTER_RANGE_STATUSES: RosterRangeStatus[] = [
  "ALL_COMPLETE",
  "PARTIAL",
  "NONE",
  "NEVER_LINKED",
];

export function rosterRangeStatusBadgeVariant(
  status: RosterRangeStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ALL_COMPLETE":
      return "secondary";
    case "NONE":
      return "destructive";
    case "NEVER_LINKED":
      return "outline";
    default:
      return "outline";
  }
}

// ── Pairing state ─────────────────────────────────────────────────────────────

export const PAIRING_LABEL: Record<"paired" | "unpaired", string> = {
  paired: "Linked to Discord",
  unpaired: "Never linked",
};

export const PAIRING_DESCRIPTION: Record<"paired" | "unpaired", string> = {
  paired: "A Discord account has been linked to this enrolment.",
  unpaired:
    "No Discord account is linked — the entry cannot post in #daily-update or submit attendance.",
};
