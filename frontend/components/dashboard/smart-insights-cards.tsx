"use client";

import React, { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Task } from "@/types/task";
import { Meeting } from "@/types/meeting";
import { Card } from "@/components/ui/card";
import { Lightbulb, Sparkles, TrendingUp, Calendar, Repeat } from "lucide-react";

interface SmartInsightsCardsProps {
  tasks: Task[];
  meetings: Meeting[];
}

export function SmartInsightsCards({ tasks, meetings }: SmartInsightsCardsProps) {
  const insights = useMemo(() => {
    const completedTasks = tasks.filter((t) => t.status === "completed" && t.completed_at);
    const result: Array<{ icon: any; title: string; body: string; tag: string }> = [];

    // 1. Peak hour insight
    if (completedTasks.length > 0) {
      const morningCount = completedTasks.filter((t) => {
        const h = new Date(t.completed_at!).getHours();
        return h >= 5 && h < 12;
      }).length;
      const morningPercent = Math.round((morningCount / completedTasks.length) * 100);
      if (morningPercent >= 40) {
        result.push({
          icon: Sparkles,
          title: "Morning Productivity Peak",
          body: `You complete ${morningPercent}% of your tasks before noon. Capitalize on early morning focus time!`,
          tag: "Peak Performance",
        });
      }
    }

    // 2. Most productive weekday
    if (completedTasks.length > 0) {
      const dayCounts: Record<string, number> = {};
      completedTasks.forEach((t) => {
        const dayName = format(new Date(t.completed_at!), "EEEE");
        dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
      });
      const topDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
      if (topDay) {
        result.push({
          icon: TrendingUp,
          title: "Top Productive Day",
          body: `${topDay[0]} is your most productive day with ${topDay[1]} completed tasks recorded.`,
          tag: "Productivity Pattern",
        });
      }
    }

    // 3. Recurring completion
    const recurringTasks = tasks.filter((t) => t.is_recurring);
    const completedRecurring = recurringTasks.filter((t) => t.status === "completed");
    if (recurringTasks.length > 0 && completedRecurring.length === recurringTasks.length) {
      result.push({
        icon: Repeat,
        title: "100% Routine Completion",
        body: "You have completed every single recurring task in your active workspace!",
        tag: "Habit Master",
      });
    }

    // 4. Meeting vs Task Balance
    const activeTasksCount = tasks.filter((t) => t.status !== "completed").length;
    const scheduledMeetingsCount = meetings.filter((m) => m.status === "scheduled").length;

    if (scheduledMeetingsCount > activeTasksCount && scheduledMeetingsCount > 0) {
      result.push({
        icon: Calendar,
        title: "High Meeting Density",
        body: "You currently have more upcoming meetings than active tasks. Schedule async focus slots!",
        tag: "Time Allocation",
      });
    } else {
      result.push({
        icon: Lightbulb,
        title: "Balanced Focus Work",
        body: "Your execution tasks take healthy priority over meeting schedules today.",
        tag: "Workload Balance",
      });
    }

    return result;
  }, [tasks, meetings]);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-paper-line pb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          <h3 className="font-display text-base font-semibold text-ink">Smart Workspace Insights</h3>
        </div>
        <span className="text-xs font-mono text-ink-muted">Automated Analytics</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {insights.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="p-4 bg-paper-tint/60 rounded-xl border border-paper-line space-y-2 hover:border-forest/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 bg-paper rounded-lg border border-paper-line text-forest">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-forest/10 text-forest">
                  {card.tag}
                </span>
              </div>
              <h4 className="font-display text-sm font-semibold text-ink">{card.title}</h4>
              <p className="text-xs text-ink-muted leading-relaxed">{card.body}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
