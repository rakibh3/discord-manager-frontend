import { describe, expect, test } from "bun:test";
import { rosterEntryEditSchema, rosterSettingsSchema } from "./roster";

describe("roster validation", () => {
  test("rosterEntryEditSchema accepts valid name and email", () => {
    const res = rosterEntryEditSchema.safeParse({
      name: "Rakibul Hasan",
      email: "rakib@example.com",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.name).toBe("Rakibul Hasan");
      expect(res.data.email).toBe("rakib@example.com");
    }
  });

  test("rosterEntryEditSchema accepts phone or empty string / null for clearing", () => {
    const res1 = rosterEntryEditSchema.safeParse({
      phone: "01711000000",
    });
    expect(res1.success).toBe(true);
    if (res1.success) {
      expect(res1.data.phone).toBe("01711000000");
    }

    const res2 = rosterEntryEditSchema.safeParse({
      phone: "",
    });
    expect(res2.success).toBe(true);
    if (res2.success) {
      expect(res2.data.phone).toBeNull();
    }

    const res3 = rosterEntryEditSchema.safeParse({
      phone: null,
    });
    expect(res3.success).toBe(true);
    if (res3.success) {
      expect(res3.data.phone).toBeNull();
    }
  });

  test("rosterEntryEditSchema rejects empty object (at least one field required)", () => {
    const res = rosterEntryEditSchema.safeParse({});
    expect(res.success).toBe(false);
  });

  test("rosterEntryEditSchema accepts a Discord username and normalizes it", () => {
    const res = rosterEntryEditSchema.safeParse({ discordUsername: " @Rakib_Dev " });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.discordUsername).toBe("rakib_dev");
    }
  });

  test("rosterEntryEditSchema turns an empty or null Discord username into a clear", () => {
    for (const value of ["", "   ", null]) {
      const res = rosterEntryEditSchema.safeParse({ discordUsername: value });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.discordUsername).toBeNull();
      }
    }
  });

  test("rosterEntryEditSchema rejects a malformed Discord username", () => {
    for (const value of ["a", "has space", "two..dots", "Display Name#1234"]) {
      const res = rosterEntryEditSchema.safeParse({ discordUsername: value });
      expect(res.success).toBe(false);
    }
  });

  test("rosterEntryEditSchema rejects invalid email", () => {
    const res = rosterEntryEditSchema.safeParse({
      email: "not-an-email",
    });
    expect(res.success).toBe(false);
  });

  test("rosterSettingsSchema accepts boolean enforceEmail", () => {
    const res = rosterSettingsSchema.safeParse({ enforceEmail: true });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.enforceEmail).toBe(true);
    }
  });
});
