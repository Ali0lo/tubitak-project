import { describe, it, expect } from "vitest";
import { Task } from "../types/task";

function calculatePriorityBreakdown(tasks: Task[]) {
  const counts = { low: 0, medium: 0, high: 0, urgent: 0 };
  tasks.forEach((t) => {
    if (counts[t.priority] !== undefined) {
      counts[t.priority] += 1;
    }
  });
  return counts;
}

describe("Productivity Charts Priority Breakdown", () => {
  it("aggregates task priorities correctly", () => {
    const mockTasks: Partial<Task>[] = [
      { id: "1", priority: "urgent" },
      { id: "2", priority: "high" },
      { id: "3", priority: "urgent" },
      { id: "4", priority: "medium" },
    ];

    const breakdown = calculatePriorityBreakdown(mockTasks as Task[]);
    expect(breakdown.urgent).toBe(2);
    expect(breakdown.high).toBe(1);
    expect(breakdown.medium).toBe(1);
    expect(breakdown.low).toBe(0);
  });
});
