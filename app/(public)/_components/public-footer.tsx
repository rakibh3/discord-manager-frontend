"use client";

import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Subtle footer for the public student portal. Keeps the admin login route
 *  unlisted by design while offering a clean link between the two public forms. */
export function PublicFooter() {
  const pathname = usePathname();
  const isRegister = pathname === "/register" || pathname.startsWith("/register/");

  return (
    <footer className="border-border-muted bg-background/90 mt-auto border-t-2">
      <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-3 px-4 py-4 text-xs sm:flex-row sm:items-center sm:px-6">
        <p className="text-muted-foreground flex items-center gap-1.5 font-mono">
          <Clock aria-hidden="true" className="size-3.5 shrink-0" />
          <span>All schedules and dates follow Asia/Dhaka (UTC+6).</span>
        </p>

        {isRegister ? (
          <Link
            href="/"
            className="text-foreground hover:bg-highlight hover:text-highlight-foreground inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium underline decoration-2 underline-offset-4 transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span>Already enrolled &amp; in Discord? Submit daily attendance</span>
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        ) : (
          <Link
            href="/register"
            className="text-foreground hover:bg-highlight hover:text-highlight-foreground inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium underline decoration-2 underline-offset-4 transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span>New to the program? Register first</span>
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        )}
      </div>
    </footer>
  );
}
