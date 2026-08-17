import { LogOut } from "lucide-react";

import { logout } from "@/actions/auth";
import { getCurrentAdmin } from "@/lib/api/endpoints/user";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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

/**
 * The signed-in admin, read from `GET /users/me`.
 *
 * This lives in its own Server Component so the layout can wrap it in
 * `<Suspense>`. A top-level `await` on the DAL in the layout would hold
 * `{children}` behind this request — the whole page would wait on the header.
 */
export async function AdminIdentity() {
  const admin = await getCurrentAdmin();

  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-8">
        <AvatarFallback className="text-xs">
          {initials(admin.name)}
        </AvatarFallback>
      </Avatar>
      <div className="hidden min-w-0 flex-col leading-tight sm:flex">
        <span className="truncate text-sm font-medium">{admin.name}</span>
        <span className="text-muted-foreground truncate text-xs">
          {admin.email}
        </span>
      </div>
      <form action={logout}>
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label="Sign out"
        >
          <LogOut />
        </Button>
      </form>
    </div>
  );
}

/** Reserves the resolved layout's space so nothing shifts when it arrives. */
export function AdminIdentitySkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-8 rounded-full" />
      <div className="hidden flex-col gap-1 sm:flex">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-36" />
      </div>
      <Skeleton className="size-11 rounded-md" />
    </div>
  );
}
