"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  Clock,
  Eye,
  GripVertical,
  Plus,
  Repeat,
  Timer,
  Trash2,
  CheckCircle2,
  Circle,
  PlayCircle,
  Video,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useDeleteTask, useTasks, useUpdateTask } from "@/hooks/use-tasks";
import { cn, formatDateLabel, extractTaskJoinCallUrl } from "@/lib/utils";
import { usePomodoroStore } from "@/stores/pomodoro-store";
import { useTaskDrawerStore } from "@/stores/task-drawer-store";
import type { Task, TaskFilters, TaskPriority, TaskStatus } from "@/types";

interface TaskBoardViewProps {
  filters: TaskFilters;
  onNewTaskClick?: () => void;
}

const COLUMNS: {
  id: TaskStatus;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}[] = [
  {
    id: "pending",
    title: "Todo",
    subtitle: "Tasks to get started",
    icon: Circle,
    tone: "text-ink-muted",
  },
  {
    id: "in_progress",
    title: "In Progress",
    subtitle: "Currently working on",
    icon: PlayCircle,
    tone: "text-amber-500",
  },
  {
    id: "review",
    title: "Review",
    subtitle: "Under review & QA",
    icon: Eye,
    tone: "text-sky-500",
  },
  {
    id: "completed",
    title: "Done",
    subtitle: "Finished tasks",
    icon: CheckCircle2,
    tone: "text-forest",
  },
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
  const [keyboardGrabbedTaskId, setKeyboardGrabbedTaskId] = useState<string | null>(null);
  const [ariaAnnouncement, setAriaAnnouncement] = useState<string>("");

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Spinner label="Loading Kanban board..." />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-brick">
          Failed to load Kanban tasks. Please refresh the page.
        </CardContent>
      </Card>
    );
  }

  const tasks = data?.items ?? [];

  // Drag and drop mouse handlers
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
      setAriaAnnouncement(`Task "${task.title}" moved to ${targetStatus}`);
    }
  };

  // Keyboard accessibility handler for accessible drag-and-drop
  const handleKeyDown = (e: React.KeyboardEvent, task: Task) => {
    const currentColumnIndex = COLUMNS.findIndex((c) => c.id === task.status);

    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (keyboardGrabbedTaskId === task.id) {
        // Drop task
        setKeyboardGrabbedTaskId(null);
        setAriaAnnouncement(`Task "${task.title}" dropped into ${COLUMNS[currentColumnIndex]?.title}`);
      } else {
        // Pick up task
        setKeyboardGrabbedTaskId(task.id);
        setAriaAnnouncement(
          `Picked up task "${task.title}". Use Left and Right arrow keys to change columns, Enter or Space to drop, Escape to cancel.`
        );
      }
    } else if (e.key === "Escape" && keyboardGrabbedTaskId === task.id) {
      e.preventDefault();
      setKeyboardGrabbedTaskId(null);
      setAriaAnnouncement("Move cancelled.");
    } else if (keyboardGrabbedTaskId === task.id) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const nextIndex = Math.min(COLUMNS.length - 1, currentColumnIndex + 1);
        const nextStatus = COLUMNS[nextIndex].id;
        if (nextStatus !== task.status) {
          updateTask.mutate({
            taskId: task.id,
            input: { status: nextStatus },
          });
          setAriaAnnouncement(`Moved task "${task.title}" to ${COLUMNS[nextIndex].title}`);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prevIndex = Math.max(0, currentColumnIndex - 1);
        const prevStatus = COLUMNS[prevIndex].id;
        if (prevStatus !== task.status) {
          updateTask.mutate({
            taskId: task.id,
            input: { status: prevStatus },
          });
          setAriaAnnouncement(`Moved task "${task.title}" to ${COLUMNS[prevIndex].title}`);
        }
      }
    }
  };

  const handleStartFocus = (task: Task) => {
    setActiveTask(task.id, task.title);
    setMode("work");
    setIsModalOpen(true);
    startTimer();
  };

  return (
    <div className="space-y-2">
      {/* Screen reader live region for drag-and-drop accessibility */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {ariaAnnouncement}
      </div>

      {/* Kanban Matrix Columns */}
      <div
        role="region"
        aria-label="Kanban task board"
        className="flex md:grid md:grid-cols-4 gap-4 overflow-x-auto pb-4 snap-x"
      >
        {COLUMNS.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.id);
          const ColumnIcon = column.icon;
          const isTarget = dragOverColumn === column.id;

          return (
            <div
              key={column.id}
              role="listbox"
              aria-label={`${column.title} column`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={(e) => handleDragLeave(e, column.id)}
              onDrop={(e) => handleDrop(e, column.id)}
              className={cn(
                "flex flex-col rounded-xl border border-paper-line bg-paper-raised/40 p-3.5 transition-all duration-200 min-h-[520px] w-[85vw] sm:w-[320px] md:w-auto shrink-0 snap-center shadow-xs",
                isTarget && "border-forest bg-forest-tint/25 shadow-md ring-2 ring-forest/30"
              )}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between border-b border-paper-line pb-3 mb-3 px-1">
                <div className="flex items-center gap-2">
                  <ColumnIcon className={cn("h-4 w-4", column.tone)} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-semibold text-sm text-ink">{column.title}</h3>
                      <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-semibold text-ink-muted border border-paper-line">
                        {columnTasks.length}
                      </span>
                    </div>
                    <p className="text-[10px] text-ink-muted leading-none mt-0.5">{column.subtitle}</p>
                  </div>
                </div>

                {column.id === "pending" && onNewTaskClick && (
                  <button
                    type="button"
                    onClick={onNewTaskClick}
                    className="focus-ring rounded-md p-1 text-ink-muted hover:bg-paper hover:text-ink transition-colors"
                    title="Add task to Todo"
                    aria-label="Add task to Todo"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Task Cards Container */}
              <div className="flex-1 space-y-3 overflow-y-auto pr-0.5">
                {columnTasks.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-paper-line text-xs text-ink-faint">
                    <span>Drop tasks here</span>
                    <span className="text-[10px] text-ink-faint/70 mt-1">or drag across columns</span>
                  </div>
                ) : (
                  columnTasks.map((task) => {
                    const isBeingDragged = draggedTaskId === task.id;
                    const isKeyboardGrabbed = keyboardGrabbedTaskId === task.id;
                    const isCompleted = task.status === "completed";
                    const joinCallUrl = extractTaskJoinCallUrl(task);

                    return (
                      <div
                        key={task.id}
                        draggable
                        tabIndex={0}
                        role="option"
                        aria-selected={isKeyboardGrabbed}
                        aria-grabbed={isBeingDragged || isKeyboardGrabbed}
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={handleDragEnd}
                        onKeyDown={(e) => handleKeyDown(e, task)}
                        className={cn(
                          "group relative rounded-lg border border-paper-line bg-paper p-3.5 shadow-xs transition-all duration-150 hover:shadow-md hover:border-paper-line/80 cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-forest/50",
                          task.is_overdue && !isCompleted && "border-brick/40 bg-brick-tint/5",
                          isBeingDragged && "opacity-40 scale-[0.98] border-dashed border-forest",
                          isKeyboardGrabbed && "ring-2 ring-forest border-forest bg-forest-tint/20 scale-[1.02] shadow-md"
                        )}
                      >
                        {/* Drag Handle indicator */}
                        <div
                          className="absolute top-2.5 right-2 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity text-ink-faint cursor-grab"
                          title="Drag to reorder or move across columns"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </div>

                        {/* Card Header & Checkbox */}
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
                            aria-label={isCompleted ? "Mark task as incomplete" : "Mark task as complete"}
                            className={cn(
                              "focus-ring mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                              isCompleted ? "border-forest bg-forest" : "border-ink-faint hover:border-forest"
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

                        {/* Card Footer: Metadata, Badges & Actions */}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-paper-line/60">
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge tone={priorityTone[task.priority]} className="text-[10px] px-1.5 py-0 font-medium">
                              {task.priority}
                            </Badge>

                            {task.is_recurring && (
                              <span title="Recurring task" className="text-forest">
                                <Repeat className="h-3 w-3" />
                              </span>
                            )}

                            {/* Overdue Badge */}
                            {task.is_overdue && !isCompleted && (
                              <Badge
                                tone="brick"
                                className="text-[10px] px-1.5 py-0 flex items-center gap-0.5 bg-red-100 text-red-800 border-red-300 font-semibold"
                              >
                                <AlertCircle className="h-2.5 w-2.5" />
                                <span>Overdue{task.overdue_duration ? ` (${task.overdue_duration})` : ""}</span>
                              </Badge>
                            )}

                            {/* Due Date */}
                            {task.due_date && (!task.is_overdue || isCompleted) && (
                              <span className="text-[10px] text-ink-muted flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {formatDateLabel(task.due_date)}
                              </span>
                            )}

                            {/* Join Call ↗ Hyperlink */}
                            {joinCallUrl && (
                              <a
                                href={joinCallUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="Join Call link"
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-forest/15 text-forest hover:bg-forest hover:text-white dark:bg-forest-light/20 dark:text-forest-light transition-colors"
                              >
                                <Video className="h-2.5 w-2.5" />
                                <span>Join Call ↗</span>
                              </a>
                            )}
                          </div>

                          {/* Quick Actions (Pomodoro Focus & Delete) */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
                            {!isCompleted && (
                              <button
                                type="button"
                                onClick={() => handleStartFocus(task)}
                                title="Start Pomodoro Focus"
                                aria-label="Start Pomodoro focus timer"
                                className="focus-ring flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-forest/10 hover:bg-forest text-forest hover:text-white transition-colors"
                              >
                                <Timer className="h-3 w-3" />
                                <span>Focus</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteTask.mutate(task.id)}
                              title="Delete Task"
                              aria-label="Delete task"
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
    </div>
  );
}
