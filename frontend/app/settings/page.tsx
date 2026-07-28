"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { useSettingsStore, ProductivitySettings } from "@/stores/use-settings-store";
import { useDashboardLayoutStore } from "@/stores/use-dashboard-layout-store";
import { Settings, Sliders, Bell, Sparkles, Moon, Sun, Monitor, Check, RotateCcw, Keyboard, Flame } from "lucide-react";

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  const { density, setDensity } = useDashboardLayoutStore();
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleChange = <K extends keyof ProductivitySettings>(key: K, value: ProductivitySettings[K]) => {
    updateSettings({ [key]: value });
    if (key === "dashboardDensity") {
      setDensity(value as any);
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <AppShell title="Settings">
      <div className="max-w-4xl space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-paper-line pb-4">
          <div>
            <h1 className="font-display text-xl font-bold text-ink flex items-center gap-2">
              <Settings className="h-5 w-5 text-forest" />
              Productivity Workspace Settings
            </h1>
            <p className="text-xs text-ink-muted">Customize preferences, theme, AI automation, and notifications</p>
          </div>

          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="text-xs font-mono text-emerald-600 flex items-center gap-1 font-bold">
                <Check className="h-4 w-4" /> Preferences Saved
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                resetSettings();
                setSavedSuccess(true);
                setTimeout(() => setSavedSuccess(false), 2000);
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-paper border border-paper-line rounded-lg hover:bg-paper-tint text-ink transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>

        {/* Section 1: Workspace & Views */}
        <Card className="p-5 space-y-4">
          <h2 className="font-display text-sm font-semibold text-ink flex items-center gap-2 border-b border-paper-line pb-2">
            <Sliders className="h-4 w-4 text-forest" />
            Workspace & Task Preferences
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-ink">Default Task View</label>
              <select
                value={settings.defaultTaskView}
                onChange={(e) => handleChange("defaultTaskView", e.target.value as any)}
                className="w-full p-2 rounded-lg border border-paper-line bg-paper text-ink font-mono focus:outline-none"
              >
                <option value="list">List View</option>
                <option value="board">Kanban Board</option>
                <option value="calendar">Calendar Grid</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-ink">Dashboard Layout Density</label>
              <select
                value={settings.dashboardDensity}
                onChange={(e) => handleChange("dashboardDensity", e.target.value as any)}
                className="w-full p-2 rounded-lg border border-paper-line bg-paper text-ink font-mono focus:outline-none"
              >
                <option value="compact">Compact (High Information Density)</option>
                <option value="comfortable">Comfortable (Standard Balance)</option>
                <option value="expanded">Expanded (Generous Spacing)</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Section 2: AI Preferences */}
        <Card className="p-5 space-y-4">
          <h2 className="font-display text-sm font-semibold text-ink flex items-center gap-2 border-b border-paper-line pb-2">
            <Sparkles className="h-4 w-4 text-forest" />
            AI Automation & Smart Productivity
          </h2>

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between p-3 bg-paper-tint/60 rounded-lg border border-paper-line cursor-pointer">
              <div>
                <span className="font-semibold text-ink block">AI Subtask Suggestions</span>
                <span className="text-ink-muted">Automatically suggest subtask breakdowns inside Task Details Drawer</span>
              </div>
              <input
                type="checkbox"
                checked={settings.aiAutoSuggestSubtasks}
                onChange={(e) => handleChange("aiAutoSuggestSubtasks", e.target.checked)}
                className="h-4 w-4 accent-forest"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-paper-tint/60 rounded-lg border border-paper-line cursor-pointer">
              <div>
                <span className="font-semibold text-ink block">Smart Scheduling Recommendations</span>
                <span className="text-ink-muted">Display AI timing & priority execution recommendations</span>
              </div>
              <input
                type="checkbox"
                checked={settings.aiSmartSchedulingEnabled}
                onChange={(e) => handleChange("aiSmartSchedulingEnabled", e.target.checked)}
                className="h-4 w-4 accent-forest"
              />
            </label>
          </div>
        </Card>

        {/* Section 3: Focus & Notifications */}
        <Card className="p-5 space-y-4">
          <h2 className="font-display text-sm font-semibold text-ink flex items-center gap-2 border-b border-paper-line pb-2">
            <Bell className="h-4 w-4 text-amber-500" />
            Notifications & Focus Mode
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <label className="flex items-center justify-between p-3 bg-paper-tint/60 rounded-lg border border-paper-line cursor-pointer">
              <div>
                <span className="font-semibold text-ink block">Desktop Notifications</span>
                <span className="text-ink-muted">Browser alerts for meetings & focus sessions</span>
              </div>
              <input
                type="checkbox"
                checked={settings.desktopNotifications}
                onChange={(e) => handleChange("desktopNotifications", e.target.checked)}
                className="h-4 w-4 accent-forest"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-paper-tint/60 rounded-lg border border-paper-line cursor-pointer">
              <div>
                <span className="font-semibold text-ink block">Audio Sound Effects</span>
                <span className="text-ink-muted">Chimes on timer completion and task completion</span>
              </div>
              <input
                type="checkbox"
                checked={settings.soundNotifications}
                onChange={(e) => handleChange("soundNotifications", e.target.checked)}
                className="h-4 w-4 accent-forest"
              />
            </label>
          </div>
        </Card>

        {/* Section 4: Demo Showcase Mode */}
        <Card className="p-5 space-y-4 bg-gradient-to-r from-forest/10 via-paper to-paper border-forest/30">
          <h2 className="font-display text-sm font-semibold text-ink flex items-center gap-2 border-b border-paper-line pb-2">
            <Flame className="h-4 w-4 text-forest animate-pulse" />
            Demonstration Mode & Seeded Workspace
          </h2>

          <p className="text-xs text-ink-muted leading-relaxed">
            Instantly populate your Todotak workspace with sample tasks, meetings, overdue alerts, and AI stats for demonstration.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                const { seedDemoData } = require("@/lib/demo-data");
                seedDemoData();
                setSavedSuccess(true);
                setTimeout(() => {
                  setSavedSuccess(false);
                  window.location.reload();
                }, 1000);
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-forest hover:bg-forest/90 text-white rounded-lg shadow-2xs transition-all"
            >
              <Sparkles className="h-4 w-4" />
              <span>Load Seeded Demo Data</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const { clearDemoData } = require("@/lib/demo-data");
                clearDemoData();
                setSavedSuccess(true);
                setTimeout(() => {
                  setSavedSuccess(false);
                  window.location.reload();
                }, 1000);
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-paper border border-paper-line hover:bg-paper-tint text-ink rounded-lg transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Clear Demo Data</span>
            </button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
