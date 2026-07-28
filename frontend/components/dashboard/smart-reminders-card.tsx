"use client";

import React, { useState, useMemo } from "react";
import { Meeting } from "@/types/meeting";
import { Task } from "@/types/task";
import { Card } from "@/components/ui/card";
import { Bell, Check, Clock, ShieldAlert } from "lucide-react";

interface SmartRemindersCardProps {
  meetings: Meeting[];
  tasks: Task[];
}

export function SmartRemindersCard({ meetings, tasks }: SmartRemindersCardProps) {
  const [confirmedReminders, setConfirmedReminders] = useState<Record<string, boolean>>({});

  const suggestions = useMemo(() => {
    const list: Array<{ id: string; title: string; subtitle: string }> = [];

    const upcomingMeetings = meetings.filter((m) => m.status === "scheduled");
    const topMeeting = upcomingMeetings[0];
    if (topMeeting) {
      list.push({
        id: `rem-meeting-${topMeeting.id}`,
        title: `Set 30-min Early Reminder: "${topMeeting.title}"`,
        subtitle: "Important upcoming sync. AI recommends setting an early notification 30 mins prior.",
      });
    }

    const overdueTasks = tasks.filter((t) => t.is_overdue);
    const topOverdue = overdueTasks[0];
    if (topOverdue) {
      list.push({
        id: `rem-overdue-${topOverdue.id}`,
        title: `Overdue Task Escalation Alert: "${topOverdue.title}"`,
        subtitle: "Recommend high-priority reminder nudge during quiet work window.",
      });
    }

    list.push({
      id: "rem-quiet-schedule",
      title: "Optimize Focus Window Quiet Hours",
      subtitle: "Mute non-urgent notifications between 09:00 AM - 11:30 AM based on your peak productivity.",
    });

    return list;
  }, [meetings, tasks]);

  const handleConfirm = (id: string) => {
    setConfirmedReminders((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-paper-line pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-amber-500" />
          <div>
            <h3 className="font-display text-base font-semibold text-ink">Smart Reminder Recommendations</h3>
            <p className="text-xs text-ink-muted">Adaptive notification timing & quiet schedules</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {suggestions.map((item) => {
          const isConfirmed = confirmedReminders[item.id];
          return (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-paper-tint/60 rounded-xl border border-paper-line gap-3 text-xs"
            >
              <div className="space-y-1">
                <p className="font-display font-semibold text-ink">{item.title}</p>
                <p className="text-ink-muted leading-relaxed">{item.subtitle}</p>
              </div>

              <button
                type="button"
                onClick={() => handleConfirm(item.id)}
                disabled={isConfirmed}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 flex items-center gap-1 ${
                  isConfirmed
                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300"
                    : "bg-amber-600 hover:bg-amber-700 text-white shadow-2xs"
                }`}
              >
                {isConfirmed ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Confirmed
                  </>
                ) : (
                  <span>Confirm Schedule</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
