"use client";

import React, { useMemo } from "react";
import { Task } from "@/types/task";
import { Card } from "@/components/ui/card";
import { Layers, AlertTriangle, CheckCircle2, Clock, Sparkles } from "lucide-react";

interface AIProjectSummaryCardProps {
  tasks: Task[];
  selectedTag?: string;
}

export function AIProjectSummaryCard({ tasks, selectedTag }: AIProjectSummaryCardProps) {
  const filteredTasks = useMemo(() => {
    if (!selectedTag) return tasks;
    return tasks.filter((t) => t.tags.some((tag) => tag.name.toLowerCase() === selectedTag.toLowerCase()));
  }, [tasks, selectedTag]);

  const summary = useMemo(() => {
    const total = filteredTasks.length || 1;
    const completed = filteredTasks.filter((t) => t.status === "completed").length;
    const overdue = filteredTasks.filter((t) => t.is_overdue && t.status !== "completed").length;
    const urgent = filteredTasks.filter((t) => t.priority === "urgent" && t.status !== "completed").length;

    const completionPercent = Math.round((completed / total) * 100);
    const riskLevel = overdue > 0 || urgent > 2 ? "High Risk" : overdue > 0 ? "Medium Risk" : "Low Risk";
    const riskColor = riskLevel === "High Risk" ? "text-red-600 bg-red-50 dark:bg-red-950/20" : "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20";

    return {
      total: filteredTasks.length,
      completed,
      remaining: filteredTasks.length - completed,
      completionPercent,
      overdue,
      urgent,
      riskLevel,
      riskColor,
    };
  }, [filteredTasks]);

  if (summary.total === 0) return null;

  return (
    <Card className="p-4 space-y-3 bg-paper-tint/50 border-paper-line">
      <div className="flex items-center justify-between border-b border-paper-line pb-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-sky-600" />
          <h4 className="font-display text-xs font-bold uppercase tracking-wider text-ink">
            Project AI Summary {selectedTag ? `(#${selectedTag})` : "(All Workspace Tasks)"}
          </h4>
        </div>
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-paper-line ${summary.riskColor}`}>
          {summary.riskLevel}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-2 bg-paper rounded border border-paper-line">
          <span className="text-ink-muted">Progress</span>
          <p className="font-bold text-forest text-sm">{summary.completionPercent}%</p>
        </div>
        <div className="p-2 bg-paper rounded border border-paper-line">
          <span className="text-ink-muted">Completed</span>
          <p className="font-bold text-ink text-sm">{summary.completed} / {summary.total}</p>
        </div>
        <div className="p-2 bg-paper rounded border border-paper-line">
          <span className="text-ink-muted">Remaining</span>
          <p className="font-bold text-amber-600 text-sm">{summary.remaining}</p>
        </div>
        <div className="p-2 bg-paper rounded border border-paper-line">
          <span className="text-ink-muted">Overdue Risks</span>
          <p className="font-bold text-red-600 text-sm">{summary.overdue}</p>
        </div>
      </div>
    </Card>
  );
}
