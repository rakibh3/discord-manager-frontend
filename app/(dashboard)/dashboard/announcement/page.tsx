import type { Metadata } from "next";
import { Suspense } from "react";

import { AnnouncementView } from "./announcement-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getAnnouncement } from "@/lib/api/endpoints/announcement";

export const metadata: Metadata = { title: "Announcement" };

async function Announcement() {
  // Uncached by design: `preview.content` has today's date expanded into it, and
  // `today.posted` gates the send button. Either served stale would mislead.
  const payload = await getAnnouncement();
  return <AnnouncementView initial={payload} />;
}

function AnnouncementSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-[32rem]" />
    </div>
  );
}

export default function AnnouncementPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          #attendance announcement
        </h1>
        <p className="text-muted-foreground text-sm">
          The evening message that tells roughly 5,000 students to submit. All
          times are Asia/Dhaka.
        </p>
      </div>

      <Suspense fallback={<AnnouncementSkeleton />}>
        <Announcement />
      </Suspense>
    </div>
  );
}
