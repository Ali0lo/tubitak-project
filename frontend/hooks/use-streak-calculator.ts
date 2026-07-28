"use client";

import { useMemo } from "react";
import { Task } from "@/types/task";
import { subDays, format, isSameDay } from "date-fns";

export function useStreakCalculator(tasks: Task[]) {
  return useMemo(() => {
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

    if (!completedToday) {
      checkDate = subDays(checkDate, 1);
    }

    while (completedDates.has(format(checkDate, "yyyy-MM-dd"))) {
      streak++;
      checkDate = subDays(checkDate, 1);
    }

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
}
