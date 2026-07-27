import { describe, it, expect, beforeEach, vi } from "vitest";
import { usePomodoroStore } from "@/stores/pomodoro-store";

describe("Pomodoro Store", () => {
  beforeEach(() => {
    // Reset store state before each test
    usePomodoroStore.setState({
      mode: "work",
      timeLeft: 25 * 60,
      isRunning: false,
      completedPomodoros: 0,
      activeTaskId: null,
      activeTaskTitle: null,
      settings: {
        workDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        autoStartBreaks: false,
        soundEnabled: true,
        soundVolume: 0.8,
      },
      isModalOpen: false,
      alarmBanner: {
        isOpen: false,
        completedMode: null,
        taskTitle: null,
      },
    });
  });

  it("initializes with default 25 minute work focus session", () => {
    const state = usePomodoroStore.getState();
    expect(state.mode).toBe("work");
    expect(state.timeLeft).toBe(1500);
    expect(state.isRunning).toBe(false);
  });

  it("starts, pauses, and resets timer correctly", () => {
    const store = usePomodoroStore.getState();

    store.startTimer();
    expect(usePomodoroStore.getState().isRunning).toBe(true);

    store.pauseTimer();
    expect(usePomodoroStore.getState().isRunning).toBe(false);

    usePomodoroStore.setState({ timeLeft: 100 });
    usePomodoroStore.getState().resetTimer();
    expect(usePomodoroStore.getState().timeLeft).toBe(1500);
  });

  it("switches modes and updates initial duration", () => {
    const store = usePomodoroStore.getState();

    store.setMode("shortBreak");
    expect(usePomodoroStore.getState().mode).toBe("shortBreak");
    expect(usePomodoroStore.getState().timeLeft).toBe(300);

    store.setMode("longBreak");
    expect(usePomodoroStore.getState().mode).toBe("longBreak");
    expect(usePomodoroStore.getState().timeLeft).toBe(900);
  });

  it("skips phase and increments completed count on work mode finish", () => {
    const store = usePomodoroStore.getState();

    store.skipPhase();
    expect(usePomodoroStore.getState().completedPomodoros).toBe(1);
    expect(usePomodoroStore.getState().mode).toBe("shortBreak");

    store.skipPhase();
    expect(usePomodoroStore.getState().mode).toBe("work");
  });

  it("binds active task title to pomodoro session", () => {
    const store = usePomodoroStore.getState();

    store.setActiveTask("task-123", "Write unit test for pomodoro");
    expect(usePomodoroStore.getState().activeTaskId).toBe("task-123");
    expect(usePomodoroStore.getState().activeTaskTitle).toBe("Write unit test for pomodoro");
  });

  it("updates settings and adjusts duration dynamically when idle", () => {
    const store = usePomodoroStore.getState();

    store.updateSettings({ workDuration: 30 });
    expect(usePomodoroStore.getState().settings.workDuration).toBe(30);
    expect(usePomodoroStore.getState().timeLeft).toBe(1800);
  });

  it("handles ticking down and triggers completion when reaching 0", () => {
    usePomodoroStore.setState({
      timeLeft: 1,
      isRunning: true,
      mode: "work",
      completedPomodoros: 0,
      activeTaskTitle: "Complete feature",
    });

    usePomodoroStore.getState().tick();

    const updated = usePomodoroStore.getState();
    expect(updated.completedPomodoros).toBe(1);
    expect(updated.mode).toBe("shortBreak");
    expect(updated.alarmBanner.isOpen).toBe(true);
    expect(updated.alarmBanner.completedMode).toBe("work");
    expect(updated.alarmBanner.taskTitle).toBe("Complete feature");
  });
});
