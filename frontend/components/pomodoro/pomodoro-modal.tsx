"use client";

import { useState } from "react";
import {
  Flame,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
  Settings,
  Coffee,
  CheckSquare,
  Sparkles,
  Music,
} from "lucide-react";
import { usePomodoroStore } from "@/stores/pomodoro-store";
import { pomodoroAudio } from "@/lib/pomodoro-sound";
import { useTasks } from "@/hooks/use-tasks";
import { Dialog } from "@/components/ui/dialog";

export function PomodoroModal() {
  const {
    mode,
    timeLeft,
    isRunning,
    completedPomodoros,
    activeTaskId,
    activeTaskTitle,
    settings,
    isModalOpen,
    setIsModalOpen,
    startTimer,
    pauseTimer,
    resetTimer,
    skipPhase,
    setMode,
    setActiveTask,
    updateSettings,
  } = usePomodoroStore();

  const { data: tasksData } = useTasks();
  const tasks = tasksData?.items ?? [];
  const pendingTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");

  const [activeTab, setActiveTab] = useState<"timer" | "settings">("timer");

  if (!isModalOpen) return null;

  const totalModeSeconds =
    mode === "work"
      ? settings.workDuration * 60
      : mode === "shortBreak"
      ? settings.shortBreakDuration * 60
      : settings.longBreakDuration * 60;

  const progressPercent = Math.max(0, Math.min(100, ((totalModeSeconds - timeLeft) / totalModeSeconds) * 100));

  const formatMinutesSeconds = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleTestSound = () => {
    pomodoroAudio.playTestSound(settings.soundVolume);
  };

  return (
    <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Pomodoro Focus Timer" className="max-w-lg">
      <div className="space-y-5">
        {/* Navigation / Tab Control */}
        <div className="flex items-center justify-between border-b border-paper-line pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-forest/10 text-forest dark:bg-forest/20 dark:text-forest-light">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-display font-semibold text-sm text-ink">
              {activeTab === "timer" ? "Focus Control" : "Preferences"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === "timer" ? "settings" : "timer")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === "settings"
                ? "bg-forest text-paper"
                : "bg-paper-tint text-ink-muted hover:text-ink hover:bg-paper-line/50"
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>{activeTab === "settings" ? "Back to Timer" : "Settings"}</span>
          </button>
        </div>

        {activeTab === "timer" ? (
          <div className="space-y-6">
            {/* Mode Selectors */}
            <div className="grid grid-cols-3 gap-2 bg-paper-line/30 p-1.5 rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => setMode("work")}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  mode === "work"
                    ? "bg-forest text-paper shadow font-semibold"
                    : "text-ink-muted hover:text-ink hover:bg-paper/50"
                }`}
              >
                <Flame className="h-3.5 w-3.5" />
                Focus ({settings.workDuration}m)
              </button>
              <button
                type="button"
                onClick={() => setMode("shortBreak")}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  mode === "shortBreak"
                    ? "bg-sky-600 text-white shadow font-semibold"
                    : "text-ink-muted hover:text-ink hover:bg-paper/50"
                }`}
              >
                <Coffee className="h-3.5 w-3.5" />
                Short ({settings.shortBreakDuration}m)
              </button>
              <button
                type="button"
                onClick={() => setMode("longBreak")}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  mode === "longBreak"
                    ? "bg-purple-600 text-white shadow font-semibold"
                    : "text-ink-muted hover:text-ink hover:bg-paper/50"
                }`}
              >
                <Coffee className="h-3.5 w-3.5" />
                Long ({settings.longBreakDuration}m)
              </button>
            </div>

            {/* Circular Progress Display */}
            <div className="relative flex flex-col items-center justify-center py-2">
              <div className="relative w-52 h-52 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    className="text-paper-line stroke-current"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    className={`stroke-current transition-all duration-300 ${
                      mode === "work" ? "text-forest" : mode === "shortBreak" ? "text-sky-500" : "text-purple-500"
                    }`}
                    strokeWidth="6"
                    strokeDasharray={263.89}
                    strokeDashoffset={263.89 - (263.89 * progressPercent) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-mono text-4xl font-extrabold tracking-tight text-ink">
                    {formatMinutesSeconds(timeLeft)}
                  </span>
                  <span className="mt-1 text-xs font-mono uppercase tracking-widest text-ink-muted font-medium">
                    {mode === "work" ? "Session Phase" : "Rest & Recharge"}
                  </span>
                  {completedPomodoros > 0 ? (
                    <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-amber bg-amber-tint/40 px-2.5 py-0.5 rounded-full">
                      <Flame className="h-3.5 w-3.5 fill-current" />
                      <span>{completedPomodoros} Sessions Completed</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Main Action Buttons */}
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={resetTimer}
                className="p-3 rounded-full border border-paper-line bg-paper hover:bg-paper-tint text-ink-muted hover:text-ink transition-colors shadow-sm"
                title="Reset Session"
              >
                <RotateCcw className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={isRunning ? pauseTimer : startTimer}
                className={`py-3 px-8 rounded-2xl font-bold text-base flex items-center gap-2 text-paper shadow-lg hover:shadow-xl transition-all transform active:scale-95 ${
                  mode === "work"
                    ? "bg-forest hover:bg-forest-dark"
                    : mode === "shortBreak"
                    ? "bg-sky-600 hover:bg-sky-700"
                    : "bg-purple-600 hover:bg-purple-700"
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="h-5 w-5 fill-current" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 fill-current" /> Start Focus
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={skipPhase}
                className="p-3 rounded-full border border-paper-line bg-paper hover:bg-paper-tint text-ink-muted hover:text-ink transition-colors shadow-sm"
                title="Skip to Next Phase"
              >
                <SkipForward className="h-5 w-5" />
              </button>
            </div>

            {/* Target Task Selector */}
            <div className="border-t border-paper-line pt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink flex items-center gap-1.5">
                  <CheckSquare className="h-3.5 w-3.5 text-forest" />
                  Target Focus Task:
                </span>
                {activeTaskId ? (
                  <button
                    type="button"
                    onClick={() => setActiveTask(null, null)}
                    className="text-brick hover:underline text-[11px]"
                  >
                    Clear Task
                  </button>
                ) : null}
              </div>

              <select
                value={activeTaskId || ""}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  if (!selectedId) {
                    setActiveTask(null, null);
                  } else {
                    const task = pendingTasks.find((t) => t.id === selectedId);
                    if (task) setActiveTask(task.id, task.title);
                  }
                }}
                className="w-full text-xs p-2.5 bg-paper border border-paper-line rounded-xl text-ink font-medium focus-ring"
              >
                <option value="">-- Select a Task to Focus On --</option>
                {pendingTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.priority === "urgent" ? "🔴 " : t.priority === "high" ? "🟠 " : ""}
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          /* Settings Tab */
          <div className="space-y-4 text-ink text-sm">
            {/* Custom Durations */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Focus (mins)</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={settings.workDuration}
                  onChange={(e) => updateSettings({ workDuration: Math.max(1, parseInt(e.target.value) || 25) })}
                  className="w-full p-2 bg-paper border border-paper-line rounded-lg text-sm text-center font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Short Break</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={settings.shortBreakDuration}
                  onChange={(e) => updateSettings({ shortBreakDuration: Math.max(1, parseInt(e.target.value) || 5) })}
                  className="w-full p-2 bg-paper border border-paper-line rounded-lg text-sm text-center font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Long Break</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={settings.longBreakDuration}
                  onChange={(e) => updateSettings({ longBreakDuration: Math.max(1, parseInt(e.target.value) || 15) })}
                  className="w-full p-2 bg-paper border border-paper-line rounded-lg text-sm text-center font-mono font-bold"
                />
              </div>
            </div>

            {/* Audio Settings */}
            <div className="border-t border-paper-line pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-medium text-ink text-xs flex items-center gap-1.5">
                    {settings.soundEnabled ? <Volume2 className="h-4 w-4 text-forest" /> : <VolumeX className="h-4 w-4 text-ink-muted" />}
                    End-of-Timer Alarm Sound
                  </span>
                  <p className="text-[11px] text-ink-muted">Play digital alarm chime when timer finishes</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
                  className="h-4 w-4 rounded accent-forest cursor-pointer"
                />
              </div>

              {settings.soundEnabled && (
                <div className="space-y-2 bg-paper-tint/50 p-3 rounded-xl border border-paper-line">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-muted">Alarm Volume:</span>
                    <span className="font-mono font-bold text-forest">
                      {Math.round(settings.soundVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.soundVolume}
                    onChange={(e) => updateSettings({ soundVolume: parseFloat(e.target.value) })}
                    className="w-full accent-forest cursor-pointer"
                  />

                  <button
                    type="button"
                    onClick={handleTestSound}
                    className="mt-2 w-full py-1.5 px-3 rounded-lg border border-paper-line bg-paper hover:bg-paper-tint text-xs font-semibold text-forest flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Music className="h-3.5 w-3.5" />
                    Test Alarm Sound
                  </button>
                </div>
              )}
            </div>

            {/* Auto Start Breaks */}
            <div className="border-t border-paper-line pt-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-medium text-ink text-xs">Auto-start Breaks</span>
                <p className="text-[11px] text-ink-muted">Automatically start break timer when focus ends</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoStartBreaks}
                onChange={(e) => updateSettings({ autoStartBreaks: e.target.checked })}
                className="h-4 w-4 rounded accent-forest cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
