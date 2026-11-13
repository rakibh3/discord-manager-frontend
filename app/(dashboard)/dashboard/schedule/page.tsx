import type { Metadata } from "next";
import { Suspense } from "react";

import { ScheduleView } from "./schedule-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchedule } from "@/lib/api/endpoints/schedule";

export const metadata: Metadata = { title: "Daily update schedule" };

async function Schedule() {
  // Uncached by design: `channel.isOpen` costs a live Discord read, and a stale
  // value would misrepresent whether students can currently post.
  const payload = await getSchedule();
  return <ScheduleView initial={payload} />;
}

function ScheduleSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

export default function SchedulePage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          #daily-update schedule
        </h1>
        <p className="text-muted-foreground text-sm">
          When roughly 5,000 students may post. All times are Asia/Dhaka.
        </p>
      </div>

      <Suspense fallback={<ScheduleSkeleton />}>
        <Schedule />
      </Suspense>
    </div>
  );
}
