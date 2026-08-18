import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSyncStatus } from "@/lib/api/endpoints/discord";
import { formatDhaka } from "@/lib/dhaka-date";

/** Human names for the channel roles the backend verifies. An unknown key is
 *  still rendered, so a channel added on the backend needs no change here. */
const CHANNEL_LABEL: Record<string, string> = {
  dailyUpdate: "#daily-update",
  attendance: "#attendance",
  reminder: "#daily-update-reminder",
};

const channelLabel = (key: string) => CHANNEL_LABEL[key] ?? key;

/** Each configured server's own health.
 *
 *  The channel verification is the reason this panel exists. Every server names
 *  its channels identically, so a channel ID pointing at the wrong guild looks
 *  correct in the configuration file *and* in Discord — the only symptom is one
 *  server quietly going silent. This is where that shows up. */
export async function ServerPanels() {
  const { servers } = await getSyncStatus();
  if (!servers || servers.length <= 1) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Servers</CardTitle>
        <CardDescription>
          One deployment serves every configured server. Members, channels and
          syncs are per server; the figures elsewhere on this dashboard count
          people, so someone in two servers is counted once there and twice here.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {servers.map((server) => {
          const channels = Object.entries(server.channels ?? {}).filter(
            (entry): entry is [string, NonNullable<(typeof entry)[1]>] =>
              entry[1] != null,
          );
          const unverified = channels.filter(([, check]) => !check.verified);

          return (
            <div
              key={server.guildId}
              className="flex flex-col gap-3 rounded-md border p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{server.label}</span>
                  {server.name ? (
                    <span className="text-muted-foreground text-sm">
                      {server.name}
                    </span>
                  ) : null}
                </div>
                <Badge variant={server.reachable ? "secondary" : "destructive"}>
                  {server.reachable ? (
                    <CheckCircle2 data-icon="inline-start" />
                  ) : (
                    <XCircle data-icon="inline-start" />
                  )}
                  {server.reachable ? "Reachable" : "Unreachable"}
                </Badge>
              </div>

              {!server.reachable && server.unreachableReason ? (
                <p className="text-destructive text-sm">
                  {server.unreachableReason}
                </p>
              ) : null}

              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-xs">Guild ID</dt>
                  <dd className="font-mono text-xs">{server.guildId}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-xs">Members</dt>
                  <dd className="font-mono tabular-nums">
                    {server.members
                      ? `${server.members.active.toLocaleString()} active of ${server.members.total.toLocaleString()}`
                      : "—"}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground text-xs">Last sync</dt>
                  <dd>
                    {server.lastSync?.running
                      ? "Running now"
                      : formatDhaka(server.lastSync?.finishedAt ?? null)}
                  </dd>
                </div>
              </dl>

              {channels.length > 0 ? (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {channels.map(([key, check]) => (
                    <li key={key} className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">
                        {channelLabel(key)}
                      </span>
                      <Badge
                        variant={check.verified ? "secondary" : "destructive"}
                        className="font-normal"
                      >
                        {check.verified ? "verified" : "wrong guild"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}

              {unverified.length > 0 ? (
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertTitle>
                    A configured channel does not belong to this server
                  </AlertTitle>
                  <AlertDescription className="flex flex-col gap-1.5">
                    <span>
                      Every server names its channels identically, so this is
                      invisible in configuration and in Discord. It is the first
                      thing to check when one server goes quiet.
                    </span>
                    {unverified.map(([key, check]) => (
                      <code
                        key={key}
                        className="bg-muted overflow-x-auto rounded p-1.5 font-mono text-xs"
                      >
                        {check.error ??
                          `${channelLabel(key)} (${check.id ?? "unset"}) belongs to another guild.`}
                      </code>
                    ))}
                  </AlertDescription>
                </Alert>
              ) : null}

              {server.lastSync?.lastError ? (
                <p className="text-destructive text-xs">
                  Last sync reported: {server.lastSync.lastError}
                </p>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
