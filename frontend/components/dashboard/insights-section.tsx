"use client";

import React, { useMemo } from "react";
import { Task } from "@/types/task";
import { Meeting } from "@/types/meeting";
import { usePomodoroStore } from "@/stores/pomodoro-store";
import { GitHubHeatmap } from "@/components/dashboard/github-heatmap";
import { ProductivityCharts } from "@/components/dashboard/productivity-charts";
import { WorkloadIndicator } from "@/components/dashboard/workload-indicator";
import { SmartInsightsCards } from "@/components/dashboard/smart-insights-cards";
import { AchievementsCard } from "@/components/dashboard/achievements-card";
import { Card } from "@/components/ui/card";
import { CheckCircle2, TrendingUp, Calendar, AlertCircle, Clock, Timer, Flame, Award, BarChart3 } from "lucide-react";
import { isSameDay, subDays, subMonths } from "date-fns";

interface InsightsSectionProps {
  tasks: Task[];
  meetings: Meeting[];
  currentStreak?: number;
  longestStreak?: number;
}

function AnimatedStat({ value, suffix = "" }: { value: number | string; suffix?: string }) {
  return (
    <span className="font-display text-2xl font-bold text-ink transition-all">
      {value}
      {suffix}
    </span>
  );
}

export function InsightsSection({ tasks, meetings, currentStreak = 0, longestStreak = 0 }: InsightsSectionProps) {
  const today = useMemo(() => new Date(), []);
  const pomodoroStore = usePomodoroStore();

  // Metric 1: Tasks completed today
  const completedTodayCount = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status === "completed" &&
          t.completed_at &&
          isSameDay(new Date(t.completed_at), today)
      ).length,
    [tasks, today]
  );

  // Metric 2: Tasks completed this week (last 7 days)
  const sevenDaysAgo = useMemo(() => subDays(today, 7), [today]);
  const completedWeekCount = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status === "completed" &&
          t.completed_at &&
          new Date(t.completed_at) >= sevenDaysAgo
      ).length,
    [tasks, sevenDaysAgo]
  );

  // Metric 3: Tasks completed this month (last 30 days)
  const thirtyDaysAgo = useMemo(() => subDays(today, 30), [today]);
  const completedMonthCount = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status === "completed" &&
          t.completed_at &&
          new Date(t.completed_at) >= thirtyDaysAgo
      ).length,
    [tasks, thirtyDaysAgo]
  );

  // Metric 4: Average completion time (hours)
  const avgCompletionTimeHours = useMemo(() => {
    const completedWithDates = tasks.filter((t) => t.status === "completed" && t.completed_at && t.created_at);
    if (completedWithDates.length === 0) return 0;

    const totalDiffMs = completedWithDates.reduce((acc, t) => {
      const start = new Date(t.created_at).getTime();
      const end = new Date(t.completed_at!).getTime();
      return acc + Math.max(0, end - start);
    }, 0);

    const avgMs = totalDiffMs / completedWithDates.length;
    return Math.round((avgMs / (1000 * 60 * 60)) * 10) / 10;
  }, [tasks]);

  // Metric 5: Completion rate (%)
  const totalTasks = tasks.length || 1;
  const totalCompleted = tasks.filter((t) => t.status === "completed").length;
  const completionRate = Math.round((totalCompleted / totalTasks) * 100);

  // Metric 6: Overdue rate (%)
  const totalOverdue = tasks.filter((t) => t.is_overdue && t.status !== "completed").length;
  const overdueRate = Math.round((totalOverdue / totalTasks) * 100);

  // Metric 7: Meetings attended
  const meetingsAttendedCount = useMemo(
    () =>
      meetings.filter(
        (m) => m.status === "completed" || new Date(m.end_time) < today
      ).length,
    [meetings, today]
  );

  // Metric 8: Focus sessions completed
  const focusSessions = pomodoroStore.completedPomodoros || 0;

  const statCards = [
    { title: "Completed Today", value: completedTodayCount, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" },
    { title: "Completed This Week", value: completedWeekCount, icon: TrendingUp, color: "text-sky-600 bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800" },
    { title: "Completed This Month", value: completedMonthCount, icon: Calendar, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800" },
    { title: "Avg Completion Time", value: `${avgCompletionTimeHours}h`, icon: Clock, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800" },
    { title: "Completion Rate", value: `${completionRate}%`, icon: Award, color: "text-forest bg-forest/10 border-forest/20" },
    { title: "Overdue Rate", value: `${overdueRate}%`, icon: AlertCircle, color: "text-brick bg-brick-tint border-brick/30" },
    { title: "Meetings Attended", value: meetingsAttendedCount, icon: Calendar, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" },
    { title: "Focus Sessions", value: focusSessions, icon: Timer, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800" },
    { title: "Streak (Current / Max)", value: `${currentStreak}d / ${longestStreak}d`, icon: Flame, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" },
  ];

  return (
    <div className="space-y-6">
      {/* 9 Animate Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className={`p-4 rounded-xl border ${card.color} shadow-2xs space-y-2 transition-transform duration-200 hover:-translate-y-0.5`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {card.title}
                </span>
                <div className="p-2 rounded-lg bg-paper/80 shadow-xs border border-paper-line">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <AnimatedStat value={card.value} />
            </div>
          );
        })}
      </div>

      {/* Workload Indicator */}
      <WorkloadIndicator tasks={tasks} meetings={meetings} />

      {/* GitHub Heatmap */}
      <GitHubHeatmap tasks={tasks} meetings={meetings} />

      {/* Productivity Trends & Charts */}
      <ProductivityCharts tasks={tasks} meetings={meetings} />

      {/* Smart Workspace Insights */}
      <SmartInsightsCards tasks={tasks} meetings={meetings} />

      {/* Achievements System */}
      <AchievementsCard tasks={tasks} meetings={meetings} currentStreak={currentStreak} />
    </div>
  );
}
