"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ListTodo,
  MessageSquare,
  Search,
  Tag,
  X,
} from "lucide-react";
import { useMeetings } from "@/hooks/use-meetings";
import { useTasks } from "@/hooks/use-tasks";
import { useSearchModalStore } from "@/stores/use-search-modal-store";
import { useTaskDrawerStore } from "@/stores/task-drawer-store";
import { cn } from "@/lib/utils";

export function GlobalSearchModal() {
  const { isOpen, closeSearch } = useSearchModalStore();
  const { data: tasksData } = useTasks({ page_size: 100 } as any);
  const { data: meetingsData } = useMeetings();
  const [query, setQuery] = useState("");

  const tasks = useMemo(() => tasksData?.items ?? [], [tasksData]);
  const meetings = useMemo(() => meetingsData?.items ?? [], [meetingsData]);

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeSearch();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeSearch]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { tasks: [], meetings: [], tags: [] };

    // Natural Language Search Filters
    let matchingTasks = tasks;
    let matchingMeetings = meetings;

    if (q.includes("finish") || q.includes("completed") || q.includes("done") || q.includes("last week")) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
      matchingTasks = tasks.filter(
        (t) => t.status === "completed" && t.completed_at && new Date(t.completed_at) >= sevenDaysAgo
      );
    } else if (q.includes("overdue")) {
      matchingTasks = tasks.filter((t) => t.is_overdue);
      matchingMeetings = meetings.filter((m) => m.is_overdue);
    } else if (q.includes("urgent")) {
      matchingTasks = tasks.filter((t) => t.priority === "urgent");
    } else if (q.includes("recurring")) {
      matchingTasks = tasks.filter((t) => t.is_recurring);
    } else {
      matchingTasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
      );
      matchingMeetings = meetings.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          (m.description && m.description.toLowerCase().includes(q))
      );
    }

    const matchingTags = Array.from(
      new Set(
        tasks
          .flatMap((t) => t.tags.map((tag) => tag.name))
          .filter((tagName) => tagName.toLowerCase().includes(q))
      )
    );

    return {
      tasks: matchingTasks.slice(0, 5),
      meetings: matchingMeetings.slice(0, 5),
      tags: matchingTags.slice(0, 5),
    };
  }, [query, tasks, meetings]);

  if (!isOpen) return null;

  const handleSelectTask = (taskId: string) => {
    closeSearch();
    useTaskDrawerStore.getState().openDrawer(taskId);
  };

  const totalResults =
    searchResults.tasks.length +
    searchResults.meetings.length +
    searchResults.tags.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl rounded-xl border border-paper-line bg-paper shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Search Header Input */}
        <div className="flex items-center gap-3 border-b border-paper-line px-4 py-3 bg-paper-raised/30">
          <Search className="h-5 w-5 text-ink-muted shrink-0" />
          <input
            type="text"
            placeholder="Fuzzy search tasks, meetings, tags, subtasks, comments..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-ink-faint hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <span className="rounded bg-paper px-1.5 py-0.5 font-mono text-[10px] text-ink-faint border border-paper-line">
            ESC
          </span>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-4">
          {!query.trim() ? (
            <div className="py-8 text-center text-xs text-ink-faint">
              Type to search across tasks, meetings, tags, subtasks, and comments...
            </div>
          ) : totalResults === 0 ? (
            <div className="py-8 text-center text-xs text-ink-faint">
              No results found for &quot;{query}&quot;
            </div>
          ) : (
            <>
              {/* Tasks Group */}
              {searchResults.tasks.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2 flex items-center gap-1.5">
                    <ListTodo className="h-3.5 w-3.5" /> Tasks ({searchResults.tasks.length})
                  </h4>
                  <div className="space-y-1">
                    {searchResults.tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => handleSelectTask(task.id)}
                        className="flex items-center justify-between rounded-lg p-2 hover:bg-paper-raised cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className="h-4 w-4 text-forest shrink-0" />
                          <span className="text-xs font-medium text-ink truncate">
                            {task.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-ink-faint capitalize">
                          {task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meetings Group */}
              {searchResults.meetings.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Meetings ({searchResults.meetings.length})
                  </h4>
                  <div className="space-y-1">
                    {searchResults.meetings.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-lg p-2 hover:bg-paper-raised transition-colors"
                      >
                        <span className="text-xs font-medium text-ink truncate">{m.title}</span>
                        <span className="text-[10px] text-ink-faint">{m.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags Group */}
              {searchResults.tags.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2 flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> Tags ({searchResults.tags.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {searchResults.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-paper-line bg-paper-raised px-2 py-1 text-xs font-medium text-ink"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
