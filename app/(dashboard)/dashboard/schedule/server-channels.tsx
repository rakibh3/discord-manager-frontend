"use client";

import { Lock, Unlock } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { lockChannelNow, openChannelNow } from "@/actions/schedule";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { ChannelSchedulePayload } from "@/lib/api/types";
import { formatDhaka } from "@/lib/dhaka-date";

/** Each configured server's own `#daily-update` state, and a control to act on
 *  just that one.
 *
 *  This exists because the combined state hides the case that actually happens:
 *  the channel opened everywhere except one server, where the bot is missing a
 *  permission. Without a per-server row and a per-server button, the only way to
 *  fix that server is to re-run the action for all of them. */
export function ServerChannels({
  payload,
  onRefreshed,
}: {
  payload: ChannelSchedulePayload;
  onRefreshed: (next: ChannelSchedulePayload) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [busyGuildId, setBusyGuildId] = useState<string | null>(null);

  const servers = payload.servers;
  if (servers.length <= 1) return null;

  const run = (guildId: string, action: "open" | "lock") => {
    setBusyGuildId(guildId);
    startTransition(async () => {
      const result =
        action === "open"
          ? await openChannelNow([guildId])
          : await lockChannelNow([guildId]);

      if (result.ok && !result.partial) toast.success(result.message);
      else if (result.ok) toast.warning(result.message);
      else {
        toast.error(result.message);
        if (result.refreshed) onRefreshed(result.refreshed);
      }
      setBusyGuildId(null);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Servers</CardTitle>
        <CardDescription>
          One shared schedule drives every server, but each channel is opened and
          locked separately — so they can disagree, and this is where that shows.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {servers.map((server) => {
          const busy = pending && busyGuildId === server.guildId;
          // ⚠️ `null` means the channel's state could not be read at all. It is
          // reported as unknown rather than folded into "Locked", which would
          // invite an admin to "fix" a channel that may already be open.
          const unknown = server.isOpen === null;

          return (
            <div
              key={server.guildId}
              className="flex flex-col gap-2 rounded-md border p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{server.label}</span>
                  <Badge
                    variant={
                      unknown
                        ? "warning"
                        : server.isOpen
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {unknown ? "Unknown" : server.isOpen ? "Open" : "Locked"}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || server.isOpen === true}
                    onClick={() => run(server.guildId, "open")}
                  >
                    {busy ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <Unlock data-icon="inline-start" />
                    )}
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || server.isOpen === false}
                    onClick={() => run(server.guildId, "lock")}
                  >
                    {busy ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <Lock data-icon="inline-start" />
                    )}
                    Lock
                  </Button>
                </div>
              </div>

              <dl className="text-muted-foreground grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt>Channel</dt>
                  <dd className="font-mono">{server.channelId ?? "—"}</dd>
                </div>
                {server.lastRun ? (
                  <div className="flex gap-2">
                    <dt>Last run</dt>
                    <dd>
                      {server.lastRun.action} · {formatDhaka(server.lastRun.ranAt)}{" "}
                      · {server.lastRun.ok ? "ok" : "failed"}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {unknown ? (
                <p className="text-warning text-xs">
                  The channel&rsquo;s permissions could not be read. Check that
                  the bot can still see this server, and that the configured
                  channel belongs to it — the Discord page verifies both.
                </p>
              ) : null}

              {server.lastRun?.error ? (
                <code className="bg-muted text-muted-foreground overflow-x-auto rounded p-1.5 font-mono text-xs">
                  {server.lastRun.error}
                </code>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
