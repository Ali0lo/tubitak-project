"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TaskFilters, TaskPriority, TaskStatus } from "@/types";
import type { TaskViewMode } from "@/components/tasks/task-view-switcher";

export type TaskSortField = "due_date" | "priority" | "title" | "created_at";
export type TaskGroupField = "none" | "status" | "priority";

export interface SavedViewPreset {
  id: string;
  name: string;
  isBuiltIn?: boolean;
  filters: TaskFilters;
  sorting: TaskSortField;
  grouping: TaskGroupField;
  viewMode: TaskViewMode;
}

const DEFAULT_PRESETS: SavedViewPreset[] = [
  {
    id: "all",
    name: "All Tasks",
    isBuiltIn: true,
    filters: {},
    sorting: "due_date",
    grouping: "none",
    viewMode: "list",
  },
  {
    id: "today",
    name: "Today",
    isBuiltIn: true,
    filters: { today: true },
    sorting: "due_date",
    grouping: "none",
    viewMode: "list",
  },
  {
    id: "this_week",
    name: "This Week",
    isBuiltIn: true,
    filters: { upcoming: true },
    sorting: "due_date",
    grouping: "none",
    viewMode: "calendar",
  },
  {
    id: "high_priority",
    name: "High Priority",
    isBuiltIn: true,
    filters: { priority: "high" },
    sorting: "priority",
    grouping: "priority",
    viewMode: "board",
  },
  {
    id: "personal",
    name: "Personal",
    isBuiltIn: true,
    filters: { tag: "personal" },
    sorting: "due_date",
    grouping: "none",
    viewMode: "list",
  },
  {
    id: "work",
    name: "Work",
    isBuiltIn: true,
    filters: { tag: "work" },
    sorting: "due_date",
    grouping: "none",
    viewMode: "board",
  },
  {
    id: "completed",
    name: "Completed",
    isBuiltIn: true,
    filters: { status: "completed" },
    sorting: "due_date",
    grouping: "none",
    viewMode: "list",
  },
  {
    id: "overdue",
    name: "Overdue",
    isBuiltIn: true,
    filters: { overdue: true },
    sorting: "due_date",
    grouping: "status",
    viewMode: "list",
  },
  {
    id: "recurring",
    name: "Recurring",
    isBuiltIn: true,
    filters: { recurring: true },
    sorting: "title",
    grouping: "none",
    viewMode: "list",
  },
];

interface SavedViewsState {
  presets: SavedViewPreset[];
  activePresetId: string;
  selectPreset: (id: string) => void;
  saveCustomPreset: (name: string, preset: Omit<SavedViewPreset, "id" | "name">) => void;
  deleteCustomPreset: (id: string) => void;
}

export const useSavedViewsStore = create<SavedViewsState>()(
  persist(
    (set) => ({
      presets: DEFAULT_PRESETS,
      activePresetId: "all",
      selectPreset: (id: string) => set({ activePresetId: id }),
      saveCustomPreset: (name: string, presetData) =>
        set((state) => {
          const newPreset: SavedViewPreset = {
            id: `custom-${Date.now()}`,
            name,
            isBuiltIn: false,
            ...presetData,
          };
          return {
            presets: [...state.presets, newPreset],
            activePresetId: newPreset.id,
          };
        }),
      deleteCustomPreset: (id: string) =>
        set((state) => ({
          presets: state.presets.filter((p) => p.id !== id || p.isBuiltIn),
          activePresetId: state.activePresetId === id ? "all" : state.activePresetId,
        })),
    }),
    {
      name: "todotak-saved-views-storage",
    }
  )
);
