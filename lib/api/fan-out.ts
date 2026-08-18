import type { FanOutFields, FanOutServer, FanOutSummary } from "@/lib/api/types";

/** Actions that reach Discord — opening the channel, locking it, posting the
 *  attendance announcement — apply to **every** configured server.
 *
 *  ⚠️ The trap this module exists for: **partial success is HTTP 200**. A
 *  request that opened the channel in one server and hit `Missing Permissions`
 *  in another still answers `success: true`, with the failure buried in
 *  `data.summary.failed`. Nothing may report such a response as a plain success.
 *  (`API_INTEGRATION.md` §5A.) */

export type NormalizedFanOut<T> = {
  summary: FanOutSummary;
  servers: FanOutServer<T>[];
  /** True when at least one server failed — including a total failure. */
  partial: boolean;
  /** True when nothing succeeded. */
  total: boolean;
};

/** Normalizes either payload shape into one: the multi-server `summary` +
 *  `servers[]`, or the flat single-server answer a pre-fan-out deployment
 *  returns, which is treated as one server that succeeded. */
export function normalizeFanOut<T>(
  payload: FanOutFields<T>,
  fallback: { label: string; value?: T; channelId?: string | null } = {
    label: "the server",
  },
): NormalizedFanOut<T> {
  const servers =
    payload.servers && payload.servers.length > 0
      ? payload.servers
      : [
          {
            guildId: "",
            label: fallback.label,
            ok: true,
            value: fallback.value,
            channelId: fallback.channelId ?? null,
          } satisfies FanOutServer<T>,
        ];

  const succeeded = servers.filter((server) => server.ok).length;

  const summary: FanOutSummary = payload.summary ?? {
    total: servers.length,
    succeeded,
    failed: servers.length - succeeded,
  };

  return {
    summary,
    servers,
    partial: summary.failed > 0,
    total: summary.failed > 0 && summary.succeeded === 0,
  };
}

/** One sentence naming what actually happened, for a toast that must not read
 *  as "done" when a server was left behind. */
export function fanOutMessage(
  result: NormalizedFanOut<unknown>,
  verb: string,
): string {
  const { total, succeeded, failed } = result.summary;

  if (total <= 1) {
    return failed === 0
      ? `${verb}.`
      : `${verb} failed: ${result.servers[0]?.error ?? "the server rejected it"}.`;
  }
  if (failed === 0) return `${verb} in all ${total} servers.`;
  if (succeeded === 0) return `${verb} failed in all ${total} servers.`;
  return `${verb} in ${succeeded} of ${total} servers — ${failed} failed.`;
}

/** Every server that reported a failure, ready to list next to the message. */
export function failedServers<T>(
  result: NormalizedFanOut<T>,
): FanOutServer<T>[] {
  return result.servers.filter((server) => !server.ok);
}
