import { LogOut } from "lucide-react";

import { logout } from "@/actions/auth";
import { getCurrentAdmin } from "@/lib/api/endpoints/user";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** The signed-in admin from `GET /users/me`, in its own Server Component so the
 *  layout can `<Suspense>` it instead of holding `{children}` behind the call. */
export async function AdminIdentity() {
  const admin = await getCurrentAdmin();

  return (
    <div className="flex w-full items-center gap-3">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="text-xs">
          {initials(admin.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm font-medium text-sidebar-foreground">
          {admin.name}
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {admin.email}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <ThemeToggle />
        <form action={logout} className="shrink-0">
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

/** Reserves the resolved layout's space so nothing shifts when it arrives. */
export function AdminIdentitySkeleton() {
  return (
    <div className="flex w-full items-center gap-3">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Skeleton className="size-8 shrink-0 rounded-md" />
        <Skeleton className="size-8 shrink-0 rounded-md" />
      </div>
    </div>
  );
}

