import { describe, expect, test } from "bun:test";

import {
  normalizeBdPhone,
  registrationSchema,
  validateInviteUrl,
  validateRegistrationWindow,
} from "./registration";

const VALID = {
  name: "Rakibul Hasan",
  email: "rakib@example.com",
  phone: "01712345678",
  discordUsername: "rakib_dev",
};

describe("normalizeBdPhone", () => {
  test("folds every accepted spelling into the local form", () => {
    expect(normalizeBdPhone("01712345678")).toBe("01712345678");
    expect(normalizeBdPhone("+8801712345678")).toBe("01712345678");
    expect(normalizeBdPhone("8801712345678")).toBe("01712345678");
    expect(normalizeBdPhone("+880 1712-345678")).toBe("01712345678");
    expect(normalizeBdPhone("(017) 1234 5678")).toBe("01712345678");
  });
});

describe("registrationSchema", () => {
  test("accepts a valid registration", () => {
    expect(registrationSchema.safeParse(VALID).success).toBe(true);
  });

  test("normalizes email, phone and Discord username", () => {
    const res = registrationSchema.safeParse({
      name: "  Rakibul Hasan  ",
      email: " Rakib@Example.COM ",
      phone: "+880 1712-345678",
      discordUsername: " @Rakib_Dev ",
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toEqual({
        name: "Rakibul Hasan",
        email: "rakib@example.com",
        phone: "01712345678",
        discordUsername: "rakib_dev",
      });
    }
  });

  test("rejects a name that is too short", () => {
    expect(registrationSchema.safeParse({ ...VALID, name: " a " }).success).toBe(
      false,
    );
  });

  test("rejects a malformed email", () => {
    expect(
      registrationSchema.safeParse({ ...VALID, email: "not-an-email" }).success,
    ).toBe(false);
  });

  test("rejects phone numbers that are not Bangladeshi mobiles", () => {
    for (const phone of ["12345", "01212345678", "0171234567", "017123456789"]) {
      expect(registrationSchema.safeParse({ ...VALID, phone }).success).toBe(
        false,
      );
    }
  });

  test("keeps the permissive Discord username rule", () => {
    // Leading/trailing separators are valid handles — do not tighten.
    for (const discordUsername of ["itzazad_", ".rabbil", "shahriarratul."]) {
      expect(
        registrationSchema.safeParse({ ...VALID, discordUsername }).success,
      ).toBe(true);
    }
    for (const discordUsername of ["a", "two..dots", "has space"]) {
      expect(
        registrationSchema.safeParse({ ...VALID, discordUsername }).success,
      ).toBe(false);
    }
  });
});

describe("validateRegistrationWindow", () => {
  const NONE = {
    openDate: null,
    openTime: null,
    closeDate: null,
    closeTime: null,
  };

  test("accepts no window, an opening only, a closing only, and both", () => {
    expect(validateRegistrationWindow(NONE)).toBeNull();
    expect(
      validateRegistrationWindow({
        ...NONE,
        openDate: "2026-12-01",
        openTime: "09:00",
      }),
    ).toBeNull();
    expect(
      validateRegistrationWindow({
        ...NONE,
        closeDate: "2026-12-10",
        closeTime: "23:59",
      }),
    ).toBeNull();
    expect(
      validateRegistrationWindow({
        openDate: "2026-12-01",
        openTime: "09:00",
        closeDate: "2026-12-10",
        closeTime: "23:59",
      }),
    ).toBeNull();
  });

  test("rejects a date without its time, and a time without its date", () => {
    expect(
      validateRegistrationWindow({ ...NONE, openDate: "2026-12-01" }),
    ).toMatch(/opening/);
    expect(
      validateRegistrationWindow({ ...NONE, closeTime: "23:59" }),
    ).toMatch(/closing/);
  });

  test("rejects a closing at or before the opening", () => {
    expect(
      validateRegistrationWindow({
        openDate: "2026-12-01",
        openTime: "09:00",
        closeDate: "2026-12-01",
        closeTime: "09:00",
      }),
    ).toMatch(/after it opens/);
    expect(
      validateRegistrationWindow({
        openDate: "2026-12-01",
        openTime: "09:00",
        closeDate: "2026-11-30",
        closeTime: "23:59",
      }),
    ).toMatch(/after it opens/);
  });

  test("compares the time when the dates are equal", () => {
    expect(
      validateRegistrationWindow({
        openDate: "2026-12-01",
        openTime: "09:00",
        closeDate: "2026-12-01",
        closeTime: "09:01",
      }),
    ).toBeNull();
  });
});

describe("validateInviteUrl", () => {
  test("accepts an empty value and an https link", () => {
    expect(validateInviteUrl("")).toBeNull();
    expect(validateInviteUrl("   ")).toBeNull();
    expect(validateInviteUrl("https://discord.gg/abc123")).toBeNull();
  });

  test("rejects anything that is not a full https address", () => {
    for (const value of [
      "http://discord.gg/abc123",
      "discord.gg/abc123",
      "javascript:alert(1)",
    ]) {
      expect(validateInviteUrl(value)).not.toBeNull();
    }
  });
});
