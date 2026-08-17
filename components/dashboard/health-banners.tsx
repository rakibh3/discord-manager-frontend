import { AlertTriangle, BotOff, ExternalLink, MessageSquareOff } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { getSyncStatus } from "@/lib/api/endpoints/discord";
import { getQueueStatus } from "@/lib/api/endpoints/reminders";
import { formatRelative } from "@/lib/dhaka-date";

const DEVELOPER_PORTAL = "https://discord.com/developers/applications";

/**
 * The outages nothing else on the dashboard reveals.
 *
 * Each of these is silent by construction: the API keeps answering 200, the
 * pages keep rendering numbers, and the system is quietly not doing its job.
 * They are mounted dashboard-wide rather than on the Discord page, because an
 * admin who never opens that page is exactly who needs to see them.
 *
 * Severity is matched to what is actually happening — the departure guard
 * firing is the guard *working*, and dressing it as an error alongside a real
 * outage teaches admins to dismiss both.
 */
export async function HealthBanners() {
  // Neither read is allowed to blank the shell. If the API is unreachable the
  // page's own error boundary reports it; a banner strip is the wrong place to
  // surface a transport failure.
  const [status, queue] = await Promise.all([
    getSyncStatus().catch(() => null),
    getQueueStatus().catch(() => null),
  ]);

  const banners: React.ReactNode[] = [];

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

  if (status?.lastSync.guardTripped) {
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

  if (queue?.lastFallback?.missingPermission) {
    banners.push(
      <Alert variant="destructive" key="fallback">
        <MessageSquareOff />
        <AlertTitle>
          The fallback channel announcement reached nobody
        </AlertTitle>
        <AlertDescription>
          After the last broadcast ({formatRelative(queue.lastFallback.ranAt)}),
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
