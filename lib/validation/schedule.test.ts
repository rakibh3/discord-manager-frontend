import { describe, expect, test } from "bun:test";

import type { ChannelSchedulePayload } from "@/lib/api/types";
import { buildPatch, validateSchedulePatch } from "@/lib/validation/schedule";

/** The channel's open time is owned by the announcement — it opens the moment
 *  that message is posted — so the form can only move the lock time, and the
 *  backend *rejects* `openTime` rather than ignoring it. These tests pin the two
 *  consequences: the patch never carries the field, and the cross-field rule is
 *  judged against the stored open time rather than an editable one. */

const stored: ChannelSchedulePayload["schedule"] = {
  openTime: "19:00",
  openTimeSource: "ANNOUNCEMENT",
  closeTime: "23:59",
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  enabled: true,
  timezone: "Asia/Dhaka",
  updatedAt: "2026-08-17T09:00:00.000Z",
  updatedBy: { id: "u1", name: "Rakib", email: "rakib@example.com" },
};

const base = () => ({
  closeTime: stored.closeTime,
  daysOfWeek: stored.daysOfWeek,
  enabled: stored.enabled,
});

describe("buildPatch", () => {
  test("sends only what changed", () => {
    expect(buildPatch(stored, { ...base(), closeTime: "22:00" })).toEqual({
      closeTime: "22:00",
    });
  });

  /** `openTime` is a 400, not a silently stripped field: a patch carrying it
   *  would fail the whole save, including the parts that were legitimate. */
  test("never carries openTime or timezone", () => {
    const patch = buildPatch(stored, { ...base(), enabled: false });

    expect(patch).not.toHaveProperty("openTime");
    expect(patch).not.toHaveProperty("timezone");
  });

  test("an unchanged form produces an empty patch, which the backend rejects", () => {
    expect(buildPatch(stored, base())).toEqual({});
  });

  test("normalizes weekday order before comparing", () => {
    expect(buildPatch(stored, { ...base(), daysOfWeek: [6, 5, 4, 3, 2, 1, 0] })).toEqual(
      {},
    );
  });
});

describe("validateSchedulePatch", () => {
  test("accepts a lock time later than the stored open time", () => {
    const result = validateSchedulePatch(stored, {
      ...base(),
      closeTime: "22:00",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.patch).toEqual({ closeTime: "22:00" });
  });

  /** Lowering the lock past the announcement is refused here as it is on the
   *  backend, and the message has to say where the fix actually lives. */
  test("rejects a lock time at or before the stored open time", () => {
    const result = validateSchedulePatch(stored, {
      ...base(),
      closeTime: "18:00",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Named the way the admin reads it elsewhere on the form, not as raw
      // `19:00` — one boundary written two ways invites a second guess.
      expect(result.message).toContain("7:00 PM");
      expect(result.message).toContain("announcement");
    }
  });

  test("rejects a malformed lock time", () => {
    expect(
      validateSchedulePatch(stored, { ...base(), closeTime: "25:00" }).ok,
    ).toBe(false);
  });

  test("rejects a schedule with no active days", () => {
    const result = validateSchedulePatch(stored, { ...base(), daysOfWeek: [] });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("at least one weekday");
  });

  test("rejects a no-op save", () => {
    const result = validateSchedulePatch(stored, base());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Nothing has changed");
  });

  /** Turning the schedule off leaves the open time untouched and must not be
   *  blocked by the cross-field rule. */
  test("allows disabling without touching the times", () => {
    const result = validateSchedulePatch(stored, { ...base(), enabled: false });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.patch).toEqual({ enabled: false });
  });
});
