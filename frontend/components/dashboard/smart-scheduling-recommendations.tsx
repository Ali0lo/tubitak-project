"use client";

import React, { useState, useMemo } from "react";
import { Task } from "@/types/task";
import { Meeting } from "@/types/meeting";
import { Card } from "@/components/ui/card";
import { useUpdateTask } from "@/hooks/use-tasks";
import { Sparkles, Calendar, Clock, ArrowRight, Check } from "lucide-react";

interface SmartSchedulingRecommendationsProps {
  tasks: Task[];
  meetings: Meeting[];
}

export function SmartSchedulingRecommendations({ tasks, meetings }: SmartSchedulingRecommendationsProps) {
  const [appliedRecs, setAppliedRecs] = useState<Record<string, boolean>>({});
  const updateTask = useUpdateTask();

  const recommendations = useMemo(() => {
    const recs: Array<{ id: string; title: string; subtitle: string; taskId?: string; actionType: string }> = [];
    const overdueTasks = tasks.filter((t) => t.is_overdue);
    const urgentTasks = tasks.filter((t) => t.priority === "urgent" && t.status !== "completed");

    const topOverdue = overdueTasks[0];
    if (topOverdue) {
      recs.push({
        id: `rec-overdue-${topOverdue.id}`,
        taskId: topOverdue.id,
        title: `Reschedule Overdue: "${topOverdue.title}"`,
        subtitle: "AI recommends rescheduling to tomorrow morning at 09:00 AM for optimal focus.",
        actionType: "reschedule_tomorrow",
      });
    }

    const topUrgent = urgentTasks[0];
    if (topUrgent) {
      recs.push({
        id: `rec-urgent-${topUrgent.id}`,
        taskId: topUrgent.id,
        title: `Priority Slot: "${topUrgent.title}"`,
        subtitle: "Recommended execution slot: Today 02:00 PM (30 min duration).",
        actionType: "priority_slot",
      });
    }

    recs.push({
      id: "rec-meeting-buffer",
      title: "Meeting Buffer Recommendation",
      subtitle: "AI suggests 15-minute preparation buffer before upcoming team syncs.",
      actionType: "buffer_info",
    });

    return recs;
  }, [tasks, meetings.length]);

  const handleApplyRec = (rec: (typeof recommendations)[0]) => {
    setAppliedRecs((prev) => ({ ...prev, [rec.id]: true }));

    if (rec.taskId && rec.actionType === "reschedule_tomorrow") {
      const tomorrow = new Date(Date.now() + 86400000);
      tomorrow.setHours(9, 0, 0, 0);
      updateTask.mutate({ taskId: rec.taskId, input: { due_date: tomorrow.toISOString() } });
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-paper-line pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-forest" />
          <div>
            <h3 className="font-display text-base font-semibold text-ink">Smart AI Scheduling Recommendations</h3>
            <p className="text-xs text-ink-muted">Non-intrusive timing & slot suggestions</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {recommendations.map((rec) => {
          const isApplied = appliedRecs[rec.id];
          return (
            <div
              key={rec.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-paper-tint/60 rounded-xl border border-paper-line gap-3 text-xs"
            >
              <div className="space-y-1">
                <p className="font-display font-semibold text-ink">{rec.title}</p>
                <p className="text-ink-muted leading-relaxed">{rec.subtitle}</p>
              </div>

              <button
                type="button"
                onClick={() => handleApplyRec(rec)}
                disabled={isApplied}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 flex items-center gap-1 ${
                  isApplied
                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300"
                    : "bg-forest hover:bg-forest/90 text-white shadow-2xs"
                }`}
              >
                {isApplied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Applied
                  </>
                ) : (
                  <>
                    <span>Apply Recommendation</span> <ArrowRight className="h-3 w-3" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
