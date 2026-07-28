"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ProductivitySettings {
  defaultTaskView: "list" | "board" | "calendar";
  theme: "system" | "light" | "dark";
  dashboardDensity: "compact" | "comfortable" | "expanded";
  soundNotifications: boolean;
  desktopNotifications: boolean;
  defaultReminderTimingMinutes: number; // e.g. 15 mins before
  aiAutoSuggestSubtasks: boolean;
  aiSmartSchedulingEnabled: boolean;
  keyboardShortcutsEnabled: boolean;
  focusModeAutoMute: boolean;
  workSessionDurationMinutes: number;
}

interface SettingsState {
  settings: ProductivitySettings;
  updateSettings: (newSettings: Partial<ProductivitySettings>) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: ProductivitySettings = {
  defaultTaskView: "list",
  theme: "system",
  dashboardDensity: "comfortable",
  soundNotifications: true,
  desktopNotifications: true,
  defaultReminderTimingMinutes: 15,
  aiAutoSuggestSubtasks: true,
  aiSmartSchedulingEnabled: true,
  keyboardShortcutsEnabled: true,
  focusModeAutoMute: true,
  workSessionDurationMinutes: 25,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,

      updateSettings: (newSettings) => {
        set({ settings: { ...get().settings, ...newSettings } });
      },

      resetSettings: () => {
        set({ settings: DEFAULT_SETTINGS });
      },
    }),
    {
      name: "todotak-productivity-settings",
    }
  )
);
