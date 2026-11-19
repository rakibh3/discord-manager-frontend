import { describe, expect, test } from "bun:test";

import { buildDailyUpdateTemplate } from "./daily-update-template-card";

describe("buildDailyUpdateTemplate", () => {
  test("produces the four program-mandated daily-update lines with the Dhaka date", () => {
    expect(buildDailyUpdateTemplate("2026-11-20")).toBe(
      [
        "Date: 2026-11-20",
        "Learning Hour: ",
        "What I Learned Today: ",
        "My Target for Tomorrow: ",
      ].join("\n"),
    );
  });
});
