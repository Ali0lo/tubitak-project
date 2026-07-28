import { describe, it, expect, beforeEach } from "vitest";
import { useAchievementsStore } from "../stores/use-achievements-store";

describe("Achievements Store", () => {
  beforeEach(() => {
    useAchievementsStore.getState().resetAchievements();
  });

  it("unlocks First Step achievement upon completing 1 task", () => {
    const store = useAchievementsStore.getState();
    const unlocked = store.checkAndUnlock({
      totalCompleted: 1,
      currentStreak: 1,
      meetingsAttended: 0,
      focusSessionsCompleted: 0,
      recurringCompleted: 0,
    });

    expect(unlocked).toContain("First Step");
    expect(useAchievementsStore.getState().achievements.first_task.unlocked).toBe(true);
  });

  it("unlocks On Fire achievement upon reaching 7-day streak", () => {
    const store = useAchievementsStore.getState();
    const unlocked = store.checkAndUnlock({
      totalCompleted: 10,
      currentStreak: 7,
      meetingsAttended: 0,
      focusSessionsCompleted: 0,
      recurringCompleted: 0,
    });

    expect(unlocked).toContain("On Fire");
    expect(useAchievementsStore.getState().achievements.streak_7.unlocked).toBe(true);
  });

  it("unlocks Early Bird achievement if task completed before 8 AM", () => {
    const store = useAchievementsStore.getState();
    const unlocked = store.checkAndUnlock({
      totalCompleted: 5,
      currentStreak: 2,
      completedAtHours: [7], // 7 AM
      meetingsAttended: 0,
      focusSessionsCompleted: 0,
      recurringCompleted: 0,
    });

    expect(unlocked).toContain("Early Bird");
    expect(useAchievementsStore.getState().achievements.early_bird.unlocked).toBe(true);
  });
});
