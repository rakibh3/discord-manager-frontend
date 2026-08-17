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
import { requireSession } from "@/lib/auth/session";

/**
 * The authenticated shell.
 *
 * `requireSession()` runs here, but this is *not* the authorization boundary —
 * layouts don't re-render on client-side navigation and don't control whether
 * their segments render. Every data-access function calls `requireSession()`
 * too, which puts the real guarantee at the data source. This call just stops
 * the chrome rendering for a signed-out visitor.
 *
 * Both the admin identity and the health banners are pushed into nested Server
 * Components inside their own `<Suspense>` boundaries. A top-level `await` on
 * either would hold `{children}` behind it, so every page in the dashboard
 * would wait on the header's `/users/me` call before rendering anything.
 */
export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  await requireSession();

  return (
    <div className="flex min-h-svh w-full flex-col md:flex-row">
      <aside className="bg-sidebar text-sidebar-foreground hidden w-60 shrink-0 border-r md:sticky md:top-0 md:flex md:h-svh md:flex-col md:overflow-y-auto">
        <div className="flex h-14 shrink-0 items-center px-6 text-sm font-semibold tracking-tight">
          Discord Manager
        </div>
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/75 sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b px-3 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav />
            <span className="truncate text-sm font-semibold tracking-tight md:hidden">
              Discord Manager
            </span>
          </div>
          <Suspense fallback={<AdminIdentitySkeleton />}>
            <AdminIdentity />
          </Suspense>
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
