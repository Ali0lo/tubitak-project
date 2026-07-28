"use client";

import React, { useMemo, useState } from "react";
import { format, subDays, isSameDay } from "date-fns";
import { Task } from "@/types/task";
import { Meeting } from "@/types/meeting";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { CheckCircle2, Calendar } from "lucide-react";

interface GitHubHeatmapProps {
  tasks: Task[];
  meetings?: Meeting[];
  focusMinutesMap?: Record<string, number>;
}

interface DayData {
  date: Date;
  dateStr: string;
  completedTasks: Task[];
  completedCount: number;
  meetingCount: number;
  focusMinutes: number;
  intensity: number;
}

export function GitHubHeatmap({ tasks, meetings = [], focusMinutesMap = {} }: GitHubHeatmapProps) {
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const today = useMemo(() => new Date(), []);

  const heatmapDays = useMemo(() => {
    const days: DayData[] = [];
    const totalDays = 364;

    for (let i = totalDays; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, "yyyy-MM-dd");

      const completed = tasks.filter(
        (t) =>
          t.status === "completed" &&
          t.completed_at &&
          isSameDay(new Date(t.completed_at), d)
      );

      const mCount = meetings.filter((m) => isSameDay(new Date(m.start_time), d)).length;
      const fMins = focusMinutesMap[dateStr] || 0;
      const count = completed.length;

      let intensity = 0;
      if (count === 1 || count === 2) intensity = 1;
      else if (count >= 3 && count <= 4) intensity = 2;
      else if (count >= 5 && count <= 7) intensity = 3;
      else if (count >= 8) intensity = 4;

      days.push({
        date: d,
        dateStr,
        completedTasks: completed,
        completedCount: count,
        meetingCount: mCount,
        focusMinutes: fMins,
        intensity,
      });
    }
    return days;
  }, [tasks, meetings, focusMinutesMap, today]);

  const getColorClass = (intensity: number) => {
    switch (intensity) {
      case 0:
        return "bg-paper-tint border-paper-line hover:border-forest/40";
      case 1:
        return "bg-emerald-200 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800";
      case 2:
        return "bg-emerald-400 dark:bg-emerald-800 border-emerald-500 dark:border-emerald-700";
      case 3:
        return "bg-emerald-600 dark:bg-emerald-600 border-emerald-700 dark:border-emerald-500";
      case 4:
        return "bg-emerald-800 dark:bg-emerald-400 border-emerald-900 dark:border-emerald-300";
      default:
        return "bg-paper-tint border-paper-line";
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-paper-line pb-3">
        <div>
          <h3 className="font-display text-base font-semibold text-ink">Yearly Productivity Heatmap</h3>
          <p className="text-xs text-ink-muted">365 days completion activity grid</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span>Less</span>
          <div className="h-3 w-3 rounded-xs bg-paper-tint border border-paper-line" />
          <div className="h-3 w-3 rounded-xs bg-emerald-200 dark:bg-emerald-950" />
          <div className="h-3 w-3 rounded-xs bg-emerald-400 dark:bg-emerald-800" />
          <div className="h-3 w-3 rounded-xs bg-emerald-600 dark:bg-emerald-600" />
          <div className="h-3 w-3 rounded-xs bg-emerald-800 dark:bg-emerald-400" />
          <span>More</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid grid-rows-7 grid-flow-col gap-1 min-w-[720px]">
          {heatmapDays.map((day) => {
            const formattedDate = format(day.date, "MMM d, yyyy");
            const tooltipText = `${formattedDate}\nCompleted Tasks: ${day.completedCount}\nMeetings: ${day.meetingCount}\nFocus Time: ${day.focusMinutes}m`;

            return (
              <button
                key={day.dateStr}
                type="button"
                onClick={() => setSelectedDay(day)}
                title={tooltipText}
                className={`h-3.5 w-3.5 rounded-xs border transition-all duration-150 transform hover:scale-125 focus:outline-none ${getColorClass(
                  day.intensity
                )}`}
              />
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <Dialog
          open={Boolean(selectedDay)}
          onClose={() => setSelectedDay(null)}
          title={`Completed Tasks - ${format(selectedDay.date, "MMMM d, yyyy")}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 p-3 bg-paper-tint rounded-lg text-center text-xs font-medium">
              <div>
                <p className="text-ink-muted">Tasks Done</p>
                <p className="text-sm font-bold text-forest">{selectedDay.completedCount}</p>
              </div>
              <div>
                <p className="text-ink-muted">Meetings</p>
                <p className="text-sm font-bold text-sky-600">{selectedDay.meetingCount}</p>
              </div>
              <div>
                <p className="text-ink-muted">Focus Time</p>
                <p className="text-sm font-bold text-amber-600">{selectedDay.focusMinutes}m</p>
              </div>
            </div>

            <h4 className="text-xs font-semibold uppercase text-ink-muted tracking-wider">
              Completed Tasks ({selectedDay.completedTasks.length})
            </h4>

            {selectedDay.completedTasks.length === 0 ? (
              <p className="text-xs text-ink-muted italic py-4 text-center">
                No completed tasks recorded for this date.
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {selectedDay.completedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2.5 bg-paper rounded border border-paper-line text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-forest shrink-0" />
                      <span className="font-medium text-ink line-through text-ink-muted">{t.title}</span>
                    </div>
                    {t.completed_at && (
                      <span className="font-mono text-[10px] text-ink-faint">
                        {format(new Date(t.completed_at), "HH:mm")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Dialog>
      )}
    </Card>
  );
}
