"use client";

import { useMemo } from "react";
import { Flame, Trophy, Target, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Task } from "@/types/task";
import { isSameDay, subDays, format } from "date-fns";

interface StreakCardProps {
  tasks: Task[];
}

export function StreakCard({ tasks }: StreakCardProps) {
  // Calculate completion streak dynamically based on task completed_at dates
  const streakStats = useMemo(() => {
    const completedTasks = tasks.filter(
      (t) => t.status === "completed" && t.completed_at
    );

    const completedDates = new Set(
      completedTasks.map((t) =>
        format(new Date(t.completed_at!), "yyyy-MM-dd")
      )
    );

    const todayStr = format(new Date(), "yyyy-MM-dd");
    const completedToday = completedDates.has(todayStr);

    let streak = 0;
    let checkDate = new Date();

    // If no tasks completed today, check starting from yesterday for continuous streak
    if (!completedToday) {
      checkDate = subDays(checkDate, 1);
    }

    while (completedDates.has(format(checkDate, "yyyy-MM-dd"))) {
      streak++;
      checkDate = subDays(checkDate, 1);
    }

    // Calculate true historical best streak from all completion dates
    const sortedDates = Array.from(completedDates).sort();
    let maxStreak = 0;
    let tempStreak = 0;
    let prevDateStr: string | null = null;

    for (const dateStr of sortedDates) {
      if (prevDateStr) {
        const prev = new Date(prevDateStr);
        const curr = new Date(dateStr);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      } else {
        tempStreak = 1;
      }
      maxStreak = Math.max(maxStreak, tempStreak);
      prevDateStr = dateStr;
    }

    const bestStreak = Math.max(streak, maxStreak);

    // Today's completion ratio (goal: 3 tasks/day)
    const tasksDoneToday = tasks.filter(
      (t) =>
        t.status === "completed" &&
        t.completed_at &&
        isSameDay(new Date(t.completed_at), new Date())
    ).length;

    const dailyTarget = 3;
    const dailyProgress = Math.min(100, Math.round((tasksDoneToday / dailyTarget) * 100));

    return {
      currentStreak: streak,
      bestStreak,
      tasksDoneToday,
      dailyTarget,
      dailyProgress,
      completedToday,
    };
  }, [tasks]);

  return (
    <Card className="p-4 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border-amber-500/20 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl text-white shadow-md shadow-amber-500/20 flex items-center justify-center">
            <Flame className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400 font-bold">
                Daily Completion Streak
              </span>
              {streakStats.completedToday && (
                <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold rounded-full border border-amber-500/30">
                  Active
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-950 dark:text-amber-100 font-display">
                {streakStats.currentStreak} {streakStats.currentStreak === 1 ? "Day" : "Days"}
              </span>
              <span className="text-xs text-amber-700/80 dark:text-amber-400/80 flex items-center gap-1 font-mono">
                <Trophy className="h-3 w-3 text-amber-500" /> Best: {streakStats.bestStreak}d
              </span>
            </div>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end gap-1 text-right">
          <div className="flex items-center gap-1 text-xs font-medium text-amber-900 dark:text-amber-200">
            <Target className="h-3.5 w-3.5 text-orange-500" />
            Today&apos;s Target: {streakStats.tasksDoneToday}/{streakStats.dailyTarget}
          </div>
          <div className="w-28 bg-amber-200/60 dark:bg-amber-950/60 h-2 rounded-full overflow-hidden border border-amber-300/40">
            <div
              className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-500 rounded-full"
              style={{ width: `${streakStats.dailyProgress}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
