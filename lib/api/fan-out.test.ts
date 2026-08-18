import { describe, expect, test } from "bun:test";

import {
  failedServers,
  fanOutMessage,
  normalizeFanOut,
} from "@/lib/api/fan-out";

describe("normalizeFanOut", () => {
  test("treats a flat single-server payload as one server that succeeded", () => {
    const result = normalizeFanOut(
      {},
      { label: "the server", value: { announced: true } },
    );

    expect(result.summary).toEqual({ total: 1, succeeded: 1, failed: 0 });
    expect(result.partial).toBe(false);
    expect(result.servers[0].value).toEqual({ announced: true });
  });

  // The whole reason this module exists: the request answered 200, and the
  // failure is only visible inside the payload.
  test("a partial success is not a success", () => {
    const result = normalizeFanOut<{ announced: boolean }>(
      {
        summary: { total: 2, succeeded: 1, failed: 1 },
        servers: [
          { guildId: "1", label: "Batch A", ok: true, value: { announced: true } },
          {
            guildId: "2",
            label: "Batch B",
            ok: false,
            error: "Missing Permissions",
          },
        ],
      },
      { label: "the server" },
    );

    expect(result.partial).toBe(true);
    expect(result.total).toBe(false);
    expect(failedServers(result).map((server) => server.label)).toEqual([
      "Batch B",
    ]);
  });

  test("derives a summary when the payload omits one", () => {
    const result = normalizeFanOut(
      {
        servers: [
          { guildId: "1", label: "A", ok: false, error: "boom" },
          { guildId: "2", label: "B", ok: false, error: "boom" },
        ],
      },
      { label: "the server" },
    );

    expect(result.summary).toEqual({ total: 2, succeeded: 0, failed: 2 });
    expect(result.total).toBe(true);
  });
});

describe("fanOutMessage", () => {
  test("names how many servers were reached on a partial run", () => {
    const result = normalizeFanOut(
      {
        summary: { total: 3, succeeded: 2, failed: 1 },
        servers: [],
      },
      { label: "the server" },
    );

    expect(fanOutMessage(result, "Channel opened")).toBe(
      "Channel opened in 2 of 3 servers — 1 failed.",
    );
  });

  test("stays plain for a single server", () => {
    const result = normalizeFanOut({}, { label: "the server" });
    expect(fanOutMessage(result, "Channel opened")).toBe("Channel opened.");
  });
});
