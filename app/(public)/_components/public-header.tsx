"use client";

import { CalendarCheck2, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Daily Attendance",
    shortLabel: "Attendance",
    icon: CalendarCheck2,
  },
  {
    href: "/register",
    label: "Register",
    shortLabel: "Register",
    icon: UserPlus,
  },
] as const;

/** Shared top navigation bar for the two public student forms (`/` and `/register`).
 *  Uses semantic landmarks, a keyboard skip link, `aria-current="page"` on the
 *  active route, and a light/dark theme switcher. */
export function PublicHeader() {
  const pathname = usePathname();

  return (
    <>
      <a
        href="#main-content"
        className="bg-highlight text-highlight-foreground border-foreground focus:not-sr-only sr-only fixed top-3 left-3 z-50 rounded-xl border-2 px-4 py-2 text-sm font-semibold shadow-xs focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Skip to main content
      </a>

      <header className="border-foreground bg-background/95 sticky top-0 z-30 border-b-2 backdrop-blur-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span
              aria-hidden="true"
              className="bg-highlight text-highlight-foreground border-foreground flex size-9 shrink-0 items-center justify-center rounded-xl border-2 shadow-[2px_2px_0_0_var(--shadow-color)] transition-transform group-hover:-translate-x-px group-hover:-translate-y-px"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
                aria-hidden="true"
              >
                <path d="M9 11l3 3L20 6" />
                <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
              </svg>
            </span>

            <span className="flex min-w-0 flex-col">
              <span className="font-heading truncate text-sm leading-tight font-bold tracking-tight sm:text-base">
                Student Portal
              </span>
              <span className="text-muted-foreground hidden font-mono text-[11px] leading-tight sm:inline">
                ASIA/DHAKA · DISCORD COHORT
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <nav
              aria-label="Student portal"
              className="border-foreground bg-muted/80 flex items-center gap-1 rounded-xl border-2 p-1"
            >
              {NAV_ITEMS.map(({ href, label, shortLabel, icon: Icon }) => {
                const active =
                  href === "/"
                    ? pathname === "/"
                    : pathname === href || pathname.startsWith(`${href}/`);

                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-8 items-center gap-1.5 rounded-lg border-2 px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-3 sm:text-sm",
                      active
                        ? "border-foreground bg-highlight text-highlight-foreground shadow-[2px_2px_0_0_var(--shadow-color)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-card/80 border-transparent",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-3.5 shrink-0 sm:size-4" />
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{shortLabel}</span>
                  </Link>
                );
              })}
            </nav>

            <ThemeToggle
              align="end"
              className="border-foreground bg-card text-foreground hover:bg-accent hover:text-accent-foreground size-9 rounded-xl border-2 shadow-xs"
            />
          </div>
        </div>
      </header>
    </>
  );
}
