"use client";

import { NavGroupList } from "@/components/dashboard/nav-group-list";

/** Persistent navigation from the `md` breakpoint upward. */
export function SidebarNav() {
  return (
    <nav aria-label="Dashboard sections" className="px-3 py-4">
      <NavGroupList />
    </nav>
  );
}
