import { describe, it, expect } from "vitest";
import { Task } from "../types/task";
import { format, subDays } from "date-fns";

// Dynamically compute streak stats for test validation
function computeStreak(tasks: Task[]) {
  const completedTasks = tasks.filter((t) => t.status === "completed" && t.completed_at);
  const completedDates = new Set(
    completedTasks.map((t) => format(new Date(t.completed_at!), "yyyy-MM-dd"))
  );

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const completedToday = completedDates.has(todayStr);

  let streak = 0;
  let checkDate = new Date();

  if (!completedToday) {
    checkDate = subDays(checkDate, 1);
  }

  while (completedDates.has(format(checkDate, "yyyy-MM-dd"))) {
    streak++;
    checkDate = subDays(checkDate, 1);
  }

  return { streak, completedToday };
}

describe("Streak Calculator", () => {
  it("calculates 0 streak when no completed tasks exist", () => {
    const res = computeStreak([]);
    expect(res.streak).toBe(0);
    expect(res.completedToday).toBe(false);
  });

  it("calculates 1 day streak when task completed today", () => {
    const mockTasks: Partial<Task>[] = [
      { id: "1", status: "completed", completed_at: new Date().toISOString() },
    ];
    const res = computeStreak(mockTasks as Task[]);
    expect(res.streak).toBe(1);
    expect(res.completedToday).toBe(true);
  });

  it("calculates continuous multi-day streak", () => {
    const today = new Date();
    const yesterday = subDays(today, 1);
    const twoDaysAgo = subDays(today, 2);

    const mockTasks: Partial<Task>[] = [
      { id: "1", status: "completed", completed_at: today.toISOString() },
      { id: "2", status: "completed", completed_at: yesterday.toISOString() },
      { id: "3", status: "completed", completed_at: twoDaysAgo.toISOString() },
    ];

    const res = computeStreak(mockTasks as Task[]);
    expect(res.streak).toBe(3);
    expect(res.completedToday).toBe(true);
  });
});
