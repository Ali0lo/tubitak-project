import { describe, expect, it, beforeEach } from "vitest";
import {
  DEMO_TASKS,
  DEMO_MEETINGS,
  DEMO_NOTIFICATIONS,
  seedDemoData,
  clearDemoData,
  isDemoModeActive,
} from "@/lib/demo-data";

describe("Demo Mode Data & Utilities", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("verifies sample demo datasets structure", () => {
    expect(DEMO_TASKS).toHaveLength(4);
    expect(DEMO_MEETINGS).toHaveLength(2);
    expect(DEMO_NOTIFICATIONS).toHaveLength(2);

    expect(DEMO_TASKS[0]!.title).toContain("Launch Todotak");
    expect(DEMO_MEETINGS[0]!.meeting_link).toBeDefined();
  });

  it("seeds and clears demo mode in localStorage", () => {
    expect(isDemoModeActive()).toBe(false);

    seedDemoData();
    expect(isDemoModeActive()).toBe(true);
    expect(localStorage.getItem("todotak_demo_tasks")).toBeDefined();

    clearDemoData();
    expect(isDemoModeActive()).toBe(false);
    expect(localStorage.getItem("todotak_demo_tasks")).toBeNull();
  });
});
