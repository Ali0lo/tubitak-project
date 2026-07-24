"use client";

import { useMemo, useState } from "react";
import { Sparkles, TrendingUp, Award, Calendar, CheckCircle2, Clock, BarChart2, X, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Task } from "@/types/task";
import { Meeting } from "@/types/meeting";
import { subDays, isAfter } from "date-fns";

interface AIWeeklySummaryProps {
  tasks: Task[];
  meetings: Meeting[];
}

export function AIWeeklySummary({ tasks, meetings }: AIWeeklySummaryProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Compute 7-day stats
  const weeklyStats = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);

    const recentTasks = tasks.filter(
      (t) => new Date(t.created_at || t.updated_at).getTime() >= sevenDaysAgo.getTime()
    );

    const completedWeekly = tasks.filter(
      (t) => t.status === "completed" && t.completed_at && new Date(t.completed_at).getTime() >= sevenDaysAgo.getTime()
    );

    const urgentCompleted = completedWeekly.filter((t) => t.priority === "urgent").length;
    const highCompleted = completedWeekly.filter((t) => t.priority === "high").length;
    const mediumCompleted = completedWeekly.filter((t) => t.priority === "medium").length;
    const lowCompleted = completedWeekly.filter((t) => t.priority === "low").length;

    const totalTaskCount = Math.max(recentTasks.length, completedWeekly.length, 1);
    const completionRate = Math.min(100, Math.round((completedWeekly.length / totalTaskCount) * 100));

    const weeklyMeetings = meetings.filter(
      (m) => new Date(m.start_time).getTime() >= sevenDaysAgo.getTime()
    );

    const productivityScore = Math.min(98, Math.max(65, completionRate + 15));

    return {
      completedCount: completedWeekly.length,
      totalTaskCount,
      completionRate,
      weeklyMeetingsCount: weeklyMeetings.length,
      productivityScore,
      urgentCompleted,
      highCompleted,
      mediumCompleted,
      lowCompleted,
    };
  }, [tasks, meetings]);

  return (
    <>
      <Card className="p-5 bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border-purple-300 dark:border-purple-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-600 text-white rounded-lg shadow-sm">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-ink">
                AI Weekly Performance
              </h3>
              <p className="text-xs text-ink-muted">Past 7 days productivity report</p>
            </div>
          </div>

          <Badge tone="forest" className="bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300">
            Score: {weeklyStats.productivityScore}/100
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 py-1 text-center font-mono">
          <div className="p-2 bg-paper-tint rounded border border-paper-line">
            <p className="text-xs text-ink-muted uppercase">Completed</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{weeklyStats.completedCount}</p>
          </div>
          <div className="p-2 bg-paper-tint rounded border border-paper-line">
            <p className="text-xs text-ink-muted uppercase">Rate</p>
            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{weeklyStats.completionRate}%</p>
          </div>
          <div className="p-2 bg-paper-tint rounded border border-paper-line">
            <p className="text-xs text-ink-muted uppercase">Meetings</p>
            <p className="text-lg font-bold text-sky-600 dark:text-sky-400">{weeklyStats.weeklyMeetingsCount}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>View Full AI Weekly Insights</span>
          <ChevronRight className="h-3.5 w-3.5 ml-auto" />
        </button>
      </Card>

      {/* Modal for Weekly Summary */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-paper border border-paper-line rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-raised"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-paper-line pb-4">
              <div className="p-3 bg-purple-600 text-white rounded-xl shadow-md">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-display text-ink">
                  AI Weekly Summary & Insights
                </h2>
                <p className="text-xs text-ink-muted">Detailed analysis of your past 7 days</p>
              </div>
            </div>

            {/* Score & Highlights */}
            <div className="p-4 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-200 dark:border-purple-900 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-purple-700 dark:text-purple-300 font-bold">
                  Weekly Productivity Rating
                </span>
                <span className="text-xl font-black text-purple-600 dark:text-purple-400">
                  {weeklyStats.productivityScore} / 100
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                Outstanding output this week! You completed {weeklyStats.completedCount} tasks with a {weeklyStats.completionRate}% resolution rate.
              </p>
            </div>

            {/* Priority Breakdown */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase text-ink-faint font-semibold">
                Tasks Completed by Priority
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-rose-500/10 border border-rose-200 dark:border-rose-900 rounded-lg flex justify-between items-center">
                  <span className="font-semibold text-rose-700 dark:text-rose-300">Urgent</span>
                  <span className="font-mono font-bold text-ink">{weeklyStats.urgentCompleted} done</span>
                </div>
                <div className="p-2.5 bg-amber-500/10 border border-amber-200 dark:border-amber-900 rounded-lg flex justify-between items-center">
                  <span className="font-semibold text-amber-700 dark:text-amber-300">High</span>
                  <span className="font-mono font-bold text-ink">{weeklyStats.highCompleted} done</span>
                </div>
                <div className="p-2.5 bg-sky-500/10 border border-sky-200 dark:border-sky-900 rounded-lg flex justify-between items-center">
                  <span className="font-semibold text-sky-700 dark:text-sky-300">Medium</span>
                  <span className="font-mono font-bold text-ink">{weeklyStats.mediumCompleted} done</span>
                </div>
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900 rounded-lg flex justify-between items-center">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">Low</span>
                  <span className="font-mono font-bold text-ink">{weeklyStats.lowCompleted} done</span>
                </div>
              </div>
            </div>

            {/* Strategic AI Recommendations */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase text-ink-faint font-semibold flex items-center gap-1">
                <Award className="h-3.5 w-3.5 text-purple-600" /> Strategic AI Advice for Next Week
              </h4>
              <ul className="text-xs text-ink space-y-1.5 list-disc pl-4">
                <li>Schedule high-focus tasks in early mornings to minimize mid-day meeting context switching.</li>
                <li>Block 30-minute buffer periods between consecutive meetings.</li>
                <li>Maintain your daily task completion streak for enhanced momentum!</li>
              </ul>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-paper-raised border border-paper-line text-ink font-medium text-xs rounded-lg hover:bg-paper-tint"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
