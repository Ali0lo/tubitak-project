"use client";

import { Calendar, Kanban, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type TaskViewMode = "list" | "board" | "calendar";

interface TaskViewSwitcherProps {
  mode: TaskViewMode;
  onChange: (mode: TaskViewMode) => void;
}

export function TaskViewSwitcher({ mode, onChange }: TaskViewSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Task view mode switcher"
      className="inline-flex items-center gap-1 rounded-lg border border-paper-line bg-paper-raised/60 p-1 shadow-sm"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "list"}
        onClick={() => onChange("list")}
        className={cn(
          "focus-ring flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
          mode === "list"
            ? "bg-paper text-ink shadow-sm"
            : "text-ink-muted hover:bg-paper/50 hover:text-ink"
        )}
      >
        <List className="h-3.5 w-3.5" />
        <span>List</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={mode === "board"}
        onClick={() => onChange("board")}
        className={cn(
          "focus-ring flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
          mode === "board"
            ? "bg-paper text-ink shadow-sm"
            : "text-ink-muted hover:bg-paper/50 hover:text-ink"
        )}
      >
        <Kanban className="h-3.5 w-3.5" />
        <span>Board</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={mode === "calendar"}
        onClick={() => onChange("calendar")}
        className={cn(
          "focus-ring flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
          mode === "calendar"
            ? "bg-paper text-ink shadow-sm"
            : "text-ink-muted hover:bg-paper/50 hover:text-ink"
        )}
      >
        <Calendar className="h-3.5 w-3.5" />
        <span>Calendar</span>
      </button>
    </div>
  );
}
