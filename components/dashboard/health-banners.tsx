import { AlertTriangle, BotOff, ExternalLink, MessageSquareOff } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { aggregateSyncState, latestFallback } from "@/lib/api/derive";
import { getSyncStatus } from "@/lib/api/endpoints/discord";
import { getQueueStatus } from "@/lib/api/endpoints/reminders";
import { formatRelative } from "@/lib/dhaka-date";

const DEVELOPER_PORTAL = "https://discord.com/developers/applications";

/** The outages nothing else reveals: the API keeps answering 200 while the
 *  system quietly stops working. Severity matches what is actually happening. */
export async function HealthBanners() {
  // Neither read may blank the shell. A transport failure belongs to the page's
  // own error boundary, not to a banner strip.
  const [status, queue] = await Promise.all([
    getSyncStatus().catch(() => null),
    getQueueStatus().catch(() => null),
  ]);

  const banners: React.ReactNode[] = [];

  // Sync state is per server on the wire; one tripped guard anywhere is the
  // condition worth surfacing, which is exactly what the merge preserves.
  const sync = status ? aggregateSyncState(status.servers) : null;

  if (status && !status.bot.connected) {
    banners.push(
      <Alert variant="destructive" key="bot">
        <BotOff />
        <AlertTitle>The Discord bot is not connected</AlertTitle>
        <AlertDescription>
          Member sync, daily-update message ingestion, scheduled channel opening
          and locking, and reminder DMs are <strong>all down</strong>. The REST
          API keeps serving, so the dashboard still loads and past data is
          intact — but nothing new is being recorded and no controls that need
          the bot will work until it reconnects.
        </AlertDescription>
      </Alert>,
    );
  }

  if (status && !status.dailyUpdate.ingestionEnabled) {
    banners.push(
      <Alert variant="destructive" key="ingestion">
        <MessageSquareOff />
        <AlertTitle>Daily updates are not being recorded</AlertTitle>
        <AlertDescription>
          The bot logged in without the Message Content intent, so every message
          it receives arrives empty. No daily update is being stored, and every
          member will appear as missing their update regardless of what they
          actually posted.
          {status.dailyUpdate.reason ? (
            <>
              {" "}
              Reason given: <em>{status.dailyUpdate.reason}</em>.
            </>
          ) : null}{" "}
          Enable <strong>Message Content Intent</strong> for this application
          and restart the bot.{" "}
          <a
            className="inline-flex items-center gap-1 underline underline-offset-4"
            href={DEVELOPER_PORTAL}
            target="_blank"
            rel="noreferrer noopener"
          >
            Discord Developer Portal
            <ExternalLink aria-hidden className="size-3" />
          </a>
        </AlertDescription>
      </Alert>,
    );
  }

  if (sync?.guardTripped) {
    banners.push(
      <Alert variant="warning" key="guard">
        <AlertTriangle />
        <AlertTitle>A member reconcile was skipped by the departure guard</AlertTitle>
        <AlertDescription>
          The last sync fetched suspiciously few members, so the guard declined
          to mark the missing ones as departed. This is the guard doing its job —
          it stopped a partial fetch from wiping most of the directory. The
          member list is <strong>stale but intact</strong>; run a sync from the
          Discord page once the bot is fetching normally again.
        </AlertDescription>
      </Alert>,
    );
  }

  // ── Multi-server silent failures (API_INTEGRATION.md §5A) ─────────────────

  const servers = status?.servers ?? [];
  const unreachable = servers.filter((server) => !server.reachable);

  if (servers.length > 1 && unreachable.length > 0) {
    banners.push(
      <Alert variant="destructive" key="unreachable-servers">
        <BotOff />
        <AlertTitle>
          {unreachable.length === 1
            ? `The bot cannot reach ${unreachable[0].label}`
            : `The bot cannot reach ${unreachable.length} servers`}
        </AlertTitle>
        <AlertDescription>
          Everything still works for the other servers, which is exactly why
          this is easy to miss: totals keep updating and nothing errors, while{" "}
          {unreachable.map((server) => server.label).join(", ")} record nothing
          at all.
          {unreachable[0].unreachableReason ? (
            <>
              {" "}
              Reason given: <em>{unreachable[0].unreachableReason}</em>
            </>
          ) : null}
        </AlertDescription>
      </Alert>,
    );
  }

  // A channel ID pointing at another guild is invisible in configuration and in
  // Discord, because every server names its channels identically. The verified
  // flag is the only symptom before "one server went quiet" is noticed by hand.
  const misconfigured = servers.flatMap((server) =>
    Object.entries(server.channels ?? {})
      .filter(([, check]) => check && !check.verified)
      .map(([key, check]) => ({
        server: server.label,
        channel: key,
        error: check?.error ?? null,
      })),
  );

  if (misconfigured.length > 0) {
    banners.push(
      <Alert variant="destructive" key="channel-verification">
        <AlertTriangle />
        <AlertTitle>
          A configured channel belongs to the wrong Discord server
        </AlertTitle>
        <AlertDescription className="flex flex-col gap-1.5">
          <span>
            Every server names its channels identically, so this looks correct
            in the configuration and in Discord alike. Affected:{" "}
            {misconfigured
              .map((entry) => `${entry.server} (${entry.channel})`)
              .join(", ")}
            . Until it is fixed, that server is silently served the wrong
            channel — or none at all.
          </span>
          {misconfigured[0].error ? (
            <code className="bg-muted overflow-x-auto rounded p-1.5 font-mono text-xs">
              {misconfigured[0].error}
            </code>
          ) : null}
        </AlertDescription>
      </Alert>,
    );
  }

  const fallback = queue ? latestFallback(queue) : null;

  if (fallback?.missingPermission) {
    banners.push(
      <Alert variant="destructive" key="fallback">
        <MessageSquareOff />
        <AlertTitle>
          The fallback channel announcement reached nobody
        </AlertTitle>
        <AlertDescription>
          After the last broadcast ({formatRelative(fallback.ranAt)}),
          the members whose DMs are closed were supposed to be mentioned in{" "}
          <code className="font-mono text-xs">#daily-update-reminder</code>{" "}
          instead. The bot lacks <strong>Send Messages</strong> on that channel,
          so that message was never posted — precisely the members who most
          needed the reminder got nothing at all. Grant the permission and the
          next broadcast&rsquo;s fallback will work.
        </AlertDescription>
      </Alert>,
    );
  }

  if (banners.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" role="region" aria-label="System health">
      {banners}
    </div>
  );
}

export function HealthBannersSkeleton() {
  // Zero height: most of the time there is nothing to show, so reserving space
  // for banners would leave a permanent gap under the header.
  return <Skeleton className="sr-only h-0" />;
}
