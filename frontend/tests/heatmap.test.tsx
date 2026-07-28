import { describe, it, expect } from "vitest";
import { Task } from "../types/task";
import { format, subDays, isSameDay } from "date-fns";

function calculateHeatmapDays(tasks: Task[]) {
  const today = new Date();
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = subDays(today, i);
    const completed = tasks.filter(
      (t) =>
        t.status === "completed" &&
        t.completed_at &&
        isSameDay(new Date(t.completed_at), d)
    );

    let intensity = 0;
    const count = completed.length;
    if (count === 1 || count === 2) intensity = 1;
    else if (count >= 3) intensity = 2;

    days.push({
      dateStr: format(d, "yyyy-MM-dd"),
      completedCount: count,
      intensity,
    });
  }

  return days;
}

describe("Heatmap Calculation Unit Tests", () => {
  it("generates correct completion counts and intensity levels for days", () => {
    const today = new Date();
    const mockTasks: Partial<Task>[] = [
      { id: "1", status: "completed", completed_at: today.toISOString() },
      { id: "2", status: "completed", completed_at: today.toISOString() },
      { id: "3", status: "completed", completed_at: today.toISOString() },
    ];

    const days = calculateHeatmapDays(mockTasks as Task[]);
    const todayData = days[days.length - 1];

    expect(todayData.completedCount).toBe(3);
    expect(todayData.intensity).toBe(2);
  });
});
