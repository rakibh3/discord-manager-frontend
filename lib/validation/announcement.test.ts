import { describe, expect, test } from "bun:test";

import type { AnnouncementPayload } from "@/lib/api/types";
import {
  buildAnnouncementPatch,
  formValuesFrom,
  normalizeHandle,
  splitEntries,
  unknownPlaceholders,
  validateAnnouncement,
  type AnnouncementFormValues,
} from "@/lib/validation/announcement";

/**
 * These mirror backend rules that are cheap to check in the browser and
 * expensive to discover after a round trip — plus one rule that is deliberately
 * *not* mirrored (the 2,000-character limit), because only the server can
 * measure the rendered message.
 */

const payload: AnnouncementPayload = {
  template: {
    body: "Date: {{date}} — submit before {{close_time}}.",
    terminationDays: 3,
    mentionEveryone: false,
    mentionRoleIds: [],
    mentionUsernames: [],
    updatedAt: "2026-08-17T09:00:00.000Z",
    updatedBy: { id: "u1", name: "Rakib", email: "rakib@example.com" },
  },
  schedule: {
    announceTime: "19:00",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    enabled: true,
    timezone: "Asia/Dhaka",
  },
  preview: {
    content: "Date: 2026-08-18 — submit before 23:59.",
    length: 38,
    limit: 2000,
    closeTime: "23:59",
    mentions: { roleIds: [], userIds: [], unresolved: [] },
  },
  supportedPlaceholders: [
    "{{date}}",
    "{{close_time}}",
    "{{daily_update_channel_id}}",
    "{{attendance_form_link}}",
    "{{termination_day}}",
  ],
  scheduler: {
    processEnabled: true,
    running: true,
    nextRunAt: "2026-08-18T13:00:00.000Z",
    lastOutcome: null,
  },
  channel: { id: "1467526520347037729" },
  today: { date: "2026-08-18", posted: false, attempts: [] },
};

const base = (): AnnouncementFormValues => formValuesFrom(payload);

const withChanges = (
  changes: Partial<AnnouncementFormValues>,
): AnnouncementFormValues => ({ ...base(), ...changes });

describe("formValuesFrom", () => {
  /**
   * The single most damaging mistake this screen can make: binding the editor
   * to `preview.content` would save today's date as literal text into the
   * stored template, and every future post would name the wrong day.
   */
  test("binds to the raw template body, never to the rendered preview", () => {
    const values = formValuesFrom(payload);

    expect(values.body).toBe(payload.template.body);
    expect(values.body).toContain("{{date}}");
    expect(values.body).not.toBe(payload.preview.content);
  });
});

describe("normalizeHandle", () => {
  test("strips a leading @, trims, and lowercases", () => {
    expect(normalizeHandle(" @Rakib_Dev ")).toBe("rakib_dev");
  });

  test("leaves a leading or trailing _ or . alone", () => {
    // 5.3% of real members hold such handles; tightening this locked them out.
    expect(normalizeHandle("itzazad_")).toBe("itzazad_");
    expect(normalizeHandle(".rabbil")).toBe(".rabbil");
  });
});

describe("splitEntries", () => {
  test("accepts newlines, commas and spaces as separators", () => {
    expect(splitEntries("a\nb, c  d")).toEqual(["a", "b", "c", "d"]);
  });

  test("is empty for whitespace only", () => {
    expect(splitEntries("  \n ")).toEqual([]);
  });
});

describe("unknownPlaceholders", () => {
  test("reports a token the backend does not support", () => {
    expect(
      unknownPlaceholders(
        "Form: {{attendance_link}}",
        payload.supportedPlaceholders,
      ),
    ).toEqual(["{{attendance_link}}"]);
  });

  test("accepts every supported token", () => {
    expect(
      unknownPlaceholders(
        payload.supportedPlaceholders.join(" "),
        payload.supportedPlaceholders,
      ),
    ).toEqual([]);
  });

  test("treats {{ date }} as {{date}} rather than as unknown", () => {
    expect(
      unknownPlaceholders("{{ date }}", payload.supportedPlaceholders),
    ).toEqual([]);
  });
});

