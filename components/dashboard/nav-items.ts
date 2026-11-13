import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  MailCheck,
  Megaphone,
  MessagesSquare,
  Send,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /**
   * One line of concrete context shown under the label, so a first-time
   * visitor can tell what the section does without clicking into it.
   * Naming convention: the label is the section's noun phrase; this
   * description says what it manages — never repeat the label verbatim.
   */
  description: string;
  icon: LucideIcon;
  /** Sub-routes highlight their parent, but only `/dashboard` matches exactly. */
  exact?: boolean;
};

export type NavGroup = {
  /**
   * Sentence-style group heading. Optional — the first group renders
   * without one so the landing page sits at the very top of the sidebar.
   */
  heading?: string;
  items: NavItem[];
};

/**
 * Sidebar structure, top to bottom:
 *
 * - Overview — the landing snapshot.
 * - Automation — everything the bot does on a schedule.
 * - Members & Roster — the two identity sources (Discord directory,
 *   enrolment roster) every other section reads from.
 * - Attendance — the read views over attendance data, aggregate first.
 * - Account — the signed-in admin's own settings.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        href: "/dashboard",
        label: "Overview",
        description: "Today's attendance at a glance",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    heading: "Automation",
    items: [
      {
        href: "/dashboard/schedule",
        label: "Daily Update Schedule",
        description: "When #daily-update opens and locks",
        icon: CalendarClock,
      },
      {
        href: "/dashboard/announcement",
        label: "Announcement",
        description: "The nightly message posted to #daily-update",
        icon: Megaphone,
      },
      {
        href: "/dashboard/reminders",
        label: "Reminders",
        description: "Remind students who fall behind",
        icon: Send,
      },
      {
        href: "/dashboard/reminders/emails",
        label: "Email log",
        description: "Who was emailed, who opened it",
        icon: MailCheck,
      },
    ],
  },
  {
    heading: "Members & Roster",
    items: [
      {
        href: "/dashboard/discord",
        label: "Discord Servers",
        description: "Bot health and the synced member directory",
        icon: MessagesSquare,
      },
      {
        href: "/dashboard/roster",
        label: "Enrolment Roster",
        description: "Enrolled students and the verified-email gate",
        icon: GraduationCap,
      },
      {
        href: "/dashboard/registration",
        label: "Registration",
        description: "The public sign-up form and who has registered",
        icon: ClipboardList,
      },
    ],
  },
  {
    heading: "Attendance",
    items: [
      {
        href: "/dashboard/status",
        label: "Daily Analytics",
        description: "Completion figures and trends per day",
        icon: BarChart3,
        exact: true,
      },
      {
        href: "/dashboard/members",
        label: "Member Status",
        description: "Discord members and enrolled students",
        icon: Users,
      },
    ],
  },
  {
    heading: "Account",
    items: [
      {
        href: "/dashboard/settings",
        label: "Settings",
        description: "Your profile, password and appearance",
        icon: Settings,
      },
    ],
  },
];

/** Flat view of `NAV_GROUPS`, in sidebar order. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(
  (group) => group.items,
);

export function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

/**
 * `isActive` with precedence: when two items match a pathname, the more
 * specific one (longer href) wins the highlight, so `/dashboard/reminders/emails`
 * lights up "Email log" alone instead of also lighting up "Reminders".
 */
export function isItemActive(
  pathname: string,
  item: NavItem,
  all: NavItem[] = NAV_ITEMS,
): boolean {
  if (!isActive(pathname, item)) return false;
  return !all.some(
    (other) =>
      other.href !== item.href &&
      other.href.startsWith(item.href) &&
      isActive(pathname, other),
  );
}
