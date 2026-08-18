import { Suspense } from "react";

import {
  AdminIdentity,
  AdminIdentitySkeleton,
} from "@/components/dashboard/admin-identity";
import {
  HealthBanners,
  HealthBannersSkeleton,
} from "@/components/dashboard/health-banners";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { requireSession } from "@/lib/auth/session";

/** The authenticated shell. `requireSession()` runs here but is not the boundary
 *  — every data-access function repeats it. Slow reads sit in nested `<Suspense>`. */
export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  await requireSession();

  return (
    <div className="flex min-h-svh w-full flex-col md:flex-row">
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-64 shrink-0 border-r md:sticky md:top-0 md:flex md:h-svh md:flex-col md:justify-between">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-sidebar-border flex h-14 shrink-0 items-center border-b px-6 text-sm font-semibold tracking-tight">
            Discord Manager
          </div>
          <div className="flex-1 overflow-y-auto">
            <SidebarNav />
          </div>
        </div>
        <div className="border-sidebar-border border-t p-3">
          <Suspense fallback={<AdminIdentitySkeleton />}>
            <AdminIdentity />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/75 sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b px-3 backdrop-blur md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav
              footer={
                <Suspense fallback={<AdminIdentitySkeleton />}>
                  <AdminIdentity />
                </Suspense>
              }
            />
            <span className="truncate text-sm font-semibold tracking-tight">
              Discord Manager
            </span>
          </div>
          <ThemeToggle />
        </header>

        <main className="flex min-w-0 flex-1 flex-col gap-4 p-3 md:p-6">
          <Suspense fallback={<HealthBannersSkeleton />}>
            <HealthBanners />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}

