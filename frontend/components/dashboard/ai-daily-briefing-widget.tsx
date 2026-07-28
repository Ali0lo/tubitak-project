"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { format, isSameDay } from "date-fns";
import { Task } from "@/types/task";
import { Meeting } from "@/types/meeting";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSendMessage } from "@/hooks/use-chat";
import { Sparkles, RefreshCw, CheckCircle2, Clock, AlertTriangle, Video, ArrowRight } from "lucide-react";

interface AIDailyBriefingWidgetProps {
  tasks: Task[];
  meetings: Meeting[];
  onCompleteTask?: (taskId: string) => void;
}

export function AIDailyBriefingWidget({ tasks, meetings, onCompleteTask }: AIDailyBriefingWidgetProps) {
  const [briefingText, setBriefingText] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const sendMessageMutation = useSendMessage();

  const today = useMemo(() => new Date(), []);

  // Compute metrics for briefing payload
  const metrics = useMemo(() => {
    const todayTasks = tasks.filter(
      (t) =>
        t.status !== "completed" &&
        t.status !== "cancelled" &&
        (t.is_due_today || (t.due_date && isSameDay(new Date(t.due_date), today)))
    );

    const overdueTasks = tasks.filter((t) => t.is_overdue);
    const highPriorityTasks = tasks.filter(
      (t) => t.status !== "completed" && (t.priority === "urgent" || t.priority === "high")
    );
    const todayMeetings = meetings.filter(
      (m) => m.status === "scheduled" && isSameDay(new Date(m.start_time), today)
    );

    return {
      todayTaskCount: todayTasks.length,
      overdueCount: overdueTasks.length,
      highPriorityCount: highPriorityTasks.length,
      meetingCount: todayMeetings.length,
      topTaskTitle: overdueTasks[0]?.title || highPriorityTasks[0]?.title || todayTasks[0]?.title || "All caught up!",
    };
  }, [tasks, meetings, today]);

  const generateBriefing = useCallback(() => {
    const prompt = `Give me a concise 2-sentence morning productivity briefing based on my workspace stats: ${metrics.todayTaskCount} tasks due today, ${metrics.overdueCount} overdue tasks, ${metrics.meetingCount} meetings today, and top priority task "${metrics.topTaskTitle}".`;

    sendMessageMutation.mutate(
      { message: prompt },
      {
        onSuccess: (res) => {
          const text = res.message?.content || (res as any).response || `Focus first on "${metrics.topTaskTitle}". You have ${metrics.todayTaskCount} tasks and ${metrics.meetingCount} meetings scheduled today.`;
          setBriefingText(text);
          setIsCached(false);
          const cacheKey = `todotak-briefing-cache-${format(today, "yyyy-MM-dd")}`;
          localStorage.setItem(cacheKey, text);
        },
        onError: () => {
          const fallback = `Focus first on "${metrics.topTaskTitle}". You have ${metrics.todayTaskCount} tasks due today and ${metrics.overdueCount} overdue items requiring attention.`;
          setBriefingText(fallback);
        },
      }
    );
  }, [metrics, sendMessageMutation, today]);

  // Load cached briefing or trigger fetch
  useEffect(() => {
    const cacheKey = `todotak-briefing-cache-${format(today, "yyyy-MM-dd")}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setBriefingText(cached);
      setIsCached(true);
    } else {
      generateBriefing();
    }
  }, [today, generateBriefing]);

  return (
    <Card className="p-5 space-y-4 bg-gradient-to-r from-forest/10 via-paper to-paper border-forest/30 relative overflow-hidden">
      <div className="flex items-center justify-between border-b border-paper-line pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-forest/20 rounded-lg text-forest">
            <Sparkles className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-ink">Today&apos;s AI Briefing</h3>
            <p className="text-xs text-ink-muted">Automated morning summary & focus ordering</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isCached && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-paper-tint text-ink-muted border border-paper-line">
              Cached
            </span>
          )}
          <button
            type="button"
            onClick={generateBriefing}
            disabled={sendMessageMutation.isPending}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-paper border border-paper-line rounded-lg hover:bg-paper-tint text-ink transition-colors disabled:opacity-50"
            title="Refresh Briefing"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${sendMessageMutation.isPending ? "animate-spin text-forest" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Briefing Text */}
      <p className="text-xs text-ink font-medium leading-relaxed bg-paper/80 p-3 rounded-lg border border-paper-line">
        {sendMessageMutation.isPending ? "Analyzing today's agenda..." : briefingText}
      </p>

      {/* Quick Metrics Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs font-medium">
        <div className="p-2 bg-paper/80 rounded border border-paper-line flex items-center justify-between">
          <span className="text-ink-muted">Due Today</span>
          <span className="font-bold text-amber-600">{metrics.todayTaskCount}</span>
        </div>
        <div className="p-2 bg-paper/80 rounded border border-paper-line flex items-center justify-between">
          <span className="text-ink-muted">Overdue</span>
          <span className="font-bold text-red-600">{metrics.overdueCount}</span>
        </div>
        <div className="p-2 bg-paper/80 rounded border border-paper-line flex items-center justify-between">
          <span className="text-ink-muted">High Priority</span>
          <span className="font-bold text-forest">{metrics.highPriorityCount}</span>
        </div>
        <div className="p-2 bg-paper/80 rounded border border-paper-line flex items-center justify-between">
          <span className="text-ink-muted">Meetings</span>
          <span className="font-bold text-sky-600">{metrics.meetingCount}</span>
        </div>
      </div>
    </Card>
  );
}
