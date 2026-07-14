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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useMeetings } from "@/hooks/use-meetings";
import { useTasks } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView() {
  const [cursor, setCursor] = useState(() => new Date());
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
        <h2 className="font-display text-lg text-ink">
          {format(cursor, "MMMM yyyy")}
        </h2>
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
          const overflowCount = dayTasks.length + dayMeetings.length - 4;

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[96px] border-b border-r border-paper-line p-2 last:border-r-0",
                !inMonth && "bg-paper/50"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-xs",
                  inMonth ? "text-ink-muted" : "text-ink-faint/50",
                  isToday && "bg-forest text-paper"
                )}
              >
                {format(day, "d")}
              </span>
              <div className="mt-1 space-y-1">
                {dayMeetings.slice(0, 2).map((meeting) => (
                  <Badge
                    key={meeting.id}
                    tone="forest"
                    className="block w-fit max-w-full truncate normal-case"
                  >
                    {meeting.title}
                  </Badge>
                ))}
                {dayTasks.slice(0, 2).map((task) => (
                  <Badge
                    key={task.id}
                    tone="amber"
                    className="block w-fit max-w-full truncate normal-case"
                  >
                    {task.title}
                  </Badge>
                ))}
                {overflowCount > 0 ? (
                  <p className="font-mono text-[10px] text-ink-faint">
                    +{overflowCount} more
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
