"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DashboardDensity = "compact" | "comfortable" | "expanded";

interface DashboardLayoutState {
  density: DashboardDensity;
  pinnedWidgets: string[];
  widgetOrder: string[];
  setDensity: (density: DashboardDensity) => void;
  togglePinWidget: (widgetId: string) => void;
  reorderWidgets: (newOrder: string[]) => void;
  resetLayout: () => void;
}

const DEFAULT_WIDGET_ORDER = [
  "ai_briefing",
  "productivity_coach",
  "smart_today",
  "workload_indicator",
  "insights_section",
  "smart_scheduling",
  "smart_reminders",
  "achievements",
];

const DEFAULT_PINNED = ["ai_briefing", "productivity_coach"];

export const useDashboardLayoutStore = create<DashboardLayoutState>()(
  persist(
    (set, get) => ({
      density: "comfortable",
      pinnedWidgets: DEFAULT_PINNED,
      widgetOrder: DEFAULT_WIDGET_ORDER,

      setDensity: (density) => set({ density }),

      togglePinWidget: (widgetId) => {
        const current = get().pinnedWidgets;
        const exists = current.includes(widgetId);
        const updated = exists ? current.filter((id) => id !== widgetId) : [...current, widgetId];
        set({ pinnedWidgets: updated });
      },

      reorderWidgets: (newOrder) => set({ widgetOrder: newOrder }),

      resetLayout: () =>
        set({
          density: "comfortable",
          pinnedWidgets: DEFAULT_PINNED,
          widgetOrder: DEFAULT_WIDGET_ORDER,
        }),
    }),
    {
      name: "todotak-dashboard-layout",
    }
  )
);
