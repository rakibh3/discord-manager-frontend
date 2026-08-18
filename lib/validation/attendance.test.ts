import { describe, expect, test } from "bun:test";

import {
  attendanceSchema,
  DISCORD_USERNAME_REGEX,
  normalizeDiscordUsername,
  PHONE_REGEX,
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

describe("phone rule", () => {
  test.each(["01711000000", "+8801711000000", "8801711000000", "01911000000"])(
    "accepts %s",
    (phone) => {
      expect(PHONE_REGEX.test(phone)).toBe(true);
    },
  );

  test.each([
    "0171100000", // one digit short
    "017110000000", // one digit long
    "01211000000", // operator prefix 2 is not in 3-9
    "1711000000", // missing the leading 0
    "+8811711000000", // wrong country code
  ])("rejects %s", (phone) => {
    expect(PHONE_REGEX.test(phone)).toBe(false);
  });
});

describe("attendance schema", () => {
  // Names are English-only by product decision, so Bengali is rejected
  // deliberately rather than by the mark-vs-letter accident `[\p{L}\s]` makes.
  test.each([
    "রাকিবুল হাসান",
    "মোঃ আবির",
    "শাহরিয়ার রাতুল",
  ])("rejects the Bengali name %s", (name) => {
    const result = attendanceSchema.safeParse({
      name,
      phone: "01711000000",
      email: "student@example.com",
      discordUsername: "rakib_dev",
    });
    expect(result.success).toBe(false);
  });

  test.each(["Rakibul Hasan", "Md Abir", "Shahriar Ratul", "Ali"])(
    "accepts the English name %s",
    (name) => {
      const result = attendanceSchema.safeParse({
        name,
        phone: "01711000000",
        email: "student@example.com",
        discordUsername: "rakib_dev",
      });
      expect(result.success).toBe(true);
    },
  );

  test("the rejection message names the script, not just 'letters'", () => {
    // A student who wrote their own name in their own script needs to be told
    // which alphabet to use — "only letters" would read as nonsense to them.
    const result = attendanceSchema.safeParse({
      name: "রাকিবুল হাসান",
      phone: "01711000000",
      email: "student@example.com",
      discordUsername: "rakib_dev",
    });
    const message = result.error?.issues.find(
      (issue) => issue.path[0] === "name",
    )?.message;
    expect(message).toContain("English");
  });

  test("normalizes the handle it submits", () => {
    const result = attendanceSchema.safeParse({
      name: "Md Rakibul Hasan",
      phone: "01711000000",
      email: "rakib@example.com",
      discordUsername: "@Rakib_Dev",
    });

    expect(result.success).toBe(true);
    // The submitted handle is the normalized form, not what was typed.
    expect(result.data?.discordUsername).toBe("rakib_dev");
  });

  test("rejects a name containing digits", () => {
    const result = attendanceSchema.safeParse({
      name: "Rakib 2",
      phone: "01711000000",
      email: "rakib@example.com",
      discordUsername: "rakib_dev",
    });
    expect(result.success).toBe(false);
  });

  test("reports each failure against its own field", () => {
    const result = attendanceSchema.safeParse({
      name: "ab",
      phone: "123",
      email: "not-an-email",
      discordUsername: "a..b",
    });

    expect(result.success).toBe(false);
    const fields = new Set(result.error?.issues.map((issue) => issue.path[0]));
    expect(fields).toEqual(
      new Set(["name", "phone", "email", "discordUsername"]),
    );
  });
});
