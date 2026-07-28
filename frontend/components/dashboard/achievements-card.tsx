"use client";

import React, { useEffect } from "react";
import { useAchievementsStore } from "@/stores/use-achievements-store";
import { Card } from "@/components/ui/card";
import { Trophy, Sparkles, Flame, Sun, Moon, Video, Timer, Repeat, Lock } from "lucide-react";
import { Task } from "@/types/task";
import { Meeting } from "@/types/meeting";
import { usePomodoroStore } from "@/stores/pomodoro-store";

const ICON_MAP: Record<string, any> = {
  Sparkles,
  Trophy,
  Flame,
  Sun,
  Moon,
  Video,
  Timer,
  Repeat,
};

interface AchievementsCardProps {
  tasks: Task[];
  meetings: Meeting[];
  currentStreak?: number;
}

export function AchievementsCard({ tasks, meetings, currentStreak = 0 }: AchievementsCardProps) {
  const { achievements, checkAndUnlock } = useAchievementsStore();
  const pomodoroStore = usePomodoroStore();

  useEffect(() => {
    const completedTasks = tasks.filter((t) => t.status === "completed");
    const completedAtHours = completedTasks
      .map((t) => t.completed_at ? new Date(t.completed_at).getHours() : null)
      .filter((h): h is number => h !== null);

    const recurringCompleted = completedTasks.filter((t) => t.is_recurring).length;
    const meetingsAttended = meetings.filter((m) => m.status === "completed" || new Date(m.end_time) < new Date()).length;
    const focusSessions = pomodoroStore.completedPomodoros || 0;

    checkAndUnlock({
      totalCompleted: completedTasks.length,
      currentStreak,
      completedAtHours,
      meetingsAttended,
      focusSessionsCompleted: focusSessions,
      recurringCompleted,
    });
  }, [tasks, meetings, currentStreak, pomodoroStore.completedPomodoros, checkAndUnlock]);

  const achievementList = Object.values(achievements);
  const unlockedCount = achievementList.filter((a) => a.unlocked).length;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-paper-line pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <div>
            <h3 className="font-display text-base font-semibold text-ink">Productivity Achievements</h3>
            <p className="text-xs text-ink-muted">Unlock badges by reaching task & focus milestones</p>
          </div>
        </div>
        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          {unlockedCount} / {achievementList.length} Unlocked
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {achievementList.map((ach) => {
          const Icon = ICON_MAP[ach.iconName] || Trophy;
          return (
            <div
              key={ach.id}
              className={`relative p-3.5 rounded-xl border transition-all duration-200 ${
                ach.unlocked
                  ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 shadow-sm"
                  : "bg-paper-tint/50 border-paper-line opacity-75"
              }`}
            >
              <div className="flex items-start justify-between">
                <div
                  className={`p-2 rounded-lg ${
                    ach.unlocked
                      ? "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300"
                      : "bg-paper border border-paper-line text-ink-muted"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                {!ach.unlocked && <Lock className="h-4 w-4 text-ink-faint" />}
              </div>

              <div className="mt-2 space-y-1">
                <h4 className="font-display text-xs font-bold text-ink">{ach.title}</h4>
                <p className="text-[11px] text-ink-muted leading-tight">{ach.description}</p>
              </div>

              {/* Progress Bar */}
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-ink-muted">
                  <span>{ach.currentValue} / {ach.target}</span>
                  <span>{ach.progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-paper-line rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      ach.unlocked ? "bg-amber-500" : "bg-ink-muted"
                    }`}
                    style={{ width: `${ach.progress}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
