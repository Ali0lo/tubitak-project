"use client";

import React, { useMemo } from "react";
import { format, subDays, isSameDay } from "date-fns";
import { Task } from "@/types/task";
import { Meeting } from "@/types/meeting";
import { Card } from "@/components/ui/card";
import { Award, Flame, Calendar, CheckCircle2, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";

interface AIWeeklyReviewReportProps {
  tasks: Task[];
  meetings: Meeting[];
  streakDays?: number;
  focusMinutes?: number;
}

export function AIWeeklyReviewReport({ tasks, meetings, streakDays = 0, focusMinutes = 0 }: AIWeeklyReviewReportProps) {
  const today = useMemo(() => new Date(), []);
  const sevenDaysAgo = useMemo(() => subDays(today, 7), [today]);

  const weeklyStats = useMemo(() => {
    const completedWeek = tasks.filter(
      (t) => t.status === "completed" && t.completed_at && new Date(t.completed_at) >= sevenDaysAgo
    );
    const meetingsWeek = meetings.filter(
      (m) => (m.status === "completed" || new Date(m.end_time) < today) && new Date(m.start_time) >= sevenDaysAgo
    );
    const recurringCompleted = completedWeek.filter((t) => t.is_recurring).length;
    const overdueCount = tasks.filter((t) => t.is_overdue).length;

    // Day completion map
    const dayCounts: Record<string, number> = {};
    completedWeek.forEach((t) => {
      const dayName = format(new Date(t.completed_at!), "EEEE");
      dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
    });

    const sortedDays = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);
    const topDay = sortedDays[0] ? `${sortedDays[0][0]} (${sortedDays[0][1]} tasks)` : "N/A";
    const lastEntry = sortedDays[sortedDays.length - 1];
    const leastDay = sortedDays.length > 1 && lastEntry ? `${lastEntry[0]}` : "N/A";

    return {
      completedCount: completedWeek.length,
      meetingsCount: meetingsWeek.length,
      recurringCompleted,
      overdueCount,
      topDay,
      leastDay,
    };
  }, [tasks, meetings, today, sevenDaysAgo]);

  return (
    <Card className="p-5 space-y-4 bg-gradient-to-br from-paper via-paper to-paper-tint border-paper-line shadow-sm">
      <div className="flex items-center justify-between border-b border-paper-line pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-300 rounded-lg">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-ink">Weekly Productivity Summary Report</h3>
            <p className="text-xs text-ink-muted">AI synthesis of the past 7 execution days</p>
          </div>
        </div>
        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
          Last 7 Days
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-paper rounded-lg border border-paper-line space-y-1">
          <p className="text-ink-muted">Completed Tasks</p>
          <p className="text-lg font-bold text-forest">{weeklyStats.completedCount}</p>
        </div>
        <div className="p-3 bg-paper rounded-lg border border-paper-line space-y-1">
          <p className="text-ink-muted">Meetings Attended</p>
          <p className="text-lg font-bold text-sky-600">{weeklyStats.meetingsCount}</p>
        </div>
        <div className="p-3 bg-paper rounded-lg border border-paper-line space-y-1">
          <p className="text-ink-muted">Active Streak</p>
          <p className="text-lg font-bold text-amber-600">{streakDays} Days 🔥</p>
        </div>
        <div className="p-3 bg-paper rounded-lg border border-paper-line space-y-1">
          <p className="text-ink-muted">Recurring Routines</p>
          <p className="text-lg font-bold text-indigo-600">{weeklyStats.recurringCompleted} Done</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
        <div className="p-3 bg-paper rounded-lg border border-paper-line space-y-1">
          <span className="text-ink-muted font-medium">Most Productive Day:</span>
          <span className="font-bold text-ink ml-2">{weeklyStats.topDay}</span>
        </div>
        <div className="p-3 bg-paper rounded-lg border border-paper-line space-y-1">
          <span className="text-ink-muted font-medium">Biggest Achievement:</span>
          <span className="font-bold text-emerald-600 ml-2">Maintained high focus momentum!</span>
        </div>
      </div>
    </Card>
  );
}
