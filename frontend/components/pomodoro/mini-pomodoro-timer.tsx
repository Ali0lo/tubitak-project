"use client";

import { useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { usePomodoroStore } from "@/stores/pomodoro-store";
import { cn } from "@/lib/utils";
import { PixelTomato, PixelCoffeeCup, PixelSparkle } from "@/components/ui/pixel-art";

export function MiniPomodoroTimer() {
  const {
    timeLeft,
    isRunning,
    mode,
    completedPomodoros,
    tick,
    startTimer,
    pauseTimer,
    setIsModalOpen,
  } = usePomodoroStore();

  // Active timer interval tick effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        tick();
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, tick]);

  const formatMinutesSeconds = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getModeColor = () => {
    switch (mode) {
      case "work":
        return "bg-forest-tint/30 text-forest border-forest/30 dark:bg-forest/20 dark:text-forest-light";
      case "shortBreak":
        return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300";
      case "longBreak":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300";
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={cn(
          "focus-ring flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono font-medium border transition-all duration-200 shadow-sm hover:shadow",
          getModeColor()
        )}
        title="Open Pomodoro Focus Timer"
      >
        {mode === "work" ? (
          <PixelTomato size={16} />
        ) : (
          <PixelCoffeeCup size={16} />
        )}
        <span className="font-bold">{formatMinutesSeconds(timeLeft)}</span>
        <span className="hidden sm:inline-mono text-[10px] opacity-75 uppercase">
          {mode === "work" ? "Focus" : "Break"}
        </span>
        {completedPomodoros > 0 ? (
          <span className="flex items-center gap-0.5 text-[11px] font-semibold text-amber font-sans">
            <PixelSparkle size={12} />
            {completedPomodoros}
          </span>
        ) : null}
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (isRunning) {
            pauseTimer();
          } else {
            startTimer();
          }
        }}
        className="focus-ring p-1.5 rounded-full border border-paper-line bg-paper hover:bg-paper-tint text-ink transition-colors"
        title={isRunning ? "Pause Timer" : "Start Timer"}
      >
        {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current text-forest" />}
      </button>
    </div>
  );
}
