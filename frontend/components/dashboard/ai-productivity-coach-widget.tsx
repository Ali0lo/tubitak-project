"use client";

import React, { useMemo, useState } from "react";
import { Task } from "@/types/task";
import { Card } from "@/components/ui/card";
import { Lightbulb, ChevronRight, ChevronLeft, Sparkles, TrendingUp } from "lucide-react";

interface AIProductivityCoachWidgetProps {
  tasks: Task[];
}

export function AIProductivityCoachWidget({ tasks }: AIProductivityCoachWidgetProps) {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const tips = useMemo(() => {
    const list: Array<{ title: string; body: string; tag: string }> = [
      {
        title: "Morning Peak Window",
        body: "You complete over 75% of your high-priority tasks before lunch. Schedule your hardest work between 09:00 AM - 11:30 AM.",
        tag: "Peak Focus",
      },
      {
        title: "End-of-Week Deadline Management",
        body: "Friday afternoon has the highest overdue rate. Try moving task due dates to Thursday evening to avoid weekend backlogs.",
        tag: "Overdue Prevention",
      },
      {
        title: "Async Monday Strategy",
        body: "Schedule deep focus slots on Monday mornings instead of team syncs for maximum weekly velocity.",
        tag: "Schedule Design",
      },
    ];
    return list;
  }, [tasks.length]);

  const activeTip = tips[currentTipIndex % tips.length] || tips[0];

  if (!activeTip) return null;

  return (
    <Card className="p-5 space-y-3 bg-gradient-to-r from-amber-50/50 via-paper to-paper border-amber-300/40">
      <div className="flex items-center justify-between border-b border-paper-line pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-lg">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-ink">AI Productivity Coach</h3>
            <p className="text-xs text-ink-muted">Personalized performance & scheduling tips</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentTipIndex((prev) => (prev > 0 ? prev - 1 : tips.length - 1))}
            className="p-1 rounded bg-paper border border-paper-line text-ink-muted hover:text-ink"
            title="Previous tip"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-mono text-ink-muted px-1">
            {currentTipIndex + 1}/{tips.length}
          </span>
          <button
            type="button"
            onClick={() => setCurrentTipIndex((prev) => (prev + 1) % tips.length)}
            className="p-1 rounded bg-paper border border-paper-line text-ink-muted hover:text-ink"
            title="Next tip"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3.5 bg-paper rounded-xl border border-paper-line space-y-1.5">
        <div className="flex items-center justify-between">
          <h4 className="font-display text-xs font-bold text-ink">{activeTip.title}</h4>
          <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {activeTip.tag}
          </span>
        </div>
        <p className="text-xs text-ink-muted leading-relaxed">{activeTip.body}</p>
      </div>
    </Card>
  );
}
