"use client";

import React, { useState } from "react";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import {
  useCreateSubtask,
  useDeleteSubtask,
  useReorderSubtasks,
  useSubtasks,
  useUpdateSubtask,
} from "@/hooks/use-subtasks";
import { cn } from "@/lib/utils";
import type { Subtask } from "@/types";

interface SubtaskListProps {
  taskId: string;
}

export function SubtaskList({ taskId }: SubtaskListProps) {
  const { data: subtasks = [], isLoading } = useSubtasks(taskId);
  const createSubtask = useCreateSubtask(taskId);
  const updateSubtask = useUpdateSubtask(taskId);
  const deleteSubtask = useDeleteSubtask(taskId);
  const reorderSubtasks = useReorderSubtasks(taskId);

  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState("");

  const completedCount = subtasks.filter((s) => s.completed).length;
  const totalCount = subtasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createSubtask.mutate({ title: newTitle.trim() }, {
      onSuccess: () => setNewTitle(""),
    });
  };

  const handleToggle = (subtask: Subtask) => {
    updateSubtask.mutate({
      subtaskId: subtask.id,
      input: { completed: !subtask.completed },
    });
  };

  const handleStartEditing = (subtask: Subtask) => {
    setEditingId(subtask.id);
    setEditTitleText(subtask.title);
  };

  const handleSaveTitle = (subtaskId: string) => {
    if (editTitleText.trim()) {
      updateSubtask.mutate({
        subtaskId,
        input: { title: editTitleText.trim() },
      });
    }
    setEditingId(null);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= subtasks.length) return;

    const listCopy = [...subtasks];
    const moved = listCopy[index];
    if (!moved) return;
    listCopy.splice(index, 1);
    listCopy.splice(targetIndex, 0, moved);

    const reorderedIds = listCopy.map((s) => s.id);
    reorderSubtasks.mutate(reorderedIds);
  };

  return (
    <div className="space-y-4">
      {/* Header & Progress Indicator */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Subtasks ({completedCount} / {totalCount} completed)
        </h4>
        <span className="text-xs font-bold text-forest">{progressPercent}%</span>
      </div>

      {/* Animated Progress Bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-paper-line">
        <div
          className="h-full bg-forest transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Subtasks List */}
      {isLoading ? (
        <div className="py-4 text-center text-xs text-ink-faint">Loading subtasks...</div>
      ) : (
        <div className="space-y-1.5">
          {subtasks.map((subtask, index) => (
            <div
              key={subtask.id}
              className="group flex items-center justify-between gap-2 rounded-md border border-paper-line bg-paper/60 p-2 text-sm transition-all hover:bg-paper"
            >
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => handleToggle(subtask)}
                  className={cn(
                    "focus-ring flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                    subtask.completed
                      ? "border-forest bg-forest text-paper"
                      : "border-ink-faint hover:border-ink"
                  )}
                >
                  {subtask.completed && <Check className="h-3 w-3 stroke-[3]" />}
                </button>

                {editingId === subtask.id ? (
                  <input
                    type="text"
                    value={editTitleText}
                    onChange={(e) => setEditTitleText(e.target.value)}
                    onBlur={() => handleSaveTitle(subtask.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTitle(subtask.id);
                    }}
                    autoFocus
                    className="focus-ring flex-1 rounded border border-paper-line bg-paper px-2 py-0.5 text-xs text-ink"
                  />
                ) : (
                  <span
                    onClick={() => handleStartEditing(subtask)}
                    className={cn(
                      "cursor-pointer truncate text-ink hover:text-forest transition-colors text-xs font-medium",
                      subtask.completed && "text-ink-faint line-through"
                    )}
                  >
                    {subtask.title}
                  </span>
                )}
              </div>

              {/* Subtask Action buttons */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleMove(index, "up")}
                  disabled={index === 0}
                  className="p-1 text-ink-faint hover:text-ink disabled:opacity-30"
                  title="Move subtask up"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(index, "down")}
                  disabled={index === subtasks.length - 1}
                  className="p-1 text-ink-faint hover:text-ink disabled:opacity-30"
                  title="Move subtask down"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteSubtask.mutate(subtask.id)}
                  className="p-1 text-ink-faint hover:text-brick"
                  title="Delete subtask"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Subtask Form */}
      <form onSubmit={handleAdd} className="flex items-center gap-2 pt-1">
        <input
          type="text"
          placeholder="Add a new subtask..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="focus-ring flex-1 rounded-md border border-paper-line bg-paper px-3 py-1.5 text-xs text-ink placeholder:text-ink-faint"
        />
        <button
          type="submit"
          disabled={!newTitle.trim() || createSubtask.isPending}
          className="focus-ring inline-flex items-center gap-1 rounded-md bg-forest/10 px-3 py-1.5 text-xs font-semibold text-forest hover:bg-forest hover:text-paper transition-colors disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </form>
    </div>
  );
}
