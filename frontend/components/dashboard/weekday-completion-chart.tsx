"use client";

import { useMemo, useState } from "react";
import { BarChart3, Trophy, Calendar, Sparkles, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Task } from "@/types/task";
import { subDays, getDay, isAfter, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface WeekdayCompletionChartProps {
  tasks: Task[];
}

export type TimeRange = "all" | "30days" | "7days";

export interface WeekdayStat {
  dayName: string;
  shortName: string;
  dayIndex: number; // 0=Mon, 1=Tue, ..., 6=Sun
  count: number;
  percentage: number;
  isToday: boolean;
}

export interface WeekdayStatsResult {
  stats: WeekdayStat[];
  totalCount: number;
  maxCount: number;
  peakDay: WeekdayStat | null;
}

const WEEKDAYS = [
  { dayIndex: 0, dayName: "Monday", shortName: "Mon", jsDay: 1 },
  { dayIndex: 1, dayName: "Tuesday", shortName: "Tue", jsDay: 2 },
  { dayIndex: 2, dayName: "Wednesday", shortName: "Wed", jsDay: 3 },
  { dayIndex: 3, dayName: "Thursday", shortName: "Thu", jsDay: 4 },
  { dayIndex: 4, dayName: "Friday", shortName: "Fri", jsDay: 5 },
  { dayIndex: 5, dayName: "Saturday", shortName: "Sat", jsDay: 6 },
  { dayIndex: 6, dayName: "Sunday", shortName: "Sun", jsDay: 0 },
];

export function computeWeekdayStats(
  tasks: Task[],
  timeRange: TimeRange,
  today: Date = new Date()
): WeekdayStatsResult {
  const completedTasks = tasks.filter((t) => t.status === "completed" && t.completed_at);

  let filteredTasks = completedTasks;
  const startOfToday = startOfDay(today);

  if (timeRange === "7days") {
    const cutoff = subDays(startOfToday, 6);
    filteredTasks = completedTasks.filter((t) => isAfter(new Date(t.completed_at!), cutoff));
  } else if (timeRange === "30days") {
    const cutoff = subDays(startOfToday, 29);
    filteredTasks = completedTasks.filter((t) => isAfter(new Date(t.completed_at!), cutoff));
  }

  // Count by JS getDay() (0=Sun, 1=Mon, ..., 6=Sat)
  const countsByJsDay: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  filteredTasks.forEach((t) => {
    const jsDay = getDay(new Date(t.completed_at!));
    countsByJsDay[jsDay] = (countsByJsDay[jsDay] || 0) + 1;
  });

  const totalCount = filteredTasks.length;
  const currentJsDay = getDay(today);

  const stats: WeekdayStat[] = WEEKDAYS.map((w) => {
    const count = countsByJsDay[w.jsDay] || 0;
    const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
    return {
      dayName: w.dayName,
      shortName: w.shortName,
      dayIndex: w.dayIndex,
      count,
      percentage,
      isToday: w.jsDay === currentJsDay,
    };
  });

  let maxCount = 0;
  let peakDay: WeekdayStat | null = null;

  stats.forEach((s) => {
    if (s.count > maxCount) {
      maxCount = s.count;
      peakDay = s;
    }
  });

  return {
    stats,
    totalCount,
    maxCount,
    peakDay: maxCount > 0 ? peakDay : null,
  };
}

export function WeekdayCompletionChart({ tasks }: WeekdayCompletionChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("all");

  const { stats, totalCount, maxCount, peakDay } = useMemo(
    () => computeWeekdayStats(tasks, timeRange),
    [tasks, timeRange]
  );

  return (
    <Card className="p-5 space-y-5 bg-paper border-paper-line shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-paper-line pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-forest/10 text-forest dark:bg-forest/20 dark:text-forest-light">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-ink">Weekday Productivity</h3>
            <p className="text-xs text-ink-muted">See which days you complete the most tasks</p>
          </div>
        </div>

        {/* Time Filter Tabs */}
        <div className="flex items-center bg-paper-line/30 p-1 rounded-lg text-xs font-medium self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTimeRange("all")}
            className={cn(
              "px-2.5 py-1 rounded-md transition-colors",
              timeRange === "all"
                ? "bg-paper text-ink shadow-sm font-semibold"
                : "text-ink-muted hover:text-ink"
            )}
          >
            All Time
          </button>
          <button
            type="button"
            onClick={() => setTimeRange("30days")}
            className={cn(
              "px-2.5 py-1 rounded-md transition-colors",
              timeRange === "30days"
                ? "bg-paper text-ink shadow-sm font-semibold"
                : "text-ink-muted hover:text-ink"
            )}
          >
            Past 30 Days
          </button>
          <button
            type="button"
            onClick={() => setTimeRange("7days")}
            className={cn(
              "px-2.5 py-1 rounded-md transition-colors",
              timeRange === "7days"
                ? "bg-paper text-ink shadow-sm font-semibold"
                : "text-ink-muted hover:text-ink"
            )}
          >
            Past 7 Days
          </button>
        </div>
      </div>

      {/* Peak Day Banner */}
      {peakDay ? (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs">
          <div className="p-2 rounded-lg bg-emerald-500 text-white shadow-sm shrink-0">
            <Trophy className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-emerald-950 dark:text-emerald-200">
              Peak Day: <strong className="font-bold text-emerald-700 dark:text-emerald-400">{peakDay.dayName}s</strong>
            </p>
            <p className="text-emerald-800/80 dark:text-emerald-300/80 text-[11px] truncate">
              You completed <strong>{peakDay.count}</strong> {peakDay.count === 1 ? "task" : "tasks"} ({peakDay.percentage}% of total) on {peakDay.dayName}s.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-200/60 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full shrink-0">
            <TrendingUp className="h-3 w-3" /> Top Day
          </span>
        </div>
      ) : null}

      {/* Bar Chart Visualization */}
      {totalCount === 0 ? (
        <div className="py-8 text-center text-xs text-ink-muted space-y-1 italic">
          <Calendar className="h-8 w-8 mx-auto text-ink-faint mb-2" />
          <p>No completed tasks found for this period.</p>
          <p className="text-[11px] text-ink-faint">Complete tasks to see your weekday breakdown graph.</p>
        </div>
      ) : (
        <div className="pt-2 space-y-2">
          {/* Bars Grid */}
          <div className="h-44 flex items-end justify-between gap-2 px-1 border-b border-paper-line pb-2">
            {stats.map((item) => {
              const isPeak = peakDay?.dayIndex === item.dayIndex && item.count > 0;
              const heightPercent = maxCount > 0 ? Math.max(8, Math.round((item.count / maxCount) * 100)) : 0;

              return (
                <div key={item.shortName} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                  {/* Tooltip on Hover */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-ink text-paper text-[10px] font-mono py-1 px-2 rounded-md shadow-md pointer-events-none z-10 whitespace-nowrap">
                    {item.dayName}: {item.count} {item.count === 1 ? "task" : "tasks"} ({item.percentage}%)
                  </div>

                  {/* Count Badge above bar */}
                  <span className="text-[11px] font-mono font-bold text-ink-muted mb-1 group-hover:text-forest transition-colors">
                    {item.count > 0 ? item.count : ""}
                  </span>

                  {/* Bar element */}
                  <div className="w-full max-w-[36px] bg-paper-tint/60 rounded-t-lg relative flex items-end overflow-hidden h-full">
                    <div
                      className={cn(
                        "w-full transition-all duration-500 rounded-t-lg",
                        isPeak
                          ? "bg-gradient-to-t from-emerald-600 to-forest shadow-md"
                          : item.count > 0
                          ? "bg-gradient-to-t from-forest-dark/80 to-forest/80 dark:from-forest-light/60 dark:to-forest/60"
                          : "bg-paper-line/30"
                      )}
                      style={{ height: `${item.count > 0 ? heightPercent : 4}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* X-Axis Labels */}
          <div className="flex items-center justify-between gap-2 px-1">
            {stats.map((item) => {
              const isPeak = peakDay?.dayIndex === item.dayIndex && item.count > 0;

              return (
                <div key={item.shortName} className="flex-1 text-center">
                  <span
                    className={cn(
                      "text-xs font-mono font-medium block",
                      isPeak
                        ? "text-forest dark:text-forest-light font-bold"
                        : item.isToday
                        ? "text-ink font-bold underline underline-offset-4"
                        : "text-ink-muted"
                    )}
                  >
                    {item.shortName}
                  </span>
                  {item.isToday ? (
                    <span className="text-[9px] font-mono text-forest uppercase block font-semibold">Today</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
