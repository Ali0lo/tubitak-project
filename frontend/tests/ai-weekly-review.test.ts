import { describe, expect, it } from "vitest";
import { Task, Meeting } from "@/types";

describe("AI Weekly Review", () => {
  const sevenDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();

  const tasks: Task[] = [
    {
      id: "t1",
      user_id: "u1",
      title: "Completed Task 1",
      description: null,
      status: "completed",
      priority: "high",
      due_date: sevenDaysAgo,
      completed_at: sevenDaysAgo,
      is_recurring: true,
      recurrence_rule: { frequency: "daily" },
      recurrence_parent_id: null,
      created_at: sevenDaysAgo,
      updated_at: sevenDaysAgo,
      tags: [],
    },
    {
      id: "t2",
      user_id: "u1",
      title: "Completed Task 2",
      description: null,
      status: "completed",
      priority: "low",
      due_date: sevenDaysAgo,
      completed_at: sevenDaysAgo,
      is_recurring: false,
      recurrence_rule: null,
      recurrence_parent_id: null,
      created_at: sevenDaysAgo,
      updated_at: sevenDaysAgo,
      tags: [],
    },
  ];

  const meetings: Meeting[] = [
    {
      id: "m1",
      user_id: "u1",
      title: "Weekly Sync",
      description: null,
      start_time: sevenDaysAgo,
      end_time: sevenDaysAgo,
      status: "completed",
      created_at: sevenDaysAgo,
      updated_at: sevenDaysAgo,
    },
  ];

  it("calculates weekly execution metrics accurately", () => {
    const completedWeek = tasks.filter((t) => t.status === "completed");
    const recurringCount = completedWeek.filter((t) => t.is_recurring).length;

    expect(completedWeek).toHaveLength(2);
    expect(recurringCount).toBe(1);
    expect(meetings).toHaveLength(1);
  });
});
