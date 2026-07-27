import { create } from "zustand";
import { persist } from "zustand/middleware";
import { pomodoroAudio } from "@/lib/pomodoro-sound";

export type PomodoroMode = "work" | "shortBreak" | "longBreak";

export interface PomodoroSettings {
  workDuration: number; // in minutes
  shortBreakDuration: number; // in minutes
  longBreakDuration: number; // in minutes
  autoStartBreaks: boolean;
  soundEnabled: boolean;
  soundVolume: number; // 0.0 to 1.0
}

interface AlarmBannerState {
  isOpen: boolean;
  completedMode: PomodoroMode | null;
  taskTitle: string | null;
}

interface PomodoroState {
  mode: PomodoroMode;
  timeLeft: number; // in seconds
  isRunning: boolean;
  completedPomodoros: number;
  activeTaskId: string | null;
  activeTaskTitle: string | null;
  settings: PomodoroSettings;
  isModalOpen: boolean;
  alarmBanner: AlarmBannerState;

  // Actions
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  skipPhase: () => void;
  setMode: (mode: PomodoroMode) => void;
  tick: () => void;
  setActiveTask: (taskId: string | null, taskTitle: string | null) => void;
  updateSettings: (newSettings: Partial<PomodoroSettings>) => void;
  setIsModalOpen: (open: boolean) => void;
  closeAlarmBanner: () => void;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  autoStartBreaks: false,
  soundEnabled: true,
  soundVolume: 0.8,
};

const getModeDurationSeconds = (mode: PomodoroMode, settings: PomodoroSettings): number => {
  switch (mode) {
    case "work":
      return settings.workDuration * 60;
    case "shortBreak":
      return settings.shortBreakDuration * 60;
    case "longBreak":
      return settings.longBreakDuration * 60;
  }
};

const sendDesktopNotification = (mode: PomodoroMode, taskTitle: string | null) => {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  if (Notification.permission === "granted") {
    let title = "Pomodoro Finished!";
    let body = "Time for a break!";

    if (mode === "work") {
      title = "Focus Session Complete!";
      body = taskTitle
        ? `Great job working on "${taskTitle}"! Take a well-deserved break.`
        : "Great job! Take a well-deserved break.";
    } else {
      title = "Break Complete!";
      body = "Ready to start your next focus session?";
    }

    new Notification(title, {
      body,
      icon: "/favicon.ico",
    });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission();
  }
};

export const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set, get) => ({
      mode: "work",
      timeLeft: DEFAULT_SETTINGS.workDuration * 60,
      isRunning: false,
      completedPomodoros: 0,
      activeTaskId: null,
      activeTaskTitle: null,
      settings: DEFAULT_SETTINGS,
      isModalOpen: false,
      alarmBanner: {
        isOpen: false,
        completedMode: null,
        taskTitle: null,
      },

      startTimer: () => {
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
        set({ isRunning: true });
      },

      pauseTimer: () => {
        set({ isRunning: false });
      },

      resetTimer: () => {
        const { mode, settings } = get();
        set({
          isRunning: false,
          timeLeft: getModeDurationSeconds(mode, settings),
        });
      },

      skipPhase: () => {
        const { mode, settings, completedPomodoros } = get();
        let nextMode: PomodoroMode = "work";

        if (mode === "work") {
          const nextCount = completedPomodoros + 1;
          nextMode = nextCount % 4 === 0 ? "longBreak" : "shortBreak";
          set({ completedPomodoros: nextCount });
        } else {
          nextMode = "work";
        }

        set({
          mode: nextMode,
          isRunning: false,
          timeLeft: getModeDurationSeconds(nextMode, settings),
        });
      },

      setMode: (newMode: PomodoroMode) => {
        const { settings } = get();
        set({
          mode: newMode,
          isRunning: false,
          timeLeft: getModeDurationSeconds(newMode, settings),
        });
      },

      tick: () => {
        const { timeLeft, isRunning, mode, settings, completedPomodoros, activeTaskTitle } = get();
        if (!isRunning) return;

        if (timeLeft > 1) {
          set({ timeLeft: timeLeft - 1 });
        } else {
          // Timer hit 00:00! Handle completion.
          const finishedMode = mode;
          let newCompletedCount = completedPomodoros;
          let nextMode: PomodoroMode = "work";

          if (finishedMode === "work") {
            newCompletedCount += 1;
            nextMode = newCompletedCount % 4 === 0 ? "longBreak" : "shortBreak";
          } else {
            nextMode = "work";
          }

          // Sound alarm
          if (settings.soundEnabled) {
            if (finishedMode === "work") {
              pomodoroAudio.playAlarmSound(settings.soundVolume);
            } else {
              pomodoroAudio.playBreakSound(settings.soundVolume);
            }
          }

          // Desktop Notification
          sendDesktopNotification(finishedMode, activeTaskTitle);

          const shouldAutoStart = settings.autoStartBreaks && finishedMode === "work";

          set({
            isRunning: shouldAutoStart,
            completedPomodoros: newCompletedCount,
            mode: nextMode,
            timeLeft: getModeDurationSeconds(nextMode, settings),
            alarmBanner: {
              isOpen: true,
              completedMode: finishedMode,
              taskTitle: activeTaskTitle,
            },
          });
        }
      },

      setActiveTask: (taskId, taskTitle) => {
        set({
          activeTaskId: taskId,
          activeTaskTitle: taskTitle,
        });
      },

      updateSettings: (newSettings) => {
        const currentSettings = get().settings;
        const updated = { ...currentSettings, ...newSettings };
        const { mode, isRunning } = get();

        // If not running, adjust current timeLeft based on updated mode duration
        const newTimeLeft = isRunning ? get().timeLeft : getModeDurationSeconds(mode, updated);

        set({
          settings: updated,
          timeLeft: newTimeLeft,
        });
      },

      setIsModalOpen: (open: boolean) => {
        set({ isModalOpen: open });
      },

      closeAlarmBanner: () => {
        set({
          alarmBanner: {
            isOpen: false,
            completedMode: null,
            taskTitle: null,
          },
        });
      },
    }),
    {
      name: "todotak-pomodoro-store",
      partialize: (state) => ({
        completedPomodoros: state.completedPomodoros,
        settings: state.settings,
        activeTaskId: state.activeTaskId,
        activeTaskTitle: state.activeTaskTitle,
      }),
    }
  )
);