describe("buildAnnouncementPatch", () => {
  test("sends only what changed", () => {
    const patch = buildAnnouncementPatch(
      payload,
      withChanges({ announceTime: "20:00" }),
    );

    expect(patch).toEqual({ announceTime: "20:00" });
  });

  test("never sends timezone", () => {
    const patch = buildAnnouncementPatch(payload, withChanges({ body: "x" }));

    expect(patch).not.toHaveProperty("timezone");
  });

  test("normalizes and dedupes mention usernames", () => {
    const patch = buildAnnouncementPatch(
      payload,
      withChanges({ mentionUsernamesRaw: "@Rakib_Dev, rakib_dev\nOther_One" }),
    );

    expect(patch.mentionUsernames).toEqual(["rakib_dev", "other_one"]);
  });

  test("an unchanged form produces an empty patch, which the backend rejects", () => {
    expect(buildAnnouncementPatch(payload, base())).toEqual({});
  });

  test("clearing a populated allowlist sends [] rather than omitting the field", () => {
    const populated: AnnouncementPayload = {
      ...payload,
      template: { ...payload.template, mentionRoleIds: ["1234567890123456789"] },
    };

    const patch = buildAnnouncementPatch(
      populated,
      { ...formValuesFrom(populated), mentionRoleIdsRaw: "" },
    );

    // Omitting the field would leave the roles pinged forever — `[]` is the
    // "notify nobody" state and has to travel explicitly.
    expect(patch.mentionRoleIds).toEqual([]);
  });
});

describe("validateAnnouncement", () => {
  test("accepts a real change", () => {
    const result = validateAnnouncement(
      payload,
      withChanges({ terminationDays: 5 }),
    );

    expect(result.ok).toBe(true);
  });

  test("rejects an unknown placeholder and names it", () => {
    const result = validateAnnouncement(
      payload,
      withChanges({ body: "Form: {{attendance_link}}" }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("{{attendance_link}}");
      expect(result.message).toContain("{{close_time}}");
    }
  });

  test("rejects an empty weekday list, pointing at the off switch instead", () => {
    const result = validateAnnouncement(payload, withChanges({ daysOfWeek: [] }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("turn it off");
  });

  test("rejects a role ID that is not a snowflake", () => {
    const result = validateAnnouncement(
      payload,
      withChanges({ mentionRoleIdsRaw: "12345" }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("17–20 digit");
  });

  test("accepts a 19-digit role ID", () => {
    const result = validateAnnouncement(
      payload,
      withChanges({ mentionRoleIdsRaw: "1234567890123456789" }),
    );

    expect(result.ok).toBe(true);
  });

  test("rejects a handle with consecutive periods", () => {
    const result = validateAnnouncement(
      payload,
      withChanges({ mentionUsernamesRaw: "rakib..dev" }),
    );

    expect(result.ok).toBe(false);
  });

  test("accepts a handle with a trailing underscore", () => {
    const result = validateAnnouncement(
      payload,
      withChanges({ mentionUsernamesRaw: "itzazad_" }),
    );

    expect(result.ok).toBe(true);
  });

  test("rejects termination days outside 1–365", () => {
    expect(
      validateAnnouncement(payload, withChanges({ terminationDays: 0 })).ok,
    ).toBe(false);
    expect(
      validateAnnouncement(payload, withChanges({ terminationDays: 366 })).ok,
    ).toBe(false);
  });

  test("rejects a no-op save", () => {
    const result = validateAnnouncement(payload, base());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Nothing has changed");
  });

  /**
   * The limit applies to the *rendered* message plus the mention line, which
   * the browser cannot compute. Checking `body.length` here would disagree with
   * the backend in both directions — passing bodies it rejects, and blocking
   * bodies it would accept.
   */
  test("does not enforce the 2,000-character limit on the raw body", () => {
    const result = validateAnnouncement(
      payload,
      withChanges({ body: "x".repeat(2500) }),
    );

    expect(result.ok).toBe(true);
  });
});
