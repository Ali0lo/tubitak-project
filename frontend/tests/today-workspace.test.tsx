import { describe, it, expect } from "vitest";
import { Task, TaskPriority } from "../types/task";

function suggestNextTask(tasks: Task[]) {
  if (!tasks || tasks.length === 0) return null;

  const priorityWeight: Record<TaskPriority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  return [...tasks].sort((a, b) => {
    const weightA = priorityWeight[a.priority];
    const weightB = priorityWeight[b.priority];
    if (weightA !== weightB) return weightB - weightA;
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    return 0;
  })[0];
}

describe("Today Workspace Next Task Recommendation", () => {
  it("prioritizes urgent task over low priority task", () => {
    const mockTasks: Partial<Task>[] = [
      { id: "1", title: "Low Priority Task", priority: "low" },
      { id: "2", title: "Urgent Release Task", priority: "urgent" },
    ];

    const suggested = suggestNextTask(mockTasks as Task[]);
    expect(suggested?.title).toBe("Urgent Release Task");
  });

  it("returns null when candidate task pool is empty", () => {
    expect(suggestNextTask([])).toBeNull();
  });
});
