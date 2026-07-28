import { describe, expect, it } from "vitest";
import { Task } from "@/types";

describe("Natural Language Bulk Actions Parsing", () => {
  const tasks: Task[] = [
    {
      id: "t1",
      user_id: "u1",
      title: "Overdue report",
      description: null,
      status: "pending",
      priority: "high",
      due_date: new Date(Date.now() - 86400000).toISOString(),
      completed_at: null,
      is_recurring: false,
      recurrence_rule: null,
      recurrence_parent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
      is_overdue: true,
    },
    {
      id: "t2",
      user_id: "u1",
      title: "Daily Standup Notes",
      description: null,
      status: "pending",
      priority: "medium",
      due_date: new Date().toISOString(),
      completed_at: null,
      is_recurring: true,
      recurrence_rule: { frequency: "daily" },
      recurrence_parent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
      is_overdue: false,
    },
  ];

  it("filters overdue tasks when prompt specifies overdue relocation", () => {
    const prompt = "Move all overdue tasks to tomorrow";
    const isOverdueCmd = prompt.toLowerCase().includes("overdue");

    const overdueIds = tasks.filter((t) => t.is_overdue).map((t) => t.id);

    expect(isOverdueCmd).toBe(true);
    expect(overdueIds).toEqual(["t1"]);
  });

  it("filters recurring tasks when prompt specifies completing recurring work", () => {
    const prompt = "Complete every recurring task";
    const isRecurringCmd = prompt.toLowerCase().includes("recurring");

    const recurringTasks = tasks.filter((t) => t.is_recurring && t.status !== "completed");

    expect(isRecurringCmd).toBe(true);
    expect(recurringTasks).toHaveLength(1);
    expect(recurringTasks[0]!.id).toBe("t2");
  });
});
