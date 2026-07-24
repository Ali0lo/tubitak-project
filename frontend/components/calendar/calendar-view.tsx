"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Repeat, Clock, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useMeetings } from "@/hooks/use-meetings";
import { useTasks } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";
import { Task } from "@/types/task";
import { Meeting } from "@/types/meeting";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarItemModalProps {
  item: Task | Meeting | null;
  type: "task" | "meeting" | null;
  onClose: () => void;
}

function CalendarItemModal({ item, type, onClose }: CalendarItemModalProps) {
  if (!item || !type) return null;

  const isTask = type === "task";
  const task = isTask ? (item as Task) : null;
  const meeting = !isTask ? (item as Meeting) : null;

  const isOverdue = item.is_overdue;
  const isCompleted = isTask ? task?.status === "completed" : meeting?.status === "completed";
  const isCancelled = isTask ? task?.status === "cancelled" : meeting?.status === "cancelled";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-paper p-6 shadow-xl border border-paper-line animate-in fade-in zoom-in-95">
        <div className="flex items-start justify-between border-b border-paper-line pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-semibold text-ink">{item.title}</h3>
              {item.is_recurring ? (
                <span title="Recurring">
                  <Repeat className="h-4 w-4 text-forest" />
                </span>
              ) : null}
            </div>
            <p className="text-xs text-ink-muted uppercase font-mono mt-0.5">
              {isTask ? "Task" : "Meeting"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-faint hover:text-ink text-lg font-bold px-2"
          >
            &times;
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          {/* Status & Colors */}
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink-muted">Status:</span>
            {isCancelled ? (
              <Badge tone="neutral" className="flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" /> Cancelled
              </Badge>
            ) : isCompleted ? (
              <Badge tone="forest" className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Completed
              </Badge>
            ) : isOverdue ? (
              <Badge tone="brick" className="flex items-center gap-1 bg-red-100 text-red-700 border-red-300">
                <AlertCircle className="h-3.5 w-3.5" /> Overdue ({item.overdue_duration})
              </Badge>
            ) : (
              <Badge tone="neutral" className="flex items-center gap-1 bg-sky-50 text-sky-800 border-sky-300">
                <Clock className="h-3.5 w-3.5" /> Upcoming
              </Badge>
            )}
          </div>

          {/* Dates */}
          {isTask && task?.due_date ? (
            <div>
              <span className="font-medium text-ink-muted">Due Date: </span>
              <span className="text-ink">{format(new Date(task.due_date), "PPP p")}</span>
            </div>
          ) : null}

          {meeting ? (
            <div>
              <span className="font-medium text-ink-muted">Time: </span>
              <span className="text-ink">
                {format(new Date(meeting.start_time), "PPP p")} - {format(new Date(meeting.end_time), "p")}
              </span>
            </div>
          ) : null}

          {/* Priority */}
          {isTask && task?.priority ? (
            <div>
              <span className="font-medium text-ink-muted">Priority: </span>
              <span className="capitalize text-ink">{task.priority}</span>
            </div>
          ) : null}

          {/* Reminders */}
          {item.next_reminder_at ? (
            <div className="text-xs text-ink-muted bg-paper-tint p-2 rounded border border-paper-line">
              <span className="font-semibold">Next Reminder: </span>
              {format(new Date(item.next_reminder_at), "PPP p")}
            </div>
          ) : null}

          {/* Recurrence */}
          {isTask && task?.is_recurring && task.recurrence_rule ? (
            <div className="text-xs text-ink-muted bg-forest-tint p-2 rounded border border-forest/20">
              <span className="font-semibold flex items-center gap-1">
                <Repeat className="h-3 w-3" /> Recurrence Rule:
              </span>
              <span className="capitalize">{task.recurrence_rule.frequency}</span>
            </div>
          ) : null}

          {/* Description */}
          {item.description ? (
            <div className="pt-2 border-t border-paper-line text-xs text-ink-muted">
              <p className="font-medium text-ink mb-1">Description:</p>
              <p className="whitespace-pre-wrap bg-paper-tint p-2 rounded">{item.description}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-seal bg-forest text-paper text-sm font-medium hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function CalendarView() {
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedItem, setSelectedItem] = useState<{
    item: Task | Meeting;
    type: "task" | "meeting";
  } | null>(null);

  const { data: taskData, isLoading: tasksLoading } = useTasks();
  const { data: meetingData, isLoading: meetingsLoading } = useMeetings();

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  if (tasksLoading || meetingsLoading) {
    return (
      <Card>
        <Spinner label="Loading calendar" />
      </Card>
    );
  }

  const tasksWithDueDate = (taskData?.items ?? []).filter((t) => t.due_date);
  const meetings = meetingData?.items ?? [];

  const getItemBadgeStyle = (item: Task | Meeting, isMeeting: boolean) => {
    const isOverdue = item.is_overdue;
    const isCompleted = isMeeting
      ? (item as Meeting).status === "completed"
      : (item as Task).status === "completed";
    const isCancelled = isMeeting
      ? (item as Meeting).status === "cancelled"
      : (item as Task).status === "cancelled";
    const isToday = isMeeting
      ? isSameDay(new Date((item as Meeting).start_time), new Date())
      : (item as Task).due_date ? isSameDay(new Date((item as Task).due_date!), new Date()) : false;

    if (isCancelled) {
      return "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200";
    }
    if (isCompleted) {
      return "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200";
    }
    if (isOverdue) {
      return "bg-red-100 text-red-800 border-red-300 hover:bg-red-200 font-semibold";
    }
    if (isToday) {
      return "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200";
    }
    return "bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-200";
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-paper-line px-5 py-4">
        <button
          type="button"
          onClick={() => setCursor((c) => subMonths(c, 1))}
          aria-label="Previous month"
          className="focus-ring rounded-seal p-1.5 hover:bg-forest-tint"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-4">
          <h2 className="font-display text-lg text-ink">
            {format(cursor, "MMMM yyyy")}
          </h2>
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono">
            <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-300">Upcoming</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">Today</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">Completed</span>
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-300">Overdue</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, 1))}
          aria-label="Next month"
          className="focus-ring rounded-seal p-1.5 hover:bg-forest-tint"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-paper-line text-center font-mono text-[11px] uppercase tracking-wide text-ink-faint">
        {WEEKDAY_LABELS.map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayTasks = tasksWithDueDate.filter(
            (t) => t.due_date && isSameDay(new Date(t.due_date), day)
          );
          const dayMeetings = meetings.filter((m) =>
            isSameDay(new Date(m.start_time), day)
          );
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, new Date());
          const totalItems = dayTasks.length + dayMeetings.length;
          const overflowCount = totalItems - 4;

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[105px] border-b border-r border-paper-line p-1.5 last:border-r-0",
                !inMonth && "bg-paper/50"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-xs",
                  inMonth ? "text-ink-muted" : "text-ink-faint/50",
                  isToday && "bg-forest text-paper font-bold"
                )}
              >
                {format(day, "d")}
              </span>
              <div className="mt-1 space-y-1">
                {dayMeetings.slice(0, 2).map((meeting) => (
                  <button
                    key={meeting.id}
                    type="button"
                    onClick={() => setSelectedItem({ item: meeting, type: "meeting" })}
                    className={cn(
                      "block w-full text-left truncate px-1.5 py-0.5 rounded text-[11px] border transition-colors",
                      getItemBadgeStyle(meeting, true)
                    )}
                    title={`${meeting.title} (${meeting.is_overdue ? 'Overdue' : meeting.status})`}
                  >
                    {meeting.is_recurring ? <Repeat className="inline-block h-2.5 w-2.5 mr-1" /> : null}
                    {meeting.title}
                  </button>
                ))}
                {dayTasks.slice(0, 2).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setSelectedItem({ item: task, type: "task" })}
                    className={cn(
                      "block w-full text-left truncate px-1.5 py-0.5 rounded text-[11px] border transition-colors",
                      getItemBadgeStyle(task, false)
                    )}
                    title={`${task.title} (${task.is_overdue ? 'Overdue' : task.status})`}
                  >
                    {task.is_recurring ? <Repeat className="inline-block h-2.5 w-2.5 mr-1" /> : null}
                    {task.title}
                  </button>
                ))}
                {overflowCount > 0 ? (
                  <p className="font-mono text-[10px] text-ink-faint px-1">
                    +{overflowCount} more
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <CalendarItemModal
        item={selectedItem?.item ?? null}
        type={selectedItem?.type ?? null}
        onClose={() => setSelectedItem(null)}
      />
    </Card>
  );
}
