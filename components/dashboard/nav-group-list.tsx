"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isItemActive, NAV_GROUPS } from "@/components/dashboard/nav-items";
import { cn } from "@/lib/utils";

/**
 * The grouped navigation list, shared by the desktop sidebar and the
 * mobile dialog. Each item renders its label plus a one-line description
 * so the sections are self-explanatory on first sight.
 */
export function NavGroupList() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col">
      {NAV_GROUPS.map((group, index) => (
        <div key={group.heading ?? `ungrouped-${index}`}>
          {group.heading ? (
            <p className="text-muted-foreground/70 px-3 pt-4 pb-1 text-xs font-semibold tracking-wider uppercase">
              {group.heading}
            </p>
          ) : null}
          <ul className="flex flex-col gap-1">
            {group.items.map((item) => {
              const active = isItemActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    // Marks the section for assistive technology, not just visually.
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-start gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <item.icon aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <span className="flex min-w-0 flex-col">
                      <span className="leading-5">{item.label}</span>
                      <span
                        className={cn(
                          "text-xs font-normal leading-snug",
                          active
                            ? "text-sidebar-accent-foreground/75"
                            : "text-muted-foreground/80",
                        )}
                      >
                        {item.description}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
