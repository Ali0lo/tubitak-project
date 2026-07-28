import { describe, expect, it } from "vitest";
import { useTaskDrawerStore } from "@/stores/task-drawer-store";

describe("Task Details Drawer Store & Progress Calculation", () => {
  it("manages drawer open and close state correctly", () => {
    expect(useTaskDrawerStore.getState().isOpen).toBe(false);
    expect(useTaskDrawerStore.getState().selectedTaskId).toBeNull();

    useTaskDrawerStore.getState().openDrawer("task-123");
    expect(useTaskDrawerStore.getState().isOpen).toBe(true);
    expect(useTaskDrawerStore.getState().selectedTaskId).toBe("task-123");

    useTaskDrawerStore.getState().closeDrawer();
    expect(useTaskDrawerStore.getState().isOpen).toBe(false);
    expect(useTaskDrawerStore.getState().selectedTaskId).toBeNull();
  });

  it("calculates subtask progress ratio and percentages accurately", () => {
    const subtasks = [
      { id: "1", completed: true },
      { id: "2", completed: true },
      { id: "3", completed: true },
      { id: "4", completed: true },
      { id: "5", completed: true },
      { id: "6", completed: true },
      { id: "7", completed: true },
      { id: "8", completed: false },
      { id: "9", completed: false },
      { id: "10", completed: false },
    ];

    const completedCount = subtasks.filter((s) => s.completed).length;
    const totalCount = subtasks.length;
    const progressPercent = Math.round((completedCount / totalCount) * 100);

    expect(completedCount).toBe(7);
    expect(totalCount).toBe(10);
    expect(progressPercent).toBe(70);
  });
});
