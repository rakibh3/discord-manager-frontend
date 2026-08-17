"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { triggerMemberSync } from "@/actions/discord";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { DiscordSyncStatus } from "@/lib/api/types";
import { formatDhaka, formatDuration } from "@/lib/dhaka-date";

const POLL_INTERVAL_MS = 5000;

/**
 * Manual re-sync, plus the live view of a sync in flight.
 *
 * `POST /discord/sync` answers 202 before the work happens, so the only way to
 * know it finished is to poll status until `lastSync.running` is `false`.
 * Polling runs **only** while a sync is actually running: an interval that
 * keeps firing on an idle page is a request every five seconds, forever, for
 * data nobody is watching change.
 */
export function SyncControl({
  initial,
  botConnected,
}: {
  initial: DiscordSyncStatus;
  botConnected: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [polling, setPolling] = useState(initial.lastSync.running);
  const wasRunning = useRef(initial.lastSync.running);

  // Server-rendered status supersedes anything polled, so a router refresh or a
  // revalidation is never overwritten by stale client state. Adjusted during
  // render rather than in an effect, which would show one stale frame first.
  const [seenInitial, setSeenInitial] = useState(initial);
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    setStatus(initial);
    if (initial.lastSync.running) setPolling(true);
  }

  useEffect(() => {
    if (!polling) return;

    const controller = new AbortController();
    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const response = await fetch("/api/discord/sync-status", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;

        const next = (await response.json()) as DiscordSyncStatus;
        if (cancelled) return;

        setStatus(next);

        if (!next.lastSync.running) {
          setPolling(false);
          // Pull the server-rendered panels back in step with the final counts.
          router.refresh();
          if (wasRunning.current) {
            toast.success(
              next.lastSync.lastError
                ? "Sync finished with an error. See the last-sync panel."
                : "Member sync finished.",
            );
          }
        }
        wasRunning.current = next.lastSync.running;
      } catch {
        // A dropped tick is not worth surfacing — the next one retries, and an
        // error toast every five seconds during a network blip is worse than
        // a progress display that pauses.
      }
    }, POLL_INTERVAL_MS);

    // Unmount, navigation away mid-sync, or the status going terminal: clear
    // the interval and abort anything already in flight.
    return () => {
      cancelled = true;
      clearInterval(timer);
      controller.abort();
    };
  }, [polling, router]);

  const start = useCallback(() => {
    startTransition(async () => {
      const result = await triggerMemberSync();

      if (result.outcome === "error") {
        toast.error(result.message);
        return;
      }

      toast.info(result.message);
      wasRunning.current = true;
      setPolling(true);
    });
  }, []);

  const running = status.lastSync.running;
  const busy = running || pending;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={start} disabled={busy || !botConnected}>
          {busy ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          {running ? "Sync running…" : "Re-sync members"}
        </Button>

        {!botConnected ? (
          <p className="text-muted-foreground text-sm">
            Disabled: the bot is not connected, so there is nothing to sync from.
          </p>
        ) : null}
      </div>

      {/* Announced politely so a screen reader hears the sync finish. */}
      <p role="status" aria-live="polite" className="text-muted-foreground text-sm">
        {running
          ? `Syncing since ${formatDhaka(status.lastSync.startedAt, "time")} — fetched ${status.lastSync.fetched.toLocaleString()} so far.`
          : status.lastSync.finishedAt
            ? `Last sync finished ${formatDhaka(status.lastSync.finishedAt)} in ${formatDuration(status.lastSync.durationMs)}.`
            : "No sync has run on this process yet."}
      </p>
    </div>
  );
}
