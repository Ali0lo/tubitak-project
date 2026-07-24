"use client";

import { Trash2, Repeat, AlertCircle, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useDeleteTask, useUpdateTask } from "@/hooks/use-tasks";
import { cn, formatDateLabel, formatTimestamp } from "@/lib/utils";
import type { Task, TaskPriority } from "@/types";

const priorityTone: Record<
  TaskPriority,
  "neutral" | "forest" | "amber" | "brick"
> = {
  low: "neutral",
  medium: "forest",
  high: "amber",
  urgent: "brick",
};

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const isCompleted = task.status === "completed";

  const toggleComplete = () => {
    updateTask.mutate({
      taskId: task.id,
      input: { status: isCompleted ? "pending" : "completed" },
    });
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

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "ledger-title",
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

      <button
        type="button"
        onClick={() => deleteTask.mutate(task.id)}
        aria-label="Delete task"
        className="focus-ring rounded-seal p-1.5 text-ink-faint opacity-0 transition-opacity hover:bg-brick-tint hover:text-brick group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
