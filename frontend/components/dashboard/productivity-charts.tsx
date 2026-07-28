"use client";

import React, { useMemo } from "react";
import { format, subDays, subMonths, isSameDay, isSameMonth } from "date-fns";
import { Task } from "@/types/task";
import { Meeting } from "@/types/meeting";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProductivityChartsProps {
  tasks: Task[];
  meetings: Meeting[];
}

export function ProductivityCharts({ tasks, meetings }: ProductivityChartsProps) {
  const today = useMemo(() => new Date(), []);

  // 1. Weekly completion trend (Last 7 days)
  const weeklyData = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => subDays(today, 6 - i));
    return days.map((d) => {
      const completedCount = tasks.filter(
        (t) =>
          t.status === "completed" &&
          t.completed_at &&
          isSameDay(new Date(t.completed_at), d)
      ).length;
      return {
        label: format(d, "EEE"),
        date: format(d, "MMM d"),
        count: completedCount,
      };
    });
  }, [tasks, today]);

  const maxWeeklyCount = useMemo(
    () => Math.max(1, ...weeklyData.map((d) => d.count)),
    [weeklyData]
  );

  // 2. Monthly completion trend (Last 6 months)
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, i) => subMonths(today, 5 - i));
    return months.map((m) => {
      const completedCount = tasks.filter(
        (t) =>
          t.status === "completed" &&
          t.completed_at &&
          isSameMonth(new Date(t.completed_at), m)
      ).length;
      return {
        label: format(m, "MMM"),
        count: completedCount,
      };
    });
  }, [tasks, today]);

  const maxMonthlyCount = useMemo(
    () => Math.max(1, ...monthlyData.map((m) => m.count)),
    [monthlyData]
  );

  // 3. Priority breakdown
  const priorityData = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, urgent: 0 };
    tasks.forEach((t) => {
      if (counts[t.priority] !== undefined) {
        counts[t.priority] += 1;
      }
    });
    const total = tasks.length || 1;
    return [
      { priority: "Urgent", count: counts.urgent, color: "bg-red-500", percent: Math.round((counts.urgent / total) * 100) },
      { priority: "High", count: counts.high, color: "bg-amber-500", percent: Math.round((counts.high / total) * 100) },
      { priority: "Medium", count: counts.medium, color: "bg-sky-500", percent: Math.round((counts.medium / total) * 100) },
      { priority: "Low", count: counts.low, color: "bg-emerald-500", percent: Math.round((counts.low / total) * 100) },
    ];
  }, [tasks]);

  // 4. Completed vs Overdue vs Pending
  const statusComparison = useMemo(() => {
    const completed = tasks.filter((t) => t.status === "completed").length;
    const overdue = tasks.filter((t) => t.is_overdue && t.status !== "completed").length;
    const pending = tasks.filter((t) => !t.is_overdue && t.status !== "completed").length;
    const total = tasks.length || 1;

    return {
      completed,
      overdue,
      pending,
      compPercent: Math.round((completed / total) * 100),
      overPercent: Math.round((overdue / total) * 100),
      pendPercent: Math.round((pending / total) * 100),
    };
  }, [tasks]);

  // 5. Recurring completion rate
  const recurringData = useMemo(() => {
    const recurring = tasks.filter((t) => t.is_recurring);
    const completed = recurring.filter((t) => t.status === "completed").length;
    const total = recurring.length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 100;
    return { total, completed, rate };
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* Upper Grid: Weekly & Monthly Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weekly Completion Trend */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-paper-line pb-3">
            <h3 className="font-display text-sm font-semibold text-ink">Weekly Completion Trend</h3>
            <span className="text-xs font-mono text-ink-muted">Last 7 Days</span>
          </div>
          <div className="flex items-end justify-between h-40 pt-4 px-2 gap-2">
            {weeklyData.map((item) => {
              const heightPercent = Math.round((item.count / maxWeeklyCount) * 100);
              return (
                <div key={item.date} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-[11px] font-mono text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.count}
                  </span>
                  <div className="w-full bg-paper-tint rounded-t overflow-hidden flex items-end h-28">
                    <div
                      className="w-full bg-forest transition-all duration-500 group-hover:bg-forest/80 rounded-t"
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-ink-muted mt-1">{item.label}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Monthly Completion Trend */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-paper-line pb-3">
            <h3 className="font-display text-sm font-semibold text-ink">Monthly Completion Trend</h3>
            <span className="text-xs font-mono text-ink-muted">Last 6 Months</span>
          </div>
          <div className="flex items-end justify-between h-40 pt-4 px-2 gap-2">
            {monthlyData.map((item) => {
              const heightPercent = Math.round((item.count / maxMonthlyCount) * 100);
              return (
                <div key={item.label} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-[11px] font-mono text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.count}
                  </span>
                  <div className="w-full bg-paper-tint rounded-t overflow-hidden flex items-end h-28">
                    <div
                      className="w-full bg-sky-600 transition-all duration-500 group-hover:bg-sky-500 rounded-t"
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-ink-muted mt-1">{item.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Lower Grid: Priority Breakdown & Status Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tasks by Priority */}
        <Card className="p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold text-ink border-b border-paper-line pb-3">
            Tasks by Priority
          </h3>
          <div className="space-y-3">
            {priorityData.map((item) => (
              <div key={item.priority} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-ink">{item.priority}</span>
                  <span className="text-ink-muted">{item.count} ({item.percent}%)</span>
                </div>
                <div className="h-2 w-full bg-paper-tint rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} transition-all duration-500`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Completed vs Overdue vs Pending */}
        <Card className="p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold text-ink border-b border-paper-line pb-3">
            Task Status Ratio
          </h3>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-emerald-700 dark:text-emerald-300">Completed</span>
                <span>{statusComparison.completed} ({statusComparison.compPercent}%)</span>
              </div>
              <div className="h-2.5 w-full bg-paper-tint rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${statusComparison.compPercent}%` }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-red-700 dark:text-red-300">Overdue</span>
                <span>{statusComparison.overdue} ({statusComparison.overPercent}%)</span>
              </div>
              <div className="h-2.5 w-full bg-paper-tint rounded-full overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: `${statusComparison.overPercent}%` }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-sky-700 dark:text-sky-300">In-Progress / Pending</span>
                <span>{statusComparison.pending} ({statusComparison.pendPercent}%)</span>
              </div>
              <div className="h-2.5 w-full bg-paper-tint rounded-full overflow-hidden">
                <div className="h-full bg-sky-500" style={{ width: `${statusComparison.pendPercent}%` }} />
              </div>
            </div>
          </div>
        </Card>

        {/* Recurring Task Completion */}
        <Card className="p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold text-ink border-b border-paper-line pb-3">
            Recurring Workload
          </h3>
          <div className="flex flex-col items-center justify-center p-4 space-y-2">
            <div className="relative flex items-center justify-center h-24 w-24 rounded-full border-4 border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20">
              <span className="font-display text-xl font-bold text-indigo-600 dark:text-indigo-400">
                {recurringData.rate}%
              </span>
            </div>
            <p className="text-xs text-ink-muted text-center">
              {recurringData.completed} of {recurringData.total} recurring tasks completed
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
