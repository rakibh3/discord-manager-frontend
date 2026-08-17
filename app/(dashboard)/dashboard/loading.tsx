import { Skeleton } from "@/components/ui/skeleton";

/**
 * Segment-level fallback. Most pages also wrap their individual panels in
 * `<Suspense>`, so this is mostly seen on a cold navigation — the panel-level
 * skeletons are what handle one slow read among several fast ones.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-48" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
