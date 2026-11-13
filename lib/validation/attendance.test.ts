import { describe, expect, test } from "bun:test";

import {
  attendanceSchema,
  DISCORD_USERNAME_REGEX,
  normalizeDiscordUsername,
} from "@/lib/validation/attendance";

/** The highest-stakes validation in the app: tightening the rule by one
 *  character class silently locks 5.3% of real members out of attendance. */
describe("Discord username rule", () => {
  test.each([
    // Leading and trailing separators are VALID. 115 of 2,189 live members
    // have one, and 59 of those accounts post-date the Pomelo rollout.
    [".rabbil", "leading dot"],
    ["itzazad_", "trailing underscore"],
    ["shahriarratul.", "trailing dot"],
    ["rakib_dev", "ordinary handle"],
    ["ab", "minimum length of 2"],
    ["a".repeat(32), "maximum length of 32"],
    ["a.b_c.d", "mixed separators"],
    ["user123", "digits"],
  ])("accepts %s (%s)", (handle) => {
    expect(DISCORD_USERNAME_REGEX.test(handle)).toBe(true);
  });

  test.each([
    ["a..b", "consecutive dots"],
    ["A_B", "uppercase — Discord stores handles lowercased"],
    ["a", "one character, below the 2-character minimum"],
    ["a".repeat(33), "33 characters, above the 32-character maximum"],
    ["has space", "space"],
    ["rakib#0001", "legacy discriminator tag"],
    ["", "empty"],
    ["user@name", "at sign inside the handle"],
  ])("rejects %s (%s)", (handle) => {
    expect(DISCORD_USERNAME_REGEX.test(handle)).toBe(false);
  });
});

describe("normalizeDiscordUsername", () => {
  test("strips surrounding whitespace, a leading @, and lowercases", () => {
    expect(normalizeDiscordUsername("  @Rakib_Dev  ")).toBe("rakib_dev");
  });

  test("strips repeated leading @ signs", () => {
    expect(normalizeDiscordUsername("@@rakib")).toBe("rakib");
  });

  test("leaves an interior @ alone so the handle still fails validation", () => {
    const normalized = normalizeDiscordUsername("user@name");
    expect(normalized).toBe("user@name");
    expect(DISCORD_USERNAME_REGEX.test(normalized)).toBe(false);
  });

  test("preserves a leading dot rather than treating it as noise", () => {
    expect(normalizeDiscordUsername("@.Rabbil")).toBe(".rabbil");
  });
});

describe("attendance schema", () => {
  // The submit body carries ONLY `email` and `discordUsername`. `name` and
  // `phone` are not collected — they are sourced server-side from the
  // matched active roster entry. Whether the two belong together is not a
  // schema rule: the form gates on the pre-submit `/verify-pair` check.
  test("accepts a valid email + handle pair", () => {
    const result = attendanceSchema.safeParse({
      email: "rakib@example.com",
      discordUsername: "rakib_dev",
    });
    expect(result.success).toBe(true);
    expect(result.data?.discordUsername).toBe("rakib_dev");
  });

  test("normalizes the handle it submits", () => {
    const result = attendanceSchema.safeParse({
      email: "rakib@example.com",
      discordUsername: "@Rakib_Dev",
    });
    expect(result.success).toBe(true);
    // The submitted handle is the normalized form, not what was typed.
    expect(result.data?.discordUsername).toBe("rakib_dev");
  });

  test("rejects a malformed email", () => {
    const result = attendanceSchema.safeParse({
      email: "not-an-email",
      discordUsername: "rakib_dev",
    });
    expect(result.success).toBe(false);
  });

  test("rejects a malformed handle", () => {
    const result = attendanceSchema.safeParse({
      email: "rakib@example.com",
      discordUsername: "a..b",
    });
    expect(result.success).toBe(false);
  });

  test("reports each failure against its own field", () => {
    const result = attendanceSchema.safeParse({
      email: "not-an-email",
      discordUsername: "a..b",
    });

    expect(result.success).toBe(false);
    const fields = new Set(result.error?.issues.map((issue) => issue.path[0]));
    expect(fields).toEqual(new Set(["email", "discordUsername"]));
  });

  test("drops an unknown key instead of submitting it", () => {
    // A form cached from before `cannotEnterRealDiscordUsername` was removed
    // must not ship the key:
    // the backend's `.strict()` submit schema refuses extra keys with a 400.
    // The schema strips it here, so the parsed body is always exactly the
    // two fields the endpoint accepts.
    const result = attendanceSchema.safeParse({
      email: "rakib@example.com",
      discordUsername: "rakib_dev",
      cannotEnterRealDiscordUsername: true,
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      email: "rakib@example.com",
      discordUsername: "rakib_dev",
    });
  });
});