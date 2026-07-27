"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Bell, CheckCircle2, Coffee, Play, Volume2, X } from "lucide-react";
import { usePomodoroStore } from "@/stores/pomodoro-store";
import { pomodoroAudio } from "@/lib/pomodoro-sound";

export function PomodoroAlarmBanner() {
  const { alarmBanner, closeAlarmBanner, startTimer, settings, mode } = usePomodoroStore();

  const { isOpen, completedMode, taskTitle } = alarmBanner;

  useEffect(() => {
    if (isOpen && completedMode === "work") {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // Fallback if confetti fails
      }
    }
  }, [isOpen, completedMode]);

  if (!isOpen) return null;

  const isWorkCompleted = completedMode === "work";

  const handleStartNext = () => {
    closeAlarmBanner();
    startTimer();
  };

  const handleReplayAlarm = () => {
    if (isWorkCompleted) {
      pomodoroAudio.playAlarmSound(settings.soundVolume);
    } else {
      pomodoroAudio.playBreakSound(settings.soundVolume);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-paper border border-paper-line rounded-2xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-ink">
        <button
          type="button"
          onClick={closeAlarmBanner}
          className="absolute top-4 right-4 p-1.5 rounded-full text-ink-muted hover:text-ink hover:bg-paper-tint transition-colors"
          title="Close alert"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center space-y-3">
          <div
            className={`p-4 rounded-full shadow-inner ${
              isWorkCompleted
                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 ring-8 ring-emerald-50 dark:ring-emerald-900/30"
                : "bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-300 ring-8 ring-sky-50 dark:ring-sky-900/30"
            }`}
          >
            {isWorkCompleted ? (
              <CheckCircle2 className="h-10 w-10 animate-bounce" />
            ) : (
              <Coffee className="h-10 w-10 animate-pulse" />
            )}
          </div>

          <div className="space-y-1">
            <span className="text-xs font-mono uppercase tracking-wider text-forest font-semibold">
              🔔 Timer Alarm Triggered
            </span>
            <h3 className="font-display text-2xl font-bold text-ink">
              {isWorkCompleted ? "Focus Session Completed!" : "Break Completed!"}
            </h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              {isWorkCompleted ? (
                taskTitle ? (
                  <>
                    Outstanding job on <strong className="text-ink">{taskTitle}</strong>! Time to step back and refresh.
                  </>
                ) : (
                  "Fantastic focus session! Time to take a well-deserved break."
                )
              ) : (
                "Your break time is up! Ready to step back into the flow?"
              )}
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handleStartNext}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-forest hover:bg-forest-dark text-paper font-semibold text-sm shadow-md hover:shadow-lg transition-all"
          >
            <Play className="h-4 w-4 fill-current" />
            {mode === "work" ? "Start Focus Session" : "Start Break Now"}
          </button>

          <button
            type="button"
            onClick={handleReplayAlarm}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-paper-line bg-paper hover:bg-paper-tint text-ink font-medium text-sm transition-colors shrink-0"
            title="Replay Alarm Sound"
          >
            <Volume2 className="h-4 w-4 text-forest" />
            Alarm Sound
          </button>
        </div>
      </div>
    </div>
  );
}
