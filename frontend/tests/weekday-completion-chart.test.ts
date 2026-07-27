import { describe, it, expect } from "vitest";
import { computeWeekdayStats } from "@/components/dashboard/weekday-completion-chart";
import { Task } from "@/types/task";

const mockTasks: Task[] = [
  {
    id: "task-1",
    user_id: "user-1",
    title: "Monday Task 1",
    status: "completed",
    priority: "high",
    completed_at: "2026-07-20T10:00:00Z", // Monday
    tags: [],
    created_at: "2026-07-19T10:00:00Z",
    updated_at: "2026-07-20T10:00:00Z",
    is_overdue: false,
    overdue_duration: "",
    is_due_today: false,
  },
  {
    id: "task-2",
    user_id: "user-1",
    title: "Monday Task 2",
    status: "completed",
    priority: "medium",
    completed_at: "2026-07-20T14:00:00Z", // Monday
    tags: [],
    created_at: "2026-07-19T10:00:00Z",
    updated_at: "2026-07-20T14:00:00Z",
    is_overdue: false,
    overdue_duration: "",
    is_due_today: false,
  },
  {
    id: "task-3",
    user_id: "user-1",
    title: "Wednesday Task",
    status: "completed",
    priority: "urgent",
    completed_at: "2026-07-22T09:00:00Z", // Wednesday
    tags: [],
    created_at: "2026-07-19T10:00:00Z",
    updated_at: "2026-07-22T09:00:00Z",
    is_overdue: false,
    overdue_duration: "",
    is_due_today: false,
  },
  {
    id: "task-4",
    user_id: "user-1",
    title: "Pending Task",
    status: "pending",
    priority: "low",
    tags: [],
    created_at: "2026-07-19T10:00:00Z",
    updated_at: "2026-07-19T10:00:00Z",
    is_overdue: false,
    overdue_duration: "",
    is_due_today: false,
  },
];

describe("computeWeekdayStats", () => {
  const referenceDate = new Date("2026-07-27T12:00:00Z"); // Monday

  it("correctly aggregates completed tasks by day of the week", () => {
    const result = computeWeekdayStats(mockTasks, "all", referenceDate);

    expect(result.totalCount).toBe(3);
    expect(result.maxCount).toBe(2);

    // Monday (dayIndex 0) should have 2 completed tasks
    const mondayStat = result.stats.find((s) => s.dayIndex === 0);
    expect(mondayStat?.count).toBe(2);
    expect(mondayStat?.percentage).toBe(67);

    // Wednesday (dayIndex 2) should have 1 completed task
    const wednesdayStat = result.stats.find((s) => s.dayIndex === 2);
    expect(wednesdayStat?.count).toBe(1);
    expect(wednesdayStat?.percentage).toBe(33);

    // Peak day should be Monday
    expect(result.peakDay?.dayName).toBe("Monday");
  });

  it("handles empty completed tasks list gracefully", () => {
    const result = computeWeekdayStats([], "all", referenceDate);
    expect(result.totalCount).toBe(0);
    expect(result.maxCount).toBe(0);
    expect(result.peakDay).toBeNull();
  });

  it("filters tasks correctly when date range filters are applied", () => {
    const oldTask: Task = {
      id: "task-old",
      user_id: "user-1",
      title: "Very Old Task",
      status: "completed",
      priority: "low",
      completed_at: "2025-01-01T10:00:00Z",
      tags: [],
      created_at: "2025-01-01T08:00:00Z",
      updated_at: "2025-01-01T10:00:00Z",
      is_overdue: false,
      overdue_duration: "",
      is_due_today: false,
    };

    const tasks = [...mockTasks, oldTask];

    const allResult = computeWeekdayStats(tasks, "all", referenceDate);
    expect(allResult.totalCount).toBe(4);

    const past30Result = computeWeekdayStats(tasks, "30days", referenceDate);
    expect(past30Result.totalCount).toBe(3); // oldTask excluded
  });
});
