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

/** Mirrors of the backend rules that are cheap to check in the browser — plus
 *  the 2,000-character limit, which is deliberately not mirrored. */

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
    // Keyed per guild: one server's success must not overwrite another's
    // missing-permission failure.
    lastOutcomeByGuild: {},
  },
  // Channels and attempts are per server — there is no combined form.
  today: {
    date: "2026-08-18",
    posted: false,
    servers: [
      {
        guildId: "1467526520347037729",
        label: "Batch A",
        channelId: "1467526520347037729",
        posted: false,
        attempts: [],
        lastOutcome: null,
      },
    ],
  },
};

const base = (): AnnouncementFormValues => formValuesFrom(payload);

const withChanges = (
  changes: Partial<AnnouncementFormValues>,
): AnnouncementFormValues => ({ ...base(), ...changes });

describe("formValuesFrom", () => {
  /** Binding the editor to `preview.content` would save today's date as literal
   *  text into the stored template, so every future post names the wrong day. */
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

  /** The post time is also the channel's open time, so an announcement at or
   *  after the lock would open a window that is already over. The backend
   *  answers 400; checking here names the fix instead. */
  test("rejects an announce time at or after the channel's lock time", () => {
    const result = validateAnnouncement(
      payload,
      withChanges({ announceTime: "23:59" }),
      "23:59",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("no window to submit in");
  });

  test("allows an announce time earlier than the lock time", () => {
    const result = validateAnnouncement(
      payload,
      withChanges({ announceTime: "20:00" }),
      "23:59",
    );

    expect(result.ok).toBe(true);
  });

  /** The window read fails open to `null`. Blocking the save then would ground
   *  the editor on an unrelated outage; the backend still enforces the rule. */
  test("skips the lock-time check when the channel window could not be read", () => {
    const result = validateAnnouncement(
      payload,
      withChanges({ announceTime: "23:59" }),
      null,
    );

    expect(result.ok).toBe(true);
  });

  /** An already-stored time that now conflicts must not block an unrelated edit
   *  — the admin would be stuck unable to save anything at all. */
  test("does not block other edits when the stored announce time already conflicts", () => {
    const result = validateAnnouncement(
      payload,
      withChanges({ body: "New text" }),
      "18:00",
    );

    expect(result.ok).toBe(true);
  });

  /** The limit applies to the rendered message plus the mention line, which the
   *  browser cannot compute — a `body.length` check would disagree both ways. */
  test("does not enforce the 2,000-character limit on the raw body", () => {
    const result = validateAnnouncement(
      payload,
      withChanges({ body: "x".repeat(2500) }),
    );

    expect(result.ok).toBe(true);
  });
});
