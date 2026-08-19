import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  GraduationCap,
  LayoutDashboard,
  LineChart,
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
  icon: LucideIcon;
  /** Sub-routes highlight their parent, but only `/dashboard` matches exactly. */
  exact?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/discord", label: "Discord", icon: MessagesSquare },
  { href: "/dashboard/schedule", label: "Schedule", icon: CalendarClock },
  {
    href: "/dashboard/announcement",
    label: "Announcement",
    icon: Megaphone,
  },
  { href: "/dashboard/reminders", label: "Reminders", icon: Send },
  { href: "/dashboard/status", label: "Daily Analytics", icon: BarChart3, exact: true },
  { href: "/dashboard/members", label: "Member Status", icon: Users },
  { href: "/dashboard/roster", label: "Roster", icon: GraduationCap },
  {
    href: "/dashboard/mismatch-reports",
    label: "Reports",
    icon: AlertTriangle,
  },
  {
    href: "/dashboard/roster/status",
    label: "Roster Engagement",
    icon: LineChart,
  },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}
