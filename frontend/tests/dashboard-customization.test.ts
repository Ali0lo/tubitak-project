import { describe, expect, it } from "vitest";
import { useDashboardLayoutStore } from "@/stores/use-dashboard-layout-store";

describe("Dashboard Layout Customization Store", () => {
  it("initializes with default layout density and pinned widgets", () => {
    const state = useDashboardLayoutStore.getState();
    expect(state.density).toBe("comfortable");
    expect(state.pinnedWidgets).toContain("ai_briefing");
    expect(state.pinnedWidgets).toContain("productivity_coach");
  });

  it("toggles pinning status of a widget", () => {
    const { togglePinWidget } = useDashboardLayoutStore.getState();
    togglePinWidget("smart_scheduling");

    let updatedState = useDashboardLayoutStore.getState();
    expect(updatedState.pinnedWidgets).toContain("smart_scheduling");

    togglePinWidget("smart_scheduling");
    updatedState = useDashboardLayoutStore.getState();
    expect(updatedState.pinnedWidgets).not.toContain("smart_scheduling");
  });

  it("updates layout density mode", () => {
    const { setDensity } = useDashboardLayoutStore.getState();
    setDensity("compact");
    expect(useDashboardLayoutStore.getState().density).toBe("compact");

    setDensity("expanded");
    expect(useDashboardLayoutStore.getState().density).toBe("expanded");
  });
});
