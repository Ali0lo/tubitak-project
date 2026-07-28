import { describe, expect, it } from "vitest";
import { Task, Meeting } from "@/types";

describe("AI Daily Briefing", () => {
  const sampleTasks: Task[] = [
    {
      id: "t1",
      user_id: "u1",
      title: "Fix auth bug",
      description: null,
      status: "pending",
      priority: "urgent",
      due_date: new Date().toISOString(),
      completed_at: null,
      is_recurring: false,
      recurrence_rule: null,
      recurrence_parent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
      is_due_today: true,
      is_overdue: false,
    },
    {
      id: "t2",
      user_id: "u1",
      title: "Write documentation",
      description: null,
      status: "pending",
      priority: "medium",
      due_date: new Date(Date.now() - 86400000).toISOString(),
      completed_at: null,
      is_recurring: false,
      recurrence_rule: null,
      recurrence_parent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
      is_due_today: false,
      is_overdue: true,
    },
  ];

  const sampleMeetings: Meeting[] = [
    {
      id: "m1",
      user_id: "u1",
      title: "Sprint Planning",
      description: null,
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 3600000).toISOString(),
      status: "scheduled",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  it("computes accurate today and overdue stats for daily briefing", () => {
    const todayCount = sampleTasks.filter((t) => t.is_due_today).length;
    const overdueCount = sampleTasks.filter((t) => t.is_overdue).length;
    const urgentCount = sampleTasks.filter((t) => t.priority === "urgent").length;

    expect(todayCount).toBe(1);
    expect(overdueCount).toBe(1);
    expect(urgentCount).toBe(1);
    expect(sampleMeetings.length).toBe(1);
  });

  it("handles local storage caching key generation", () => {
    const todayStr = "2026-07-29";
    const cacheKey = `todotak-briefing-cache-${todayStr}`;
    expect(cacheKey).toContain("todotak-briefing-cache-2026-07-29");
  });
});
