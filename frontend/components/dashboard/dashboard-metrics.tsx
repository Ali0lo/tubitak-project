"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ListTodo,
  Repeat,
  Sparkles,
  Timer,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Meeting, Task } from "@/types";
import { usePomodoroStore } from "@/stores/pomodoro-store";

interface DashboardMetricsProps {
  tasks: Task[];
  meetings: Meeting[];
}

function AnimatedCounter({ value, duration = 800 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = 0;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * (value - startValue) + startValue));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [value, duration]);

  return <span>{count}</span>;
}

export function DashboardMetrics({ tasks, meetings }: DashboardMetricsProps) {
  const today = new Date();
  const pomodoroStore = usePomodoroStore();

  // Metrics calculations
  const todayTasks = tasks.filter(
    (t) =>
      t.is_due_today ||
      (t.due_date && new Date(t.due_date).toDateString() === today.toDateString())
  );
  const todayCompleted = todayTasks.filter((t) => t.status === "completed").length;
  const todayTotal = todayTasks.length;
  const todayProgressPercent = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 100;

  const totalCompleted = tasks.filter((t) => t.status === "completed").length;
  const totalRemaining = tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length;
  const overdueTasksCount = tasks.filter((t) => t.is_overdue).length;

  const upcomingMeetingsCount = meetings.filter(
    (m) => m.status === "scheduled" && new Date(m.start_time) > today
  ).length;

  const recurringTasksCount = tasks.filter((t) => t.is_recurring).length;
  const missedTasksCount = tasks.filter(
    (t) => t.is_overdue && t.status !== "completed" && t.status !== "cancelled"
  ).length;

  const focusMinutes = (pomodoroStore.completedPomodoros || 0) * (pomodoroStore.settings?.workDuration || 25);

  // Weekly progress calculation
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  const weeklyCompleted = tasks.filter(
    (t) => t.completed_at && new Date(t.completed_at) >= sevenDaysAgo
  ).length;

  const cards = [
    {
      title: "Today's Progress",
      value: todayProgressPercent,
      unit: "%",
      subtitle: `${todayCompleted} of ${todayTotal} completed`,
      icon: CheckCircle2,
      color: "text-forest bg-forest/10 border-forest/20",
      progress: todayProgressPercent,
    },
    {
      title: "Weekly Progress",
      value: weeklyCompleted,
      unit: "done",
      subtitle: "Completed in last 7 days",
      icon: TrendingUp,
      color: "text-sky-600 bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800",
    },
    {
      title: "Tasks Completed",
      value: totalCompleted,
      unit: "tasks",
      subtitle: "All-time completed",
      icon: Sparkles,
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
    },
    {
      title: "Tasks Remaining",
      value: totalRemaining,
      unit: "left",
      subtitle: "Pending & In-Progress",
      icon: ListTodo,
      color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    },
    {
      title: "Overdue Tasks",
      value: overdueTasksCount,
      unit: "overdue",
      subtitle: "Action required",
      icon: AlertCircle,
      color: "text-brick bg-brick-tint border-brick/30",
    },
    {
      title: "Upcoming Meetings",
      value: upcomingMeetingsCount,
      unit: "scheduled",
      subtitle: "Next syncs & calls",
      icon: Calendar,
      color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800",
    },
    {
      title: "Focus Time",
      value: focusMinutes,
      unit: "mins",
      subtitle: `${pomodoroStore.completedPomodoros || 0} pomodoro sessions`,
      icon: Timer,
      color: "text-rose-600 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800",
    },
    {
      title: "Recurring Tasks",
      value: recurringTasksCount,
      unit: "active",
      subtitle: "Automated routines",
      icon: Repeat,
      color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800",
    },
    {
      title: "Missed Tasks",
      value: missedTasksCount,
      unit: "missed",
      subtitle: "Passed due date",
      icon: XCircle,
      color: "text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className={cn(
              "group relative overflow-hidden rounded-xl border p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-paper",
              card.color
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {card.title}
                </p>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-bold text-ink">
                    <AnimatedCounter value={card.value} />
                  </span>
                  <span className="text-xs font-medium text-ink-muted">{card.unit}</span>
                </div>
                <p className="mt-1 text-xs text-ink-faint">{card.subtitle}</p>
              </div>

              <div className="rounded-lg p-2.5 bg-paper/80 shadow-xs border border-paper-line">
                <Icon className="h-5 w-5" />
              </div>
            </div>

            {card.progress !== undefined && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-paper-line">
                <div
                  className="h-full bg-forest transition-all duration-500"
                  style={{ width: `${card.progress}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
