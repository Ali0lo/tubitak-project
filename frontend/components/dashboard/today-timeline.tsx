"use client";

import { useMemo } from "react";
import { format, isSameDay, isAfter, isBefore } from "date-fns";
import { Calendar, Clock, CheckCircle2, Video, ListTodo, AlertCircle, Circle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Task, TaskPriority } from "@/types/task";
import { Meeting } from "@/types/meeting";
import { useUpdateTask } from "@/hooks/use-tasks";

interface TodayTimelineProps {
  tasks: Task[];
  meetings: Meeting[];
}

type TimelineItem =
  | {
      id: string;
      type: "meeting";
      title: string;
      time: Date;
      endTime: Date;
      status: string;
      isOverdue: boolean;
      meetingLink?: string | null;
    }
  | {
      id: string;
      type: "task";
      title: string;
      time: Date | null;
      priority: TaskPriority;
      status: string;
      isOverdue: boolean;
    };

const priorityToneMap: Record<TaskPriority, "low" | "medium" | "high" | "urgent"> = {
  low: "low",
  medium: "medium",
  high: "high",
  urgent: "urgent",
};

export function TodayTimeline({ tasks, meetings }: TodayTimelineProps) {
  const updateTask = useUpdateTask();
  const today = useMemo(() => new Date(), []);

  // Merge today's tasks & meetings into unified timeline
  const timelineItems = useMemo(() => {
    const todayMeetings: TimelineItem[] = meetings
      .filter((m) => isSameDay(new Date(m.start_time), today))
      .map((m) => ({
        id: m.id,
        type: "meeting" as const,
        title: m.title,
        time: new Date(m.start_time),
        endTime: new Date(m.end_time),
        status: m.status,
        isOverdue: m.is_overdue || false,
        meetingLink: m.meeting_link || m.location,
      }));

    const todayTasks: TimelineItem[] = tasks
      .filter(
        (t) =>
          t.is_due_today || (t.due_date && isSameDay(new Date(t.due_date), today))
      )
      .map((t) => ({
        id: t.id,
        type: "task" as const,
        title: t.title,
        time: t.due_date ? new Date(t.due_date) : null,
        priority: t.priority,
        status: t.status,
        isOverdue: t.is_overdue || false,
      }));

    const merged = [...todayMeetings, ...todayTasks];

    // Sort chronologically by time (items without time go to end)
    return merged.sort((a, b) => {
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.getTime() - b.time.getTime();
    });
  }, [tasks, meetings, today]);

  const handleTaskComplete = (taskId: string, currentStatus: string) => {
    updateTask.mutate({
      taskId,
      input: { status: currentStatus === "completed" ? "pending" : "completed" },
    });
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-paper-line pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="font-display text-base font-semibold text-ink">
            Today&apos;s Timeline
          </h2>
        </div>
        <span className="text-xs font-mono text-ink-muted">
          {timelineItems.length} {timelineItems.length === 1 ? "item" : "items"} scheduled
        </span>
      </div>

      {timelineItems.length === 0 ? (
        <div className="py-8 text-center text-xs text-ink-muted italic">
          No schedule items or tasks set for today. Enjoy your clear day!
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-paper-line">
          {timelineItems.map((item) => {
            const isCompleted = item.status === "completed";

            return (
              <div key={`${item.type}-${item.id}`} className="relative group">
                {/* Timeline node icon */}
                <div
                  className={`absolute -left-6 top-1 h-5 w-5 rounded-full border-2 bg-paper flex items-center justify-center transition-colors ${
                    item.type === "meeting"
                      ? "border-sky-500 text-sky-600"
                      : isCompleted
                      ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                      : "border-indigo-400 text-indigo-600"
                  }`}
                >
                  {item.type === "meeting" ? (
                    <Video className="h-2.5 w-2.5" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="h-2.5 w-2.5" />
                  ) : (
                    <Circle className="h-2 w-2 fill-current" />
                  )}
                </div>

                {/* Timeline Content Card */}
                <div
                  className={`p-3 rounded-lg border transition-all ${
                    item.type === "meeting"
                      ? "bg-sky-500/5 border-sky-200 dark:border-sky-800/40 hover:border-sky-300"
                      : isCompleted
                      ? "bg-emerald-500/5 border-emerald-200/60 dark:border-emerald-950 opacity-75"
                      : "bg-paper-tint border-paper-line hover:border-indigo-300"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-medium ${
                            isCompleted ? "line-through text-ink-faint" : "text-ink"
                          }`}
                        >
                          {item.title}
                        </span>

                        {item.type === "meeting" ? (
                          <Badge tone="sky" className="text-[10px]">
                            Meeting
                          </Badge>
                        ) : (
                          <Badge tone={priorityToneMap[item.priority]} className="text-[10px]">
                            {item.priority}
                          </Badge>
                        )}

                        {item.isOverdue && (
                          <Badge tone="urgent" className="text-[10px]">
                            Overdue
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-ink-muted font-mono">
                        <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                          <Clock className="h-3 w-3" />
                          {item.time ? format(item.time, "HH:mm") : "All Day"}
                          {item.type === "meeting" && item.endTime && ` - ${format(item.endTime, "HH:mm")}`}
                        </span>
                      </div>
                    </div>

                    {item.type === "task" && (
                      <button
                        type="button"
                        onClick={() => handleTaskComplete(item.id, item.status)}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors self-start sm:self-auto ${
                          isCompleted
                            ? "bg-paper border border-paper-line text-ink-muted hover:bg-paper-raised"
                            : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        {isCompleted ? "Mark Pending" : "Complete"}
                      </button>
                    )}

                    {item.type === "meeting" && item.meetingLink && (
                      <a
                        href={item.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 text-xs bg-sky-100 text-sky-800 hover:bg-sky-200 dark:bg-sky-950 dark:text-sky-200 font-medium rounded self-start sm:self-auto"
                      >
                        Join Call
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
