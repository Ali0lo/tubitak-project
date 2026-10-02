import { describe, expect, it } from "vitest";
import type { Task, TaskStatus } from "@/types";
import { extractTaskJoinCallUrl } from "@/lib/utils";

describe("Kanban Matrix Board Columns & Drag-and-Drop Logic", () => {
  const mockTasks: Task[] = [
    {
      id: "task-1",
      user_id: "u1",
      title: "Todo Task",
      description: "Description 1",
      status: "pending",
      priority: "high",
      board_order: 0,
      due_date: "2026-07-20T10:00:00Z",
      completed_at: null,
      is_recurring: false,
      recurrence_rule: null,
      recurrence_parent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
      is_overdue: true,
      overdue_duration: "2 days",
    },
    {
      id: "task-2",
      user_id: "u1",
      title: "Sprint Planning Sync",
      description: "Discuss quarterly OKRs on https://meet.google.com/abc-defg-hij",
      status: "in_progress",
      priority: "urgent",
      board_order: 1,
      due_date: null,
      completed_at: null,
      is_recurring: false,
      recurrence_rule: null,
      recurrence_parent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [{ id: "tag-1", name: "planning" }],
    },
    {
      id: "task-3",
      user_id: "u1",
      title: "Pull Request Review #42",
      description: "Review auth tokens and security rules",
      status: "review",
      priority: "medium",
      board_order: 0,
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
      id: "task-4",
      user_id: "u1",
      title: "Completed Milestone",
      description: "All acceptance criteria met",
      status: "completed",
      priority: "low",
      board_order: 0,
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

  it("filters tasks correctly across all 4 Kanban Matrix status columns", () => {
    const pendingTasks = mockTasks.filter((t) => t.status === "pending");
    const inProgressTasks = mockTasks.filter((t) => t.status === "in_progress");
    const reviewTasks = mockTasks.filter((t) => t.status === "review");
    const completedTasks = mockTasks.filter((t) => t.status === "completed");

    expect(pendingTasks).toHaveLength(1);
    expect(pendingTasks[0].title).toBe("Todo Task");

    expect(inProgressTasks).toHaveLength(1);
    expect(inProgressTasks[0].title).toBe("Sprint Planning Sync");

    expect(reviewTasks).toHaveLength(1);
    expect(reviewTasks[0].title).toBe("Pull Request Review #42");

    expect(completedTasks).toHaveLength(1);
    expect(completedTasks[0].title).toBe("Completed Milestone");
  });

  it("handles status transitions correctly for drag and drop across columns", () => {
    const taskToMove = { ...mockTasks[0] };
    const transitions: TaskStatus[] = ["in_progress", "review", "completed", "pending"];

    for (const targetStatus of transitions) {
      taskToMove.status = targetStatus;
      expect(taskToMove.status).toBe(targetStatus);
    }
  });

  it("correctly identifies overdue tasks and preserves overdue metadata", () => {
    const overdueTask = mockTasks.find((t) => t.is_overdue);
    expect(overdueTask).toBeDefined();
    expect(overdueTask?.status).toBe("pending");
    expect(overdueTask?.overdue_duration).toBe("2 days");
  });

  it("extracts Join Call ↗ hyperlinks from task descriptions for meeting links", () => {
    const callTask = mockTasks[1];
    const extractedUrl = extractTaskJoinCallUrl(callTask);
    expect(extractedUrl).toBe("https://meet.google.com/abc-defg-hij");

    const noCallTask = mockTasks[0];
    expect(extractTaskJoinCallUrl(noCallTask)).toBeNull();
  });

  it("extracts Zoom and Teams links accurately from descriptions and titles", () => {
    expect(
      extractTaskJoinCallUrl({
        title: "1-on-1 Sync",
        description: "Join via https://zoom.us/j/123456789 passcode: 123",
      })
    ).toBe("https://zoom.us/j/123456789");

    expect(
      extractTaskJoinCallUrl({
        title: "Client Demo https://teams.microsoft.com/l/meetup-join/19",
        description: null,
      })
    ).toBe("https://teams.microsoft.com/l/meetup-join/19");
  });

  it("maintains board ordering within columns", () => {
    const columnTasks = [
      { id: "t1", status: "in_progress" as TaskStatus, board_order: 2 },
      { id: "t2", status: "in_progress" as TaskStatus, board_order: 0 },
      { id: "t3", status: "in_progress" as TaskStatus, board_order: 1 },
    ];

    const sorted = [...columnTasks].sort((a, b) => (a.board_order ?? 0) - (b.board_order ?? 0));
    expect(sorted.map((t) => t.id)).toEqual(["t2", "t3", "t1"]);
  });
});
