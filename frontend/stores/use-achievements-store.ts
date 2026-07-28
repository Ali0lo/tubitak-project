"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  iconName: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress: number; // 0 to 100
  target: number;
  currentValue: number;
}

interface AchievementsState {
  achievements: Record<string, Achievement>;
  checkAndUnlock: (stats: {
    totalCompleted: number;
    currentStreak: number;
    completedAtHours?: number[];
    meetingsAttended: number;
    focusSessionsCompleted: number;
    recurringCompleted: number;
  }) => string[]; // returns newly unlocked achievement titles
  resetAchievements: () => void;
}

const INITIAL_ACHIEVEMENTS: Record<string, Achievement> = {
  first_task: {
    id: "first_task",
    title: "First Step",
    description: "Complete your very first task",
    iconName: "Sparkles",
    unlocked: false,
    progress: 0,
    target: 1,
    currentValue: 0,
  },
  tasks_100: {
    id: "tasks_100",
    title: "Century Club",
    description: "Complete 100 total tasks",
    iconName: "Trophy",
    unlocked: false,
    progress: 0,
    target: 100,
    currentValue: 0,
  },
  streak_7: {
    id: "streak_7",
    title: "On Fire",
    description: "Maintain a 7-day completion streak",
    iconName: "Flame",
    unlocked: false,
    progress: 0,
    target: 7,
    currentValue: 0,
  },
  early_bird: {
    id: "early_bird",
    title: "Early Bird",
    description: "Complete a task before 8:00 AM",
    iconName: "Sun",
    unlocked: false,
    progress: 0,
    target: 1,
    currentValue: 0,
  },
  night_owl: {
    id: "night_owl",
    title: "Night Owl",
    description: "Complete a task after 10:00 PM",
    iconName: "Moon",
    unlocked: false,
    progress: 0,
    target: 1,
    currentValue: 0,
  },
  meeting_master: {
    id: "meeting_master",
    title: "Meeting Master",
    description: "Attend 5 or more scheduled meetings",
    iconName: "Video",
    unlocked: false,
    progress: 0,
    target: 5,
    currentValue: 0,
  },
  focus_champion: {
    id: "focus_champion",
    title: "Focus Champion",
    description: "Complete 10 Pomodoro focus sessions",
    iconName: "Timer",
    unlocked: false,
    progress: 0,
    target: 10,
    currentValue: 0,
  },
  recurring_expert: {
    id: "recurring_expert",
    title: "Recurring Expert",
    description: "Complete 5 recurring task cycles",
    iconName: "Repeat",
    unlocked: false,
    progress: 0,
    target: 5,
    currentValue: 0,
  },
};

export const useAchievementsStore = create<AchievementsState>()(
  persist(
    (set, get) => ({
      achievements: INITIAL_ACHIEVEMENTS,

      checkAndUnlock: (stats) => {
        const current = get().achievements;
        const updated = { ...current };
        const newlyUnlocked: string[] = [];
        const now = new Date().toISOString();

        const updates: Array<{ id: string; val: number }> = [
          { id: "first_task", val: stats.totalCompleted },
          { id: "tasks_100", val: stats.totalCompleted },
          { id: "streak_7", val: stats.currentStreak },
          { id: "meeting_master", val: stats.meetingsAttended },
          { id: "focus_champion", val: stats.focusSessionsCompleted },
          { id: "recurring_expert", val: stats.recurringCompleted },
        ];

        // Check Early Bird (< 8 AM)
        if (stats.completedAtHours?.some((h) => h < 8)) {
          updates.push({ id: "early_bird", val: 1 });
        }
        // Check Night Owl (>= 22 PM)
        if (stats.completedAtHours?.some((h) => h >= 22)) {
          updates.push({ id: "night_owl", val: 1 });
        }

        updates.forEach(({ id, val }) => {
          const ach = updated[id];
          if (!ach) return;

          const currentValue = Math.max(ach.currentValue, val);
          const progress = Math.min(100, Math.round((currentValue / ach.target) * 100));
          const shouldUnlock = !ach.unlocked && currentValue >= ach.target;

          if (shouldUnlock) {
            newlyUnlocked.push(ach.title);
          }

          updated[id] = {
            ...ach,
            currentValue,
            progress,
            unlocked: ach.unlocked || shouldUnlock,
            unlockedAt: ach.unlockedAt || (shouldUnlock ? now : undefined),
          };
        });

        set({ achievements: updated });
        return newlyUnlocked;
      },

      resetAchievements: () => {
        set({ achievements: INITIAL_ACHIEVEMENTS });
      },
    }),
    {
      name: "todotak-achievements-store",
    }
  )
);
