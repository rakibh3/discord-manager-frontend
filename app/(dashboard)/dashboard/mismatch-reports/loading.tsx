import { Skeleton } from "@/components/ui/skeleton";

/** Segment-level fallback for the reports page. The page has a single panel
 *  (heading + filter bar + table), so the skeleton keeps the same shape. */
export default function MismatchReportsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-10" />
      <Skeleton className="h-96" />
    </div>
  );
}
