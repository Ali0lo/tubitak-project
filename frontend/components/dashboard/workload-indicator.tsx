"use client";

import React, { useMemo } from "react";
import { Task } from "@/types/task";
import { Meeting } from "@/types/meeting";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Battery, BatteryCharging, BatteryWarning } from "lucide-react";

interface WorkloadIndicatorProps {
  tasks: Task[];
  meetings: Meeting[];
}

export type WorkloadLevel = "Low" | "Medium" | "High" | "Overloaded";

export function WorkloadIndicator({ tasks, meetings }: WorkloadIndicatorProps) {
  const today = useMemo(() => new Date(), []);

  const workloadCalc = useMemo(() => {
    const todayTasks = tasks.filter(
      (t) =>
        t.status !== "completed" &&
        t.status !== "cancelled" &&
        (t.is_due_today || t.is_overdue)
    );

    const taskScore = todayTasks.reduce((acc, t) => {
      let weight = 1;
      if (t.priority === "urgent") weight = 3;
      if (t.priority === "high") weight = 2;
      if (t.priority === "medium") weight = 1;
      if (t.priority === "low") weight = 0.5;
      if (t.is_overdue) weight += 1;
      return acc + weight;
    }, 0);

    const todayMeetings = meetings.filter((m) => m.status === "scheduled");
    const meetingMinutes = todayMeetings.reduce((acc, m) => {
      const start = new Date(m.start_time).getTime();
      const end = new Date(m.end_time).getTime();
      const mins = Math.max(15, Math.round((end - start) / (1000 * 60)));
      return acc + mins;
    }, 0);

    const meetingScore = meetingMinutes / 30; // 1 point per 30 mins
    const totalScore = taskScore + meetingScore;

    let level: WorkloadLevel = "Low";
    let color = "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800";
    let icon = BatteryCharging;
    let recommendation = "Your schedule looks light and manageable today.";

    if (totalScore >= 3 && totalScore < 7) {
      level = "Medium";
      color = "text-sky-600 bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800";
      icon = Battery;
      recommendation = "Optimal productivity workload balance.";
    } else if (totalScore >= 7 && totalScore < 12) {
      level = "High";
      color = "text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800";
      icon = BatteryWarning;
      recommendation = "You have a busy day! Consider delegating or focusing on top priorities.";
    } else if (totalScore >= 12) {
      level = "Overloaded";
      color = "text-red-600 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800";
      icon = AlertTriangle;
      recommendation = "High risk of burnout today! We recommend rescheduling non-urgent tasks.";
    }

    return {
      level,
      color,
      icon,
      totalScore: Math.round(totalScore * 10) / 10,
      todayTaskCount: todayTasks.length,
      todayMeetingMins: meetingMinutes,
      recommendation,
    };
  }, [tasks, meetings]);

  const IconComponent = workloadCalc.icon;

  return (
    <Card className={`p-5 space-y-3 border ${workloadCalc.color}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconComponent className="h-5 w-5" />
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider">
            Daily Workload: {workloadCalc.level}
          </h3>
        </div>
        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-paper/60 border border-paper-line">
          Score: {workloadCalc.totalScore}
        </span>
      </div>

      <p className="text-xs font-medium text-ink leading-relaxed">
        {workloadCalc.recommendation}
      </p>

      <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
        <div className="p-2 bg-paper/80 rounded border border-paper-line">
          <span className="text-ink-muted">Active Today Tasks: </span>
          <span className="font-bold text-ink">{workloadCalc.todayTaskCount}</span>
        </div>
        <div className="p-2 bg-paper/80 rounded border border-paper-line">
          <span className="text-ink-muted">Meeting Duration: </span>
          <span className="font-bold text-ink">{workloadCalc.todayMeetingMins} mins</span>
        </div>
      </div>
    </Card>
  );
}
