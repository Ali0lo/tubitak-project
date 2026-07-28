"use client";

import React, { useMemo, useState, useEffect } from "react";
import { format, isSameDay } from "date-fns";
import { Task, TaskPriority } from "@/types/task";
import { Meeting } from "@/types/meeting";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePomodoroStore } from "@/stores/pomodoro-store";
import { CheckCircle2, Clock, AlertCircle, Video, Sparkles, StickyNote, Play, Pause, Flame } from "lucide-react";

interface TodayWorkspaceProps {
  tasks: Task[];
  meetings: Meeting[];
  onCompleteTask?: (taskId: string) => void;
}

const priorityToneMap: Record<TaskPriority, "low" | "medium" | "high" | "urgent"> = {
  low: "low",
  medium: "medium",
  high: "high",
  urgent: "urgent",
};

export function TodayWorkspace({ tasks, meetings, onCompleteTask }: TodayWorkspaceProps) {
  const today = useMemo(() => new Date(), []);
  const pomodoroStore = usePomodoroStore();
  const [quickNote, setQuickNote] = useState("");

  // Persist quick note
  useEffect(() => {
    const saved = localStorage.getItem("todotak-quick-notes");
    if (saved) setQuickNote(saved);
  }, []);

  const handleNoteChange = (val: string) => {
    setQuickNote(val);
    localStorage.setItem("todotak-quick-notes", val);
  };

  // 1. Today's Tasks
  const todayTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status !== "completed" &&
          t.status !== "cancelled" &&
          (t.is_due_today || (t.due_date && isSameDay(new Date(t.due_date), today)))
      ),
    [tasks, today]
  );

  // 2. Today's Meetings
  const todayMeetings = useMemo(
    () =>
      meetings.filter(
        (m) =>
          m.status === "scheduled" &&
          isSameDay(new Date(m.start_time), today)
      ),
    [meetings, today]
  );

  // 3. Overdue Tasks
  const overdueTasks = useMemo(() => tasks.filter((t) => t.is_overdue), [tasks]);

  // 4. Suggested Next Task (fallback to highest priority + due date)
  const suggestedTask = useMemo(() => {
    const candidatePool = [...overdueTasks, ...todayTasks];
    if (candidatePool.length === 0) return null;

    const priorityWeight: Record<TaskPriority, number> = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return candidatePool.sort((a, b) => {
      const weightA = priorityWeight[a.priority];
      const weightB = priorityWeight[b.priority];
      if (weightA !== weightB) return weightB - weightA;
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return 0;
    })[0];
  }, [overdueTasks, todayTasks]);

  return (
    <div className="space-y-6">
      {/* Header Banner: Suggested Next Task & Focus Launcher */}
      {suggestedTask && (
        <Card className="p-5 bg-gradient-to-r from-forest/10 via-paper to-sky-50 dark:to-sky-950/20 border-forest/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-forest animate-pulse" />
                <span className="font-mono text-xs uppercase font-bold text-forest tracking-wider">
                  Smart AI Recommendation
                </span>
              </div>
              <h3 className="font-display text-lg font-bold text-ink">{suggestedTask.title}</h3>
              <div className="flex items-center gap-3 text-xs text-ink-muted">
                <Badge tone={priorityToneMap[suggestedTask.priority]}>{suggestedTask.priority}</Badge>
                {suggestedTask.due_date && (
                  <span>Due: {format(new Date(suggestedTask.due_date), "HH:mm MMM d")}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  pomodoroStore.setActiveTask(suggestedTask.id, suggestedTask.title);
                  pomodoroStore.startTimer();
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-forest hover:bg-forest/90 text-white font-medium text-xs rounded-lg shadow-sm transition-colors"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Start Focus Session
              </button>
              {onCompleteTask && (
                <button
                  type="button"
                  onClick={() => onCompleteTask(suggestedTask.id)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-medium text-xs rounded-lg hover:bg-emerald-200 transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Done
                </button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Main Grid: Today's Tasks & Meetings, Pomodoro & Quick Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Tasks & Meetings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today Tasks */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-paper-line pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                <h3 className="font-display text-base font-semibold text-ink">
                  Today&apos;s Execution Agenda ({todayTasks.length})
                </h3>
              </div>
            </div>

            {todayTasks.length === 0 ? (
              <p className="text-xs text-ink-muted italic py-6 text-center">
                All scheduled tasks for today are completed! Great job! 🎉
              </p>
            ) : (
              <div className="space-y-2">
                {todayTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 bg-paper rounded-lg border border-paper-line hover:border-forest/40 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => onCompleteTask?.(t.id)}
                        className="h-4 w-4 rounded border border-ink-muted flex items-center justify-center hover:border-forest hover:bg-forest/10"
                      >
                        <CheckCircle2 className="h-3 w-3 text-transparent hover:text-forest" />
                      </button>
                      <span className="font-medium text-ink truncate">{t.title}</span>
                      <Badge tone={priorityToneMap[t.priority]} className="text-[10px]">
                        {t.priority}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-ink-muted">
                      {t.due_date && <span>{format(new Date(t.due_date), "HH:mm")}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Today Meetings */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-paper-line pb-3">
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-sky-600" />
                <h3 className="font-display text-base font-semibold text-ink">
                  Today&apos;s Syncs & Calls ({todayMeetings.length})
                </h3>
              </div>
            </div>

            {todayMeetings.length === 0 ? (
              <p className="text-xs text-ink-muted italic py-4 text-center">No meetings scheduled for today.</p>
            ) : (
              <div className="space-y-2">
                {todayMeetings.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 bg-sky-50/40 dark:bg-sky-950/20 rounded-lg border border-sky-100 dark:border-sky-900 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-sky-600 shrink-0" />
                      <span className="font-medium text-ink">{m.title}</span>
                    </div>
                    <span className="font-mono text-sky-700 dark:text-sky-300">
                      {format(new Date(m.start_time), "HH:mm")} - {format(new Date(m.end_time), "HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Pomodoro & Quick Notes */}
        <div className="space-y-6">
          {/* Pomodoro Focus Status */}
          <Card className="p-5 space-y-4 bg-gradient-to-br from-rose-50/50 via-paper to-paper dark:from-rose-950/10">
            <div className="flex items-center justify-between border-b border-paper-line pb-3">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-rose-600" />
                <h3 className="font-display text-base font-semibold text-ink">Focus Session</h3>
              </div>
              <span className="font-mono text-xs font-bold text-rose-600">
                {Math.floor(pomodoroStore.timeLeft / 60).toString().padStart(2, "0")}:
                {(pomodoroStore.timeLeft % 60).toString().padStart(2, "0")}
              </span>
            </div>

            <div className="text-center space-y-2 py-2">
              <p className="text-xs text-ink-muted font-medium">
                {pomodoroStore.activeTaskTitle ? (
                  <>Working on: <span className="font-bold text-ink">{pomodoroStore.activeTaskTitle}</span></>
                ) : (
                  "Ready to launch a focus session"
                )}
              </p>

              <div className="flex justify-center gap-2 pt-2">
                {pomodoroStore.isRunning ? (
                  <button
                    type="button"
                    onClick={() => pomodoroStore.pauseTimer()}
                    className="flex items-center gap-1 px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium"
                  >
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => pomodoroStore.startTimer()}
                    className="flex items-center gap-1 px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium"
                  >
                    <Play className="h-3.5 w-3.5" /> Start
                  </button>
                )}
              </div>
            </div>
          </Card>

          {/* Quick Notes Widget */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-paper-line pb-3">
              <StickyNote className="h-5 w-5 text-amber-500" />
              <h3 className="font-display text-base font-semibold text-ink">Scratchpad / Quick Notes</h3>
            </div>
            <textarea
              value={quickNote}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="Jot down quick thoughts, code snippets, or reminders..."
              className="w-full h-32 p-3 text-xs font-mono bg-paper-tint/60 rounded-lg border border-paper-line focus:outline-none focus:border-forest"
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
