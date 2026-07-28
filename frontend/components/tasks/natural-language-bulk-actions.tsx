"use client";

import React, { useState } from "react";
import { Task } from "@/types/task";
import { useUpdateTask, useDeleteTask, useRescheduleOverdue, useCompleteOverdue } from "@/hooks/use-tasks";
import { useSendMessage } from "@/hooks/use-chat";
import { Card } from "@/components/ui/card";
import { Sparkles, Command, ArrowRight, Check } from "lucide-react";

interface NaturalLanguageBulkActionsProps {
  tasks: Task[];
}

export function NaturalLanguageBulkActions({ tasks }: NaturalLanguageBulkActionsProps) {
  const [commandText, setCommandText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const rescheduleOverdue = useRescheduleOverdue();
  const completeOverdue = useCompleteOverdue();
  const sendMessageMutation = useSendMessage();

  const handleExecuteCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandText.trim().toLowerCase();
    if (!cmd) return;

    if (cmd.includes("overdue") && (cmd.includes("tomorrow") || cmd.includes("move"))) {
      const overdueIds = tasks.filter((t) => t.is_overdue).map((t) => t.id);
      if (overdueIds.length > 0) {
        const tomorrow = new Date(Date.now() + 86400000).toISOString();
        rescheduleOverdue.mutate({ taskIds: overdueIds, newDueDate: tomorrow });
        setFeedback(`Moved ${overdueIds.length} overdue tasks to tomorrow.`);
      } else {
        setFeedback("No overdue tasks found to move.");
      }
    } else if (cmd.includes("recurring") && (cmd.includes("complete") || cmd.includes("finish"))) {
      const recurringTasks = tasks.filter((t) => t.is_recurring && t.status !== "completed");
      recurringTasks.forEach((t) => {
        updateTask.mutate({ taskId: t.id, input: { status: "completed" } });
      });
      setFeedback(`Completed ${recurringTasks.length} active recurring tasks.`);
    } else if (cmd.includes("completed") && cmd.includes("delete")) {
      const completedTasks = tasks.filter((t) => t.status === "completed");
      completedTasks.forEach((t) => {
        deleteTask.mutate(t.id);
      });
      setFeedback(`Deleted ${completedTasks.length} completed tasks.`);
    } else if (cmd.includes("high priority") || cmd.includes("urgent")) {
      const highPriorityTasks = tasks.filter((t) => t.priority === "high" || t.priority === "urgent");
      const afternoon = new Date();
      afternoon.setHours(14, 0, 0, 0);
      highPriorityTasks.forEach((t) => {
        updateTask.mutate({ taskId: t.id, input: { due_date: afternoon.toISOString() } });
      });
      setFeedback(`Scheduled ${highPriorityTasks.length} high priority tasks for this afternoon.`);
    } else {
      // Send to AI endpoint for interpretation
      sendMessageMutation.mutate(
        { message: `Execute natural language task action: "${cmd}"` },
        {
          onSuccess: (res) => {
            setFeedback(res.message?.content || (res as any).response || "Command processed successfully.");
          },
        }
      );
    }

    setCommandText("");
  };

  return (
    <Card className="p-4 bg-gradient-to-r from-forest/10 via-paper to-paper border-forest/30 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-forest" />
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink">
            Natural Language Bulk Action Command
          </h3>
        </div>
        <span className="font-mono text-[10px] text-ink-muted">Try: &quot;Move all overdue tasks to tomorrow&quot;</span>
      </div>

      <form onSubmit={handleExecuteCommand} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            placeholder="Type bulk command (e.g. 'Complete every recurring task' or 'Move overdue tasks to tomorrow')..."
            className="w-full pl-8 pr-3 py-2 text-xs font-mono bg-paper rounded-lg border border-paper-line focus:outline-none focus:border-forest"
          />
          <Command className="h-3.5 w-3.5 text-ink-muted absolute left-2.5 top-2.5" />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-forest hover:bg-forest/90 text-white font-medium text-xs rounded-lg shadow-2xs transition-colors shrink-0 flex items-center gap-1"
        >
          <span>Run Action</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </form>

      {feedback && (
        <div className="p-2.5 bg-paper rounded-lg border border-paper-line text-xs font-mono text-forest flex items-center gap-2">
          <Check className="h-3.5 w-3.5 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}
    </Card>
  );
}
