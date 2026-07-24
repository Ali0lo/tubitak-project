"use client";

import { useMemo, useState } from "react";
import { Sparkles, CheckCircle2, ArrowRight, RefreshCw, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Task } from "@/types/task";
import { Meeting } from "@/types/meeting";
import { isSameDay, isAfter, differenceInMinutes } from "date-fns";

interface AIDailySummaryProps {
  userName?: string;
  tasks: Task[];
  meetings: Meeting[];
  onCompleteTask?: (taskId: string) => void;
}

export function AIDailySummary({
  userName,
  tasks,
  meetings,
  onCompleteTask,
}: AIDailySummaryProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const today = useMemo(() => new Date(), []);
  const hour = today.getHours();
  const displayName = userName?.trim();

  const greeting = useMemo(() => {
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, [hour]);

  // Derive metrics
  const summaryMetrics = useMemo(() => {
    // 1. Today's tasks (due today or marked as is_due_today)
    const todayTasks = tasks.filter(
      (t) =>
        t.status !== "completed" &&
        t.status !== "cancelled" &&
        (t.is_due_today || (t.due_date && isSameDay(new Date(t.due_date), today)))
    );

    // 2. High or Urgent priority tasks
    const highPriorityTasks = tasks.filter(
      (t) =>
        t.status !== "completed" &&
        t.status !== "cancelled" &&
        (t.priority === "high" || t.priority === "urgent")
    );

    // 3. Overdue tasks
    const overdueTasks = tasks.filter((t) => t.is_overdue);

    // 4. Upcoming meeting countdown
    const upcomingMeetings = meetings
      .filter((m) => m.status === "scheduled" && isAfter(new Date(m.start_time), today))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    const nextMeeting = upcomingMeetings[0] || null;
    let meetingString = "";
    if (nextMeeting) {
      const diffMins = Math.max(1, differenceInMinutes(new Date(nextMeeting.start_time), today));
      meetingString = `1 meeting in ${diffMins} minutes`;
    } else {
      const totalMeetingsToday = meetings.filter(
        (m) => m.status === "scheduled" && isSameDay(new Date(m.start_time), today)
      ).length;
      meetingString = totalMeetingsToday === 0 ? "No meetings today" : `${totalMeetingsToday} meetings today`;
    }

    // 5. Recommended top focus task
    // Pick urgent task first, then high priority task, then nearest overdue task
    const topTask =
      overdueTasks[0] ||
      highPriorityTasks[0] ||
      todayTasks[0] ||
      tasks.find((t) => t.status !== "completed" && t.status !== "cancelled");

    return {
      todayCount: todayTasks.length,
      highPriorityCount: highPriorityTasks.length,
      overdueCount: overdueTasks.length,
      meetingString,
      topTask,
    };
  }, [tasks, meetings, today]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <Card className="p-6 bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 text-white shadow-xl rounded-2xl relative overflow-hidden border border-indigo-800/40">
      {/* Decorative ambient background glows */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative space-y-4">
        {/* Header Title & AI badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-tr from-amber-400 to-indigo-400 rounded-lg text-slate-950">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xs font-mono uppercase tracking-wider font-semibold text-indigo-300">
              AI Daily Productivity Summary
            </span>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Refresh AI Insights"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-amber-400" : ""}`} />
          </button>
        </div>

        {/* Greeting */}
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
          {greeting}{displayName ? `, ${displayName}` : ""}.
        </h1>

        <p className="text-slate-300 text-sm font-medium">You have:</p>

        {/* Dynamic Bullet Points matching exact requested format */}
        <ul className="space-y-1.5 text-sm sm:text-base font-medium text-slate-200 pl-1">
          <li className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
            <span>
              <strong className="text-white">{summaryMetrics.todayCount} tasks</strong> today
            </span>
          </li>

          <li className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-rose-400 shrink-0" />
            <span>
              <strong className="text-white">{summaryMetrics.highPriorityCount} high priority</strong> tasks
            </span>
          </li>

          <li className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-sky-400 shrink-0" />
            <span>
              <strong className="text-white">{summaryMetrics.meetingString}</strong>
            </span>
          </li>

          <li className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
            <span>
              <strong className="text-white">{summaryMetrics.overdueCount} overdue</strong> tasks
            </span>
          </li>
        </ul>

        {/* AI Focus Recommendation box */}
        {summaryMetrics.topTask ? (
          <div className="mt-4 p-3.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-mono uppercase text-amber-300 font-semibold tracking-wider flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> AI Recommendation
              </span>
              <p className="text-sm font-medium text-white">
                I recommend completing &quot;<strong className="text-amber-200">{summaryMetrics.topTask.title}</strong>&quot; before lunch.
              </p>
            </div>

            {onCompleteTask && (
              <button
                type="button"
                onClick={() => onCompleteTask(summaryMetrics.topTask!.id)}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-950 text-xs font-bold rounded-lg transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 shrink-0"
              >
                <span>Mark Done</span>
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 p-3.5 bg-emerald-500/20 backdrop-blur-md rounded-xl border border-emerald-400/30 text-emerald-200 text-xs font-medium">
            🎉 All catch-up tasks completed! You are ready to tackle new goals.
          </div>
        )}
      </div>
    </Card>
  );
}
