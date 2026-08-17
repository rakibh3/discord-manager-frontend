import type { Metadata } from "next";
import { Suspense } from "react";

import { Composer } from "./composer";
import { BroadcastHistory } from "./history";
import { QueueHealthPanel } from "./queue-health";
import { Skeleton } from "@/components/ui/skeleton";
import { getQueueStatus } from "@/lib/api/endpoints/reminders";

export const metadata: Metadata = { title: "Reminders" };

async function QueueHealth() {
  const status = await getQueueStatus();
  return <QueueHealthPanel initial={status} />;
}

async function SendComposer() {
  // Redis being down is the difference between a send working and a 503, so the
  // composer needs queue health before it can decide whether to allow one.
  // `getQueueStatus` is memoized per render pass, so this shares the panel's call.
  const status = await getQueueStatus().catch(() => null);

  const redisDown = status !== null && !status.redisConnected;

  return (
    <Composer
      dmPerSecond={status?.dmPerSecond ?? 2}
      sendingDisabled={redisDown}
      disabledReason={
        redisDown
          ? "The reminder queue's Redis connection is down, so a send would be rejected with 503. The API, the bot, message ingestion and the channel scheduler are all unaffected — only sending is blocked."
          : null
      }
    />
  );
}

/**
 * Each region loads independently.
 *
 * Every authenticated read touches cookies, which blocks this segment's
 * `loading.tsx` — so a slow queue-health read would otherwise hold the composer
 * and the history behind it. Each skeleton reserves roughly the resolved
 * layout's height so nothing jumps when the real panel arrives.
 */
export default async function RemindersPage({
  searchParams,
}: PageProps<"/dashboard/reminders">) {
  // `searchParams` is a Promise in Next 16.
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Reminders</h1>
        <p className="text-muted-foreground text-sm">
          Direct-message members who have no daily update recorded for a given
          day. Delivery is paced and cannot be undone.
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-56" />}>
        <QueueHealth />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-[32rem]" />}>
        <SendComposer />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-96" />}>
        <BroadcastHistory page={page} />
      </Suspense>
    </div>
  );
}
