import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ProgressView } from "./progress-view";
import { RecipientAudit } from "./recipients";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { getProgress, getQueueStatus } from "@/lib/api/endpoints/reminders";
import type { ReminderDeliveryStatus } from "@/lib/api/types";

export const metadata: Metadata = { title: "Broadcast" };

const DELIVERY_STATUSES = new Set<string>([
  "PENDING",
  "DELIVERED",
  "DM_CLOSED",
  "FAILED",
]);

async function Progress({ id }: { id: string }) {
  // Server-render the first read and hand it to the client as `initial`, so the
  // progress view never flashes empty before its first poll.
  let progress;
  try {
    progress = await getProgress(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  // The estimate needs the configured pacing; fall back to the documented
  // default rather than dropping it, since a bar with no estimate reads as hung.
  const queue = await getQueueStatus().catch(() => null);

  return (
    <ProgressView initial={progress} dmPerSecond={queue?.dmPerSecond ?? 2} />
  );
}

export default async function BroadcastPage({
  params,
  searchParams,
}: PageProps<"/dashboard/reminders/[id]">) {
  // Both are Promises in Next 16.
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

  const rawStatus = Array.isArray(query.status) ? query.status[0] : query.status;
  const status =
    rawStatus && DELIVERY_STATUSES.has(rawStatus)
      ? (rawStatus as ReminderDeliveryStatus)
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="self-start" asChild>
          <Link href="/dashboard/reminders">
            <ArrowLeft data-icon="inline-start" />
            All reminders
          </Link>
        </Button>
      </div>

      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Progress id={id} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-96" />}>
        <RecipientAudit id={id} page={page} status={status} />
      </Suspense>
    </div>
  );
}
