"use client";

import { Menu } from "lucide-react";
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
import { NavGroupList } from "@/components/dashboard/nav-group-list";

/** Navigation below the sidebar breakpoint. `Dialog` does the accessibility work
 *  — focus trap, Escape, focus restore, labelling from `DialogTitle`. */
export function MobileNav({ footer }: { footer?: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // A completed navigation dismisses the panel. Adjusted during render, so it is
  // already gone on the first frame of the new route.
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
        <nav
          aria-label="Dashboard sections"
          className="-mx-1 max-h-[60svh] overflow-y-auto px-1"
        >
          <NavGroupList />
        </nav>
        {footer && <div className="border-t pt-3 mt-2">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}

