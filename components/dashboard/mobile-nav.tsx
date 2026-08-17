"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { isActive, NAV_ITEMS } from "@/components/dashboard/nav-items";
import { cn } from "@/lib/utils";

/**
 * Navigation for viewports below the sidebar breakpoint.
 *
 * `Dialog` is doing the accessibility work here: it traps focus while open,
 * closes on Escape, restores focus to the trigger on dismiss, and labels itself
 * from `DialogTitle`. Hand-rolling a disclosure panel would mean reimplementing
 * all of that, and the mobile toggle is exactly where keyboard users get
 * stranded when it is done by hand.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // A completed navigation dismisses the panel; otherwise the new page renders
  // behind an overlay the admin has to close by hand. Adjusted during render,
  // so the panel is already gone on the first frame of the new route.
  const [seenPathname, setSeenPathname] = useState(pathname);
  if (seenPathname !== pathname) {
    setSeenPathname(pathname);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 md:hidden"
          aria-label="Open navigation"
        >
          <Menu />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Navigation</DialogTitle>
        </DialogHeader>
        <nav aria-label="Dashboard sections">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
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
      </DialogContent>
    </Dialog>
  );
}
