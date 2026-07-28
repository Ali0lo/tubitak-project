import { describe, expect, it } from "vitest";
import { useSettingsStore } from "@/stores/use-settings-store";

describe("Productivity Settings Store Persistence", () => {
  it("initializes with default workspace preferences", () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.defaultTaskView).toBe("list");
    expect(settings.aiAutoSuggestSubtasks).toBe(true);
    expect(settings.aiSmartSchedulingEnabled).toBe(true);
    expect(settings.workSessionDurationMinutes).toBe(25);
  });

  it("updates preferences partially and retains unedited settings", () => {
    const { updateSettings } = useSettingsStore.getState();
    updateSettings({ defaultTaskView: "board", workSessionDurationMinutes: 30 });

    const { settings } = useSettingsStore.getState();
    expect(settings.defaultTaskView).toBe("board");
    expect(settings.workSessionDurationMinutes).toBe(30);
    expect(settings.aiAutoSuggestSubtasks).toBe(true);
  });

  it("resets preferences back to defaults", () => {
    const { updateSettings, resetSettings } = useSettingsStore.getState();
    updateSettings({ defaultTaskView: "calendar" });
    resetSettings();

    const { settings } = useSettingsStore.getState();
    expect(settings.defaultTaskView).toBe("list");
  });
});
