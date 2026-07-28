import { describe, it, expect } from "vitest";
import { Task } from "../types/task";

function calculateMetrics(tasks: Task[]) {
  const total = tasks.length || 1;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter((t) => t.is_overdue && t.status !== "completed").length;

  const completedWithDates = tasks.filter((t) => t.status === "completed" && t.completed_at && t.created_at);
  let avgHours = 0;

  if (completedWithDates.length > 0) {
    const totalDiffMs = completedWithDates.reduce((acc, t) => {
      const start = new Date(t.created_at).getTime();
      const end = new Date(t.completed_at!).getTime();
      return acc + Math.max(0, end - start);
    }, 0);
    avgHours = Math.round((totalDiffMs / completedWithDates.length / (1000 * 60 * 60)) * 10) / 10;
  }

  return {
    completionRate: Math.round((completed / total) * 100),
    overdueRate: Math.round((overdue / total) * 100),
    avgHours,
  };
}

describe("Analytics Calculator", () => {
  it("computes completion rate and overdue rate correctly", () => {
    const mockTasks: Partial<Task>[] = [
      { id: "1", status: "completed", is_overdue: false },
      { id: "2", status: "pending", is_overdue: true },
      { id: "3", status: "pending", is_overdue: false },
      { id: "4", status: "completed", is_overdue: false },
    ];

    const metrics = calculateMetrics(mockTasks as Task[]);
    expect(metrics.completionRate).toBe(50);
    expect(metrics.overdueRate).toBe(25);
  });

  it("calculates average completion duration in hours", () => {
    const created = new Date("2026-07-29T10:00:00Z").toISOString();
    const completed = new Date("2026-07-29T14:00:00Z").toISOString(); // 4 hours later

    const mockTasks: Partial<Task>[] = [
      { id: "1", status: "completed", created_at: created, completed_at: completed },
    ];

    const metrics = calculateMetrics(mockTasks as Task[]);
    expect(metrics.avgHours).toBe(4);
  });
});
