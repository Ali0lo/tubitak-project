"use client";

import { Trash2, Repeat, AlertCircle, Clock, Timer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useDeleteTask, useUpdateTask } from "@/hooks/use-tasks";
import { cn, formatDateLabel, formatTimestamp } from "@/lib/utils";
import type { Task, TaskPriority } from "@/types";
import { usePomodoroStore } from "@/stores/pomodoro-store";
import { useTaskDrawerStore } from "@/stores/task-drawer-store";

const priorityTone: Record<
  TaskPriority,
  "low" | "medium" | "high" | "urgent"
> = {
  low: "low",
  medium: "medium",
  high: "high",
  urgent: "urgent",
};

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { setActiveTask, setMode, setIsModalOpen, startTimer } = usePomodoroStore();
  const isCompleted = task.status === "completed";

  const toggleComplete = () => {
    updateTask.mutate({
      taskId: task.id,
      input: { status: isCompleted ? "pending" : "completed" },
    });
  };

  const handleStartFocus = () => {
    setActiveTask(task.id, task.title);
    setMode("work");
    setIsModalOpen(true);
    startTimer();
  };

  return (
    <div className="ledger-line group px-5">
      <span className="ledger-stamp">
        {task.due_date ? (
          <>
            {formatDateLabel(task.due_date)}
            <br />
            {formatTimestamp(task.due_date)}
          </>
        ) : (
          "—"
        )}
      </span>

      <button
        type="button"
        onClick={toggleComplete}
        aria-pressed={isCompleted}
        aria-label={
          isCompleted ? "Mark task as not completed" : "Mark task as completed"
        }
        className={cn(
          "focus-ring mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
          isCompleted ? "border-forest bg-forest" : "border-ink-faint"
        )}
      />

      <div
        onClick={() => useTaskDrawerStore.getState().openDrawer(task.id)}
        className="min-w-0 flex-1 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "ledger-title hover:text-forest transition-colors",
              isCompleted && "text-ink-faint line-through"
            )}
          >
            {task.title}
          </p>
          {task.is_recurring ? (
            <span title="Recurring task">
              <Repeat className="h-3.5 w-3.5 text-forest" />
            </span>
          ) : null}
        </div>

        {task.description ? (
          <p className="mt-0.5 line-clamp-1 text-sm text-ink-muted">
            {task.description}
          </p>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
          {task.is_overdue ? (
            <Badge tone="brick" className="flex items-center gap-1 bg-red-100 text-red-800 border-red-300">
              <AlertCircle className="h-3 w-3" /> Overdue ({task.overdue_duration})
            </Badge>
          ) : null}
          {task.next_reminder_at ? (
            <Badge tone="neutral" className="flex items-center gap-1 text-[10px]">
              <Clock className="h-3 w-3 text-sky-600" /> Reminder set
            </Badge>
          ) : null}
          {task.tags.map((tag) => (
            <Badge key={tag.id} tone="neutral">
              #{tag.name}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {!isCompleted && (
          <button
            type="button"
            onClick={handleStartFocus}
            aria-label="Start Pomodoro focus session"
            title="Start Pomodoro Focus"
            className="focus-ring flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-forest/10 hover:bg-forest text-forest hover:text-paper transition-colors"
          >
            <Timer className="h-3.5 w-3.5" />
            <span>Focus</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => deleteTask.mutate(task.id)}
          aria-label="Delete task"
          className="focus-ring rounded-seal p-1.5 text-ink-faint transition-opacity hover:bg-brick-tint hover:text-brick"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

