"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Repeat,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ActivityTimeline } from "@/components/tasks/activity-timeline";
import { SubtaskList } from "@/components/tasks/subtask-list";
import { TaskComments } from "@/components/tasks/task-comments";
import { AITaskSuggestions } from "@/components/tasks/ai-task-suggestions";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useDeleteTask, useTasks, useUpdateTask } from "@/hooks/use-tasks";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useTaskDrawerStore } from "@/stores/task-drawer-store";
import type { TaskPriority, TaskStatus } from "@/types";

// Hash tag name to a consistent warm aesthetic color badge
function getTagColorClass(tagName: string): string {
  const colors = [
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300",
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300",
    "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-300",
    "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300",
    "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/30 dark:text-rose-300",
    "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300",
  ];
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index]!;
}

export function TaskDetailsDrawer() {
  const { isOpen, selectedTaskId, closeDrawer } = useTaskDrawerStore();
  const queryClient = useQueryClient();

  const { data: tasksData, isLoading: isTasksLoading } = useTasks({});
  const task = tasksData?.items.find((t) => t.id === selectedTaskId);

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  // Local form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("pending");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  // Sync state when selected task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.due_date ? task.due_date.slice(0, 16) : "");
      setIsRecurring(task.is_recurring);
      setTags(task.tags.map((t) => t.name));
      setIsDirty(false);
    }
  }, [task]);

  // Handle ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        if (isDirty) {
          setShowUnsavedModal(true);
        } else {
          closeDrawer();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDirty, closeDrawer]);

  // Tag mutation hook
  const replaceTagsMutation = useMutation({
    mutationFn: (newTags: string[]) =>
      apiClient.put(`/api/v1/tasks/${selectedTaskId}/tags`, newTags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-activities", selectedTaskId] });
    },
  });

  if (!isOpen) return null;

  const handleClose = () => {
    if (isDirty) {
      setShowUnsavedModal(true);
    } else {
      closeDrawer();
    }
  };

  const handleSave = () => {
    if (!selectedTaskId) return;

    updateTask.mutate(
      {
        taskId: selectedTaskId,
        input: {
          title,
          description: description || undefined,
          status,
          priority,
          due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
          is_recurring: isRecurring,
        },
      },
      {
        onSuccess: () => {
          setIsDirty(false);
        },
      }
    );

    replaceTagsMutation.mutate(tags);
  };

  const handleToggleComplete = () => {
    if (!selectedTaskId || !task) return;
    const newStatus: TaskStatus = task.status === "completed" ? "pending" : "completed";
    setStatus(newStatus);
    updateTask.mutate({
      taskId: selectedTaskId,
      input: { status: newStatus },
    });
  };

  const handleDelete = () => {
    if (!selectedTaskId) return;
    deleteTask.mutate(selectedTaskId, {
      onSuccess: () => {
        closeDrawer();
      },
    });
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      const updated = [...tags, trimmed];
      setTags(updated);
      setNewTagInput("");
      setIsDirty(true);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = tags.filter((t) => t !== tagToRemove);
    setTags(updated);
    setIsDirty(true);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={handleClose}
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-paper-line bg-paper shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-paper-line p-4 bg-paper-raised/40">
          <div className="flex items-center gap-2">
            <Badge
              tone={status === "completed" ? "forest" : status === "in_progress" ? "amber" : "neutral"}
            >
              {status.replace("_", " ")}
            </Badge>
            {isDirty && (
              <span className="text-xs text-amber font-medium flex items-center gap-1">
                • Unsaved changes
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close task details drawer"
            className="focus-ring rounded-lg p-1 text-ink-muted hover:bg-paper hover:text-ink transition-colors"
            title="Close drawer (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isTasksLoading || !task ? (
            <div className="py-20 text-center">
              <Spinner label="Loading task details..." />
            </div>
          ) : (
            <>
              {/* Section 1: Core Fields */}
              <div className="space-y-4">
                {/* Editable Title */}
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Task title..."
                  className="w-full font-display text-xl font-bold text-ink bg-transparent border-b border-transparent focus:border-paper-line focus:outline-none transition-colors px-1 py-0.5"
                />

                {/* Editable Description */}
                <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setIsDirty(true);
                  }}
                  rows={3}
                  placeholder="Add description or notes..."
                  className="w-full rounded-md border border-paper-line bg-paper-raised/30 p-2.5 text-xs text-ink placeholder:text-ink-faint focus-ring resize-y"
                />

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-paper-line/60">
                  <div>
                    <label className="text-[11px] font-semibold text-ink-muted block mb-1">
                      Status
                    </label>
                    <Select
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value as TaskStatus);
                        setIsDirty(true);
                      }}
                      className="w-full text-xs"
                    >
                      <option value="pending">Todo</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-ink-muted block mb-1">
                      Priority
                    </label>
                    <Select
                      value={priority}
                      onChange={(e) => {
                        setPriority(e.target.value as TaskPriority);
                        setIsDirty(true);
                      }}
                      className="w-full text-xs"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-ink-muted block mb-1">
                      Due Date
                    </label>
                    <input
                      type="datetime-local"
                      value={dueDate}
                      onChange={(e) => {
                        setDueDate(e.target.value);
                        setIsDirty(true);
                      }}
                      className="w-full rounded-md border border-paper-line bg-paper px-2.5 py-1.5 text-xs text-ink focus-ring"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-ink-muted block mb-1">
                      Recurring
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRecurring(!isRecurring);
                        setIsDirty(true);
                      }}
                      className={cn(
                        "focus-ring w-full flex items-center justify-between rounded-md border border-paper-line px-2.5 py-1.5 text-xs font-semibold transition-colors",
                        isRecurring ? "bg-forest/10 text-forest border-forest" : "bg-paper text-ink-muted"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <Repeat className="h-3.5 w-3.5" />
                        {isRecurring ? "Recurring Enabled" : "Not Recurring"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 2: Tags */}
              <div className="pt-4 border-t border-paper-line/80 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" /> Tags
                  </h4>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {tags.map((tagName) => (
                    <span
                      key={tagName}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium border",
                        getTagColorClass(tagName)
                      )}
                    >
                      #{tagName}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tagName)}
                        className="hover:opacity-75 focus:outline-none"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}

                  <div className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="New tag..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      className="focus-ring w-24 rounded border border-paper-line bg-paper px-2 py-0.5 text-xs text-ink"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="focus-ring rounded p-1 text-ink-muted hover:bg-paper-raised"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* AI Smart Suggestions */}
              <AITaskSuggestions task={task} />

              {/* Section 3: Subtasks */}
              <div className="pt-4 border-t border-paper-line/80">
                <SubtaskList taskId={task.id} />
              </div>

              {/* Section 4: Activity Timeline */}
              <div className="pt-4 border-t border-paper-line/80">
                <ActivityTimeline taskId={task.id} />
              </div>

              {/* Section 5: Comments */}
              <div className="pt-4 border-t border-paper-line/80">
                <TaskComments taskId={task.id} />
              </div>
            </>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="flex items-center justify-between border-t border-paper-line p-4 bg-paper-raised/40">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={updateTask.isPending}
              className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-forest px-3.5 py-1.5 text-xs font-semibold text-paper hover:bg-forest-dark transition-colors disabled:opacity-50"
            >
              Save
            </button>

            <button
              type="button"
              onClick={handleToggleComplete}
              className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-paper-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper-raised transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-forest" />
              <span>{status === "completed" ? "Mark Incomplete" : "Mark Complete"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="focus-ring inline-flex items-center gap-1 rounded-md p-1.5 text-xs font-semibold text-brick hover:bg-brick-tint transition-colors"
              title="Delete task"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="focus-ring rounded-md border border-paper-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-paper-raised transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-paper-line bg-paper p-5 shadow-xl animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-amber font-semibold">
              <AlertTriangle className="h-5 w-5" />
              <span>Unsaved Changes</span>
            </div>
            <p className="mt-2 text-xs text-ink-muted leading-relaxed">
              You have unsaved changes on this task. Discard changes and close?
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUnsavedModal(false)}
                className="focus-ring rounded-md border border-paper-line px-3 py-1.5 text-xs font-semibold text-ink"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedModal(false);
                  closeDrawer();
                }}
                className="focus-ring rounded-md bg-brick px-3 py-1.5 text-xs font-semibold text-paper"
              >
                Discard & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
