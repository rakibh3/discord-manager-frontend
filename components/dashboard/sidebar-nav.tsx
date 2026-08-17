"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActive, NAV_ITEMS } from "@/components/dashboard/nav-items";
import { cn } from "@/lib/utils";

/** Persistent navigation from the `md` breakpoint upward. */
export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard sections" className="px-3 py-4">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                // Marks the section for assistive technology, not just visually.
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                  "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
