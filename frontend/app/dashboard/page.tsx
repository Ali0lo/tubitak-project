"use client";

import { useMemo, useState } from "react";
import { format, isSameDay } from "date-fns";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Trash2,
  ListTodo,
  Video,
  Activity,
  Flame,
  Sparkles,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  useTasks,
  useUpdateTask,
  useDeleteTask,
  useRescheduleOverdue,
  useCompleteOverdue,
} from "@/hooks/use-tasks";
import { useMeetings } from "@/hooks/use-meetings";
import { Task, TaskPriority } from "@/types/task";
import { Meeting } from "@/types/meeting";

import { AIDailySummary } from "@/components/dashboard/ai-daily-summary";
import { StreakCard } from "@/components/dashboard/streak-card";
import { MeetingCountdown } from "@/components/dashboard/meeting-countdown";
import { TodayTimeline } from "@/components/dashboard/today-timeline";
import { AIWeeklySummary } from "@/components/dashboard/ai-weekly-summary";

const priorityToneMap: Record<TaskPriority, "low" | "medium" | "high" | "urgent"> = {
  low: "low",
  medium: "medium",
  high: "high",
  urgent: "urgent",
};

export default function DashboardPage() {
  const [rescheduleDateMap, setRescheduleDateMap] = useState<Record<string, string>>({});

  const { data: tasksData, isLoading: tasksLoading } = useTasks();
  const { data: meetingsData, isLoading: meetingsLoading } = useMeetings();

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const rescheduleOverdue = useRescheduleOverdue();
  const completeOverdue = useCompleteOverdue();

  const allTasks = useMemo(() => tasksData?.items ?? [], [tasksData]);
  const allMeetings = useMemo(() => meetingsData?.items ?? [], [meetingsData]);
  const today = useMemo(() => new Date(), []);

  // 1. Today's Tasks
  const todayTasks = useMemo(
    () =>
      allTasks.filter(
        (t) =>
          t.status !== "completed" &&
          t.status !== "cancelled" &&
          (t.is_due_today || (t.due_date && isSameDay(new Date(t.due_date), today)))
      ),
    [allTasks, today]
  );

  // 2. Upcoming Items (Tasks & Meetings)
  const upcomingTasks = useMemo(
    () =>
      allTasks.filter(
        (t) =>
          t.status !== "completed" &&
          t.status !== "cancelled" &&
          !t.is_overdue &&
          t.due_date &&
          new Date(t.due_date) > today &&
          !isSameDay(new Date(t.due_date), today)
      ),
    [allTasks, today]
  );

  const upcomingMeetings = useMemo(
    () =>
      allMeetings.filter(
        (m) =>
          m.status === "scheduled" &&
          !m.is_overdue &&
          new Date(m.start_time) > today
      ),
    [allMeetings, today]
  );

  // 3. Overdue Tasks
  const overdueTasks = useMemo(
    () => allTasks.filter((t) => t.is_overdue),
    [allTasks]
  );

  // 4. Missed Meetings
  const missedMeetings = useMemo(
    () => allMeetings.filter((m) => m.is_overdue || m.status === "cancelled"),
    [allMeetings]
  );

  // 5. Completed Today
  const completedToday = useMemo(
    () =>
      allTasks.filter(
        (t) =>
          t.status === "completed" &&
          t.completed_at &&
          isSameDay(new Date(t.completed_at), today)
      ),
    [allTasks, today]
  );

  // 6. Recent Activity
  const recentActivity = useMemo(() => {
    const combined = [
      ...allTasks.map((t) => ({
        id: t.id,
        title: t.title,
        type: "task" as const,
        time: t.updated_at,
        status: t.status,
      })),
      ...allMeetings.map((m) => ({
        id: m.id,
        title: m.title,
        type: "meeting" as const,
        time: m.updated_at,
        status: m.status,
      })),
    ];
    return combined
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 5);
  }, [allTasks, allMeetings]);

  if (tasksLoading || meetingsLoading) {
    return (
      <AppShell title="Dashboard">
        <Card className="p-8 flex justify-center items-center">
          <Spinner label="Loading dashboard..." />
        </Card>
      </AppShell>
    );
  }

  const handleQuickComplete = (taskId: string) => {
    updateTask.mutate({ taskId, input: { status: "completed" } });
  };

  const handleQuickReschedule = (taskId: string) => {
    const targetDate = rescheduleDateMap[taskId] || new Date(Date.now() + 86400000).toISOString().slice(0, 16);
    rescheduleOverdue.mutate({ taskIds: [taskId], newDueDate: new Date(targetDate).toISOString() });
  };

  const handleQuickDelete = (taskId: string) => {
    if (confirm("Are you sure you want to delete this task?")) {
      deleteTask.mutate(taskId);
    }
  };

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        {/* 1. AI Daily Summary Header */}
        <AIDailySummary
          userName="Ali"
          tasks={allTasks}
          meetings={allMeetings}
          onCompleteTask={handleQuickComplete}
        />

        {/* 2. Top Interactive Cards: Streak & Next Meeting Live Countdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StreakCard tasks={allTasks} />
          <MeetingCountdown meetings={allMeetings} />
        </div>

        {/* 3. Metric Banner Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-lg">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-red-600 dark:text-red-400 font-medium">Overdue Tasks</p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-100">{overdueTasks.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300 rounded-lg">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-amber-600 dark:text-amber-400 font-medium">Due Today</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{todayTasks.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 rounded-lg">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-emerald-600 dark:text-emerald-400 font-medium">Completed Today</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{completedToday.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-sky-50/60 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300 rounded-lg">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-sky-600 dark:text-sky-400 font-medium">Upcoming Meetings</p>
                <p className="text-2xl font-bold text-sky-900 dark:text-sky-100">{upcomingMeetings.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* 4. Overdue Section */}
        {overdueTasks.length > 0 ? (
          <Card className="border-red-200 dark:border-red-900 bg-red-50/20 dark:bg-red-950/10 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-red-200 dark:border-red-900 pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <h2 className="font-display text-lg font-semibold text-red-700 dark:text-red-300">
                  Overdue Tasks ({overdueTasks.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => completeOverdue.mutate(undefined)}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors shadow-sm"
              >
                Complete All Overdue
              </button>
            </div>

            <div className="space-y-3">
              {overdueTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-paper rounded-lg border border-red-300/40 shadow-sm gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink text-sm">{task.title}</span>
                      <Badge tone={priorityToneMap[task.priority]} className="text-[10px]">
                        {task.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-red-600 dark:text-red-400 font-mono">
                      <span>Due: {task.due_date ? format(new Date(task.due_date), "MMM d, HH:mm") : "N/A"}</span>
                      <span>•</span>
                      <span className="font-semibold">{task.overdue_duration}</span>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickComplete(task.id)}
                      className="px-2.5 py-1 text-xs bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 rounded font-medium transition-colors"
                      title="Complete Task"
                    >
                      Complete
                    </button>
                    <input
                      type="datetime-local"
                      value={rescheduleDateMap[task.id] || ""}
                      onChange={(e) =>
                        setRescheduleDateMap({ ...rescheduleDateMap, [task.id]: e.target.value })
                      }
                      className="text-xs p-1 border border-paper-line rounded font-mono bg-paper"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuickReschedule(task.id)}
                      className="px-2 py-1 text-xs bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200 rounded font-medium transition-colors"
                      title="Reschedule Task"
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDelete(task.id)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 rounded"
                      title="Delete Task"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {/* 5. Main Grid Section: Today's Timeline & AI Weekly Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TodayTimeline tasks={allTasks} meetings={allMeetings} />
          </div>

          <div className="space-y-6">
            <AIWeeklySummary tasks={allTasks} meetings={allMeetings} />

            {/* Upcoming Quick List */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-paper-line pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-sky-600" />
                  <h2 className="font-display text-base font-semibold text-ink">Upcoming Next</h2>
                </div>
              </div>

              <div className="space-y-2">
                {upcomingMeetings.slice(0, 3).map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-2.5 bg-sky-50/50 dark:bg-sky-950/20 rounded border border-sky-100 dark:border-sky-900 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Video className="h-4 w-4 text-sky-600 shrink-0" />
                      <span className="text-ink font-medium truncate">{m.title}</span>
                    </div>
                    <span className="text-xs font-mono text-sky-700 dark:text-sky-300 shrink-0 ml-2">
                      {format(new Date(m.start_time), "MMM d, HH:mm")}
                    </span>
                  </div>
                ))}
                {upcomingTasks.slice(0, 3).map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-2.5 bg-paper-tint rounded border border-paper-line text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge tone={priorityToneMap[t.priority]} className="text-[10px]">
                        {t.priority}
                      </Badge>
                      <span className="text-ink font-medium truncate">{t.title}</span>
                    </div>
                    <span className="text-xs font-mono text-ink-muted shrink-0 ml-2">
                      {t.due_date ? format(new Date(t.due_date), "MMM d, HH:mm") : ""}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* 6. Grid Sections: Missed Meetings & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Missed Meetings */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-paper-line pb-3">
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-red-600" />
                <h2 className="font-display text-base font-semibold text-ink">Missed Meetings</h2>
              </div>
            </div>

            {missedMeetings.length === 0 ? (
              <p className="text-xs text-ink-muted italic py-4 text-center">No missed meetings.</p>
            ) : (
              <div className="space-y-2">
                {missedMeetings.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-2.5 bg-red-50/40 dark:bg-red-950/20 rounded border border-red-100 dark:border-red-900 text-sm">
                    <div>
                      <p className="text-ink font-medium">{m.title}</p>
                      <p className="text-xs font-mono text-red-600 dark:text-red-400">Ended: {format(new Date(m.end_time), "MMM d, HH:mm")}</p>
                    </div>
                    <Badge tone="urgent">Missed</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Activity */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-paper-line pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-forest" />
                <h2 className="font-display text-base font-semibold text-ink">Recent Activity</h2>
              </div>
            </div>

            <div className="space-y-2">
              {recentActivity.map((act) => (
                <div key={act.id} className="flex items-center justify-between p-2 text-xs border-b border-paper-line last:border-b-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{act.title}</span>
                    <span className="capitalize text-ink-faint">({act.type})</span>
                  </div>
                  <span className="font-mono text-ink-muted">{format(new Date(act.time), "HH:mm")}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
