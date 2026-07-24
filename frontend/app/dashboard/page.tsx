"use client";

import { useMemo, useState } from "react";
import { format, isSameDay } from "date-fns";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  RefreshCw,
  Plus,
  ArrowRight,
  ListTodo,
  Video,
  Activity,
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
import { Task } from "@/types/task";
import { Meeting } from "@/types/meeting";

export default function DashboardPage() {
  const [rescheduleDateMap, setRescheduleDateMap] = useState<Record<string, string>>({});
  const [editingTask, setEditingTask] = useState<Task | null>(null);

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
        {/* Banner Quick Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-red-50/60 border-red-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-100 text-red-600 rounded-lg">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-red-600 font-medium">Overdue Tasks</p>
                <p className="text-2xl font-bold text-red-900">{overdueTasks.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-amber-50/60 border-amber-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-600 rounded-lg">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-amber-600 font-medium">Due Today</p>
                <p className="text-2xl font-bold text-amber-900">{todayTasks.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-emerald-50/60 border-emerald-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-lg">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-emerald-600 font-medium">Completed Today</p>
                <p className="text-2xl font-bold text-emerald-900">{completedToday.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-sky-50/60 border-sky-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-sky-100 text-sky-600 rounded-lg">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-sky-600 font-medium">Upcoming Meetings</p>
                <p className="text-2xl font-bold text-sky-900">{upcomingMeetings.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Overdue Section */}
        {overdueTasks.length > 0 ? (
          <Card className="border-red-200 bg-red-50/20 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-red-200 pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <h2 className="font-display text-lg font-semibold text-red-900">
                  Overdue Tasks ({overdueTasks.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => completeOverdue.mutate(undefined)}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors"
              >
                Complete All Overdue
              </button>
            </div>

            <div className="space-y-3">
              {overdueTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white rounded-lg border border-red-200 shadow-sm gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink text-sm">{task.title}</span>
                      <Badge tone="brick" className="text-[10px] uppercase">
                        {task.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-red-700 font-mono">
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
                      className="px-2.5 py-1 text-xs bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded font-medium transition-colors"
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
                      className="text-xs p-1 border border-paper-line rounded font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuickReschedule(task.id)}
                      className="px-2 py-1 text-xs bg-amber-100 text-amber-800 hover:bg-amber-200 rounded font-medium transition-colors"
                      title="Reschedule Task"
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDelete(task.id)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
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

        {/* Grid Sections: Today's Tasks & Upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Tasks */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-paper-line pb-3">
              <div className="flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-amber-600" />
                <h2 className="font-display text-base font-semibold text-ink">Today&apos;s Tasks</h2>
              </div>
              <span className="text-xs font-mono text-ink-faint">{todayTasks.length} items</span>
            </div>

            {todayTasks.length === 0 ? (
              <p className="text-xs text-ink-muted italic py-4 text-center">No tasks scheduled for today.</p>
            ) : (
              <div className="space-y-2">
                {todayTasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-2.5 bg-paper-tint rounded border border-paper-line text-sm">
                    <span className="text-ink font-medium">{t.title}</span>
                    <button
                      type="button"
                      onClick={() => handleQuickComplete(t.id)}
                      className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 rounded font-medium"
                    >
                      Done
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Upcoming Items */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-paper-line pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-sky-600" />
                <h2 className="font-display text-base font-semibold text-ink">Upcoming Tasks & Meetings</h2>
              </div>
            </div>

            <div className="space-y-2">
              {upcomingMeetings.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-2.5 bg-sky-50/50 rounded border border-sky-100 text-sm">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-sky-600" />
                    <span className="text-ink font-medium">{m.title}</span>
                  </div>
                  <span className="text-xs font-mono text-sky-700">
                    {format(new Date(m.start_time), "MMM d, HH:mm")}
                  </span>
                </div>
              ))}
              {upcomingTasks.slice(0, 4).map((t) => (
                <div key={t.id} className="flex items-center justify-between p-2.5 bg-paper-tint rounded border border-paper-line text-sm">
                  <span className="text-ink font-medium">{t.title}</span>
                  <span className="text-xs font-mono text-ink-muted">
                    {t.due_date ? format(new Date(t.due_date), "MMM d, HH:mm") : ""}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Grid Sections: Missed Meetings & Recent Activity */}
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
                  <div key={m.id} className="flex items-center justify-between p-2.5 bg-red-50/40 rounded border border-red-100 text-sm">
                    <div>
                      <p className="text-ink font-medium">{m.title}</p>
                      <p className="text-xs font-mono text-red-600">Ended: {format(new Date(m.end_time), "MMM d, HH:mm")}</p>
                    </div>
                    <Badge tone="brick">Missed</Badge>
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
