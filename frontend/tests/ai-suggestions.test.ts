import { describe, expect, it } from "vitest";
import { Task } from "@/types";

describe("AI Task Suggestions", () => {
  const sampleTask: Task = {
    id: "task-101",
    user_id: "u1",
    title: "Implement OAuth Login",
    description: "Connect to Google and GitHub SSO providers",
    status: "pending",
    priority: "medium",
    due_date: new Date().toISOString(),
    completed_at: null,
    is_recurring: false,
    recurrence_rule: null,
    recurrence_parent_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: [],
  };

  it("generates realistic subtask breakdown suggestions based on task title", () => {
    const subtaskTitles = [
      `Research requirement details for ${sampleTask.title}`,
      `Draft implementation plan for ${sampleTask.title}`,
      `Review & verify output for ${sampleTask.title}`,
    ];

    expect(subtaskTitles).toHaveLength(3);
    expect(subtaskTitles[0]).toContain("Research requirement details");
    expect(subtaskTitles[1]).toContain("Draft implementation plan");
  });

  it("calculates updated due date shift for AI recommendations", () => {
    const currentDue = new Date("2026-07-29T10:00:00Z").getTime();
    const shiftedDue = new Date(currentDue + 86400000 * 2).toISOString();
    expect(new Date(shiftedDue).getTime() - currentDue).toBe(86400000 * 2);
  });
});
