"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isItemActive, NAV_GROUPS } from "@/components/dashboard/nav-items";
import { cn } from "@/lib/utils";

/**
 * The grouped navigation list, shared by the desktop sidebar and the
 * mobile dialog. One line per item; the item's description is its tooltip.
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
                    // The description is a hover hint, not a second line: eleven
                    // links with a sub-line each is ~30 lines of grey text to
                    // read on every page just to navigate.
                    title={item.description}
                    className={cn(
                      "flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-transform active:translate-x-[1px] active:translate-y-[1px]",
                      "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                      active
                        ? "border-2 border-foreground bg-accent text-accent-foreground shadow-2xs"
                        : "border-2 border-transparent text-foreground/80 hover:border-foreground/30 hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <item.icon aria-hidden className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
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
