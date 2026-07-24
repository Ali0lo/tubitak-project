import { describe, expect, it } from "vitest";
import { RecurrenceRule } from "@/types";

describe("Task Recurrence Types", () => {
  it("validates recurrence rule object", () => {
    const rule: RecurrenceRule = {
      frequency: "weekly",
      interval: 1,
      unit: "weeks",
    };
    expect(rule.frequency).toBe("weekly");
    expect(rule.interval).toBe(1);
  });
});
