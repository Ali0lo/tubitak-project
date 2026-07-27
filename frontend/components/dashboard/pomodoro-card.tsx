"use client";

import { Flame, Play, Pause, RotateCcw, Timer, Sparkles, CheckSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { usePomodoroStore } from "@/stores/pomodoro-store";
import { cn } from "@/lib/utils";

export function PomodoroDashboardCard() {
  const {
    mode,
    timeLeft,
    isRunning,
    completedPomodoros,
    activeTaskTitle,
    startTimer,
    pauseTimer,
    resetTimer,
    setIsModalOpen,
  } = usePomodoroStore();

  const formatMinutesSeconds = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="p-5 space-y-4 bg-gradient-to-br from-paper via-paper to-forest-tint/10 dark:to-forest/10 border-forest/20 shadow-sm relative overflow-hidden">
      <div className="flex items-center justify-between border-b border-paper-line pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-forest/10 text-forest dark:bg-forest/20 dark:text-forest-light">
            <Timer className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-ink">Pomodoro Focus Timer</h3>
            <p className="text-xs text-ink-muted">Stay in deep work mode</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="text-xs font-semibold text-forest hover:underline flex items-center gap-1"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Expand Panel
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Timer Display */}
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center">
            <span className="font-mono text-3xl font-extrabold text-ink tracking-tight">
              {formatMinutesSeconds(timeLeft)}
            </span>
          </div>

          <div className="space-y-1">
            <span
              className={cn(
                "inline-block text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full",
                mode === "work"
                  ? "bg-forest-tint/30 text-forest dark:bg-forest/20 dark:text-forest-light"
                  : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
              )}
            >
              {mode === "work" ? "Focus Mode" : "Break Mode"}
            </span>

            {activeTaskTitle ? (
              <p className="text-xs font-medium text-ink flex items-center gap-1 line-clamp-1">
                <CheckSquare className="h-3 w-3 text-forest shrink-0" />
                <span>{activeTaskTitle}</span>
              </p>
            ) : (
              <p className="text-xs text-ink-muted italic">No task attached</p>
            )}
          </div>
        </div>

        {/* Quick Actions & Streak */}
        <div className="flex items-center gap-2">
          {completedPomodoros > 0 ? (
            <div
              className="flex items-center gap-1 text-xs font-bold text-amber bg-amber-tint/40 px-2.5 py-1.5 rounded-lg border border-amber/20"
              title={`${completedPomodoros} focus sessions completed today`}
            >
              <Flame className="h-4 w-4 fill-current text-amber" />
              <span>{completedPomodoros}</span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={resetTimer}
            className="p-2 rounded-lg border border-paper-line bg-paper hover:bg-paper-tint text-ink-muted hover:text-ink transition-colors"
            title="Reset Timer"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={isRunning ? pauseTimer : startTimer}
            className={cn(
              "py-2 px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 text-paper transition-all shadow",
              mode === "work"
                ? "bg-forest hover:bg-forest-dark"
                : "bg-sky-600 hover:bg-sky-700"
            )}
          >
            {isRunning ? (
              <>
                <Pause className="h-3.5 w-3.5 fill-current" /> Pause
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" /> Start
              </>
            )}
          </button>
        </div>
      </div>
    </Card>
  );
}
