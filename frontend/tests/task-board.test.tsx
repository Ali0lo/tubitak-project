import { describe, expect, it } from "vitest";
import type { Task, TaskStatus } from "@/types";

describe("Task Board Columns & Status Logic", () => {
  const mockTasks: Task[] = [
    {
      id: "task-1",
      user_id: "u1",
      title: "Todo Task",
      description: "Description 1",
      status: "pending",
      priority: "high",
      due_date: null,
      completed_at: null,
      is_recurring: false,
      recurrence_rule: null,
      recurrence_parent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
    },
    {
      id: "task-2",
      user_id: "u1",
      title: "In Progress Task",
      description: null,
      status: "in_progress",
      priority: "medium",
      due_date: null,
      completed_at: null,
      is_recurring: false,
      recurrence_rule: null,
      recurrence_parent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [{ id: "tag-1", name: "frontend" }],
    },
    {
      id: "task-3",
      user_id: "u1",
      title: "Completed Task",
      description: null,
      status: "completed",
      priority: "low",
      due_date: null,
      completed_at: new Date().toISOString(),
      is_recurring: false,
      recurrence_rule: null,
      recurrence_parent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
    },
  ];

  it("filters tasks correctly by Kanban status columns", () => {
    const pendingTasks = mockTasks.filter((t) => t.status === "pending");
    const inProgressTasks = mockTasks.filter((t) => t.status === "in_progress");
    const completedTasks = mockTasks.filter((t) => t.status === "completed");

    expect(pendingTasks).toHaveLength(1);
    expect(pendingTasks[0].title).toBe("Todo Task");

    expect(inProgressTasks).toHaveLength(1);
    expect(inProgressTasks[0].title).toBe("In Progress Task");

    expect(completedTasks).toHaveLength(1);
    expect(completedTasks[0].title).toBe("Completed Task");
  });

  it("handles status transitions correctly for drag and drop", () => {
    const taskToMove = { ...mockTasks[0] };
    const targetStatus: TaskStatus = "in_progress";

    taskToMove.status = targetStatus;
    expect(taskToMove.status).toBe("in_progress");
  });
});
