"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  Clock,
  GripVertical,
  Plus,
  Repeat,
  Timer,
  Trash2,
  CheckCircle2,
  Circle,
  PlayCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useDeleteTask, useTasks, useUpdateTask } from "@/hooks/use-tasks";
import { cn, formatDateLabel, formatTimestamp } from "@/lib/utils";
import { usePomodoroStore } from "@/stores/pomodoro-store";
import { useTaskDrawerStore } from "@/stores/task-drawer-store";
import type { Task, TaskFilters, TaskPriority, TaskStatus } from "@/types";

interface TaskBoardViewProps {
  filters: TaskFilters;
  onNewTaskClick?: () => void;
}

const COLUMNS: { id: TaskStatus; title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "pending", title: "Todo", subtitle: "Tasks to get started", icon: Circle },
  { id: "in_progress", title: "In Progress", subtitle: "Currently working on", icon: PlayCircle },
  { id: "completed", title: "Completed", subtitle: "Finished tasks", icon: CheckCircle2 },
];

const priorityTone: Record<TaskPriority, "low" | "medium" | "high" | "urgent"> = {
  low: "low",
  medium: "medium",
  high: "high",
  urgent: "urgent",
};

export function TaskBoardView({ filters, onNewTaskClick }: TaskBoardViewProps) {
  const { data, isLoading, isError } = useTasks(filters);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { setActiveTask, setMode, setIsModalOpen, startTimer } = usePomodoroStore();

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Spinner label="Loading task board..." />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-brick">
          Failed to load board tasks. Please refresh the page.
        </CardContent>
      </Card>
    );
  }

  const tasks = data?.items ?? [];

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, columnId: TaskStatus) => {
    // Only reset if leaving the column element itself
    const related = e.relatedTarget as HTMLElement | null;
    if (!e.currentTarget.contains(related)) {
      if (dragOverColumn === columnId) {
        setDragOverColumn(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
    setDragOverColumn(null);
    setDraggedTaskId(null);

    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== targetStatus) {
      updateTask.mutate({
        taskId: task.id,
        input: { status: targetStatus },
      });
    }
  };

  const handleStartFocus = (task: Task) => {
    setActiveTask(task.id, task.title);
    setMode("work");
    setIsModalOpen(true);
    startTimer();
  };

  return (
    <div className="flex md:grid md:grid-cols-3 gap-5 overflow-x-auto pb-4 snap-x">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.id);
        const ColumnIcon = column.icon;
        const isTarget = dragOverColumn === column.id;

        return (
          <div
            key={column.id}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={(e) => handleDragLeave(e, column.id)}
            onDrop={(e) => handleDrop(e, column.id)}
            className={cn(
              "flex flex-col rounded-xl border border-paper-line bg-paper-raised/40 p-3.5 transition-all duration-200 min-h-[500px] w-[85vw] sm:w-[350px] md:w-auto shrink-0 snap-center",
              isTarget && "border-forest bg-forest-tint/20 shadow-md ring-2 ring-forest/30"
            )}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between border-b border-paper-line pb-3 mb-3 px-1">
              <div className="flex items-center gap-2">
                <ColumnIcon
                  className={cn(
                    "h-4 w-4",
                    column.id === "pending" && "text-ink-muted",
                    column.id === "in_progress" && "text-amber",
                    column.id === "completed" && "text-forest"
                  )}
                />
                <h3 className="font-display font-semibold text-sm text-ink">{column.title}</h3>
                <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-ink-muted border border-paper-line">
                  {columnTasks.length}
                </span>
              </div>

              {column.id === "pending" && onNewTaskClick && (
                <button
                  type="button"
                  onClick={onNewTaskClick}
                  className="focus-ring rounded-md p-1 text-ink-muted hover:bg-paper hover:text-ink transition-colors"
                  title="Add task to Todo"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Task Cards Container */}
            <div className="flex-1 space-y-3 overflow-y-auto pr-0.5">
              {columnTasks.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-paper-line text-xs text-ink-faint">
                  Drop tasks here
                </div>
              ) : (
                columnTasks.map((task) => {
                  const isBeingDragged = draggedTaskId === task.id;
                  const isCompleted = task.status === "completed";

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "group relative rounded-lg border border-paper-line bg-paper p-3.5 shadow-sm transition-all duration-150 hover:shadow-md hover:border-paper-line/80 cursor-grab active:cursor-grabbing",
                        isBeingDragged && "opacity-40 scale-[0.98] border-dashed border-forest"
                      )}
                    >
                      {/* Drag Handle indicator */}
                      <div className="absolute top-2.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-ink-faint">
                        <GripVertical className="h-3.5 w-3.5" />
                      </div>

                      {/* Card Content */}
                      <div className="flex items-start gap-2 pr-4">
                        <button
                          type="button"
                          onClick={() =>
                            updateTask.mutate({
                              taskId: task.id,
                              input: {
                                status: isCompleted ? "pending" : "completed",
                              },
                            })
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
                          <p
                            className={cn(
                              "text-sm font-medium text-ink leading-tight hover:text-forest transition-colors",
                              isCompleted && "text-ink-faint line-through"
                            )}
                          >
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-ink-muted">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Card Footer: Metadata & Actions */}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-paper-line/60">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge tone={priorityTone[task.priority]} className="text-[10px] px-1.5 py-0">
                            {task.priority}
                          </Badge>

                          {task.is_recurring && (
                            <span title="Recurring task">
                              <Repeat className="h-3 w-3 text-forest" />
                            </span>
                          )}

                          {task.is_overdue && (
                            <Badge tone="brick" className="text-[10px] px-1.5 py-0 flex items-center gap-0.5">
                              <AlertCircle className="h-2.5 w-2.5" />
                              Overdue
                            </Badge>
                          )}

                          {task.due_date && !task.is_overdue && (
                            <span className="text-[10px] text-ink-muted flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {formatDateLabel(task.due_date)}
                            </span>
                          )}
                        </div>

                        {/* Hover Quick Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!isCompleted && (
                            <button
                              type="button"
                              onClick={() => handleStartFocus(task)}
                              title="Start Focus Timer"
                              className="focus-ring p-1 rounded hover:bg-forest-tint text-forest transition-colors"
                            >
                              <Timer className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteTask.mutate(task.id)}
                            title="Delete Task"
                            className="focus-ring p-1 rounded hover:bg-brick-tint text-brick transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
