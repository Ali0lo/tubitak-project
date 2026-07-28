"use client";

import React, { useState } from "react";
import { Task } from "@/types/task";
import { useUpdateTask } from "@/hooks/use-tasks";
import { useCreateSubtask } from "@/hooks/use-subtasks";
import { useSendMessage } from "@/hooks/use-chat";
import { Sparkles, ListTree, Calendar, AlertCircle, Clock, Bell, Layers, Check } from "lucide-react";

interface AITaskSuggestionsProps {
  task: Task;
}

export function AITaskSuggestions({ task }: AITaskSuggestionsProps) {
  const [appliedAction, setAppliedAction] = useState<string | null>(null);
  const updateTask = useUpdateTask();
  const createSubtask = useCreateSubtask(task.id);
  const sendMessageMutation = useSendMessage();

  const handleSplitSubtasks = () => {
    setAppliedAction("split");
    const subtaskTitles = [
      `Research requirement details for ${task.title}`,
      `Draft implementation plan for ${task.title}`,
      `Review & verify output for ${task.title}`,
    ];
    subtaskTitles.forEach((title) => {
      createSubtask.mutate({ title });
    });
  };

  const handleIncreasePriority = () => {
    setAppliedAction("priority");
    updateTask.mutate({ taskId: task.id, input: { priority: "urgent" } });
  };

  const handleMoveDueDate = () => {
    setAppliedAction("date");
    const nextDay = new Date(Date.now() + 86400000 * 2).toISOString();
    updateTask.mutate({ taskId: task.id, input: { due_date: nextDay } });
  };

  const handleEstimateDuration = () => {
    setAppliedAction("estimate");
    sendMessageMutation.mutate({
      message: `Estimate duration in minutes for task titled "${task.title}"`,
    });
  };

  return (
    <div className="space-y-3 p-4 bg-paper-tint/60 rounded-xl border border-paper-line">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-forest" />
        <h4 className="font-display text-xs font-bold uppercase tracking-wider text-ink">
          AI Smart Suggestions
        </h4>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <button
          type="button"
          onClick={handleSplitSubtasks}
          className="flex items-center gap-1.5 p-2 bg-paper hover:bg-paper-line/50 rounded-lg border border-paper-line font-medium text-ink transition-colors text-left"
        >
          <ListTree className="h-3.5 w-3.5 text-sky-600 shrink-0" />
          <span>Split Subtasks</span>
          {appliedAction === "split" && <Check className="h-3 w-3 text-forest ml-auto" />}
        </button>

        <button
          type="button"
          onClick={handleIncreasePriority}
          className="flex items-center gap-1.5 p-2 bg-paper hover:bg-paper-line/50 rounded-lg border border-paper-line font-medium text-ink transition-colors text-left"
        >
          <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
          <span>Bump Priority</span>
          {appliedAction === "priority" && <Check className="h-3 w-3 text-forest ml-auto" />}
        </button>

        <button
          type="button"
          onClick={handleMoveDueDate}
          className="flex items-center gap-1.5 p-2 bg-paper hover:bg-paper-line/50 rounded-lg border border-paper-line font-medium text-ink transition-colors text-left"
        >
          <Calendar className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span>Move +2 Days</span>
          {appliedAction === "date" && <Check className="h-3 w-3 text-forest ml-auto" />}
        </button>

        <button
          type="button"
          onClick={handleEstimateDuration}
          className="flex items-center gap-1.5 p-2 bg-paper hover:bg-paper-line/50 rounded-lg border border-paper-line font-medium text-ink transition-colors text-left"
        >
          <Clock className="h-3.5 w-3.5 text-purple-600 shrink-0" />
          <span>Estimate Time</span>
          {appliedAction === "estimate" && <Check className="h-3 w-3 text-forest ml-auto" />}
        </button>
      </div>

      {sendMessageMutation.isPending && (
        <p className="text-[11px] font-mono text-ink-muted">AI is processing suggestion...</p>
      )}
      {(sendMessageMutation.data?.message?.content || (sendMessageMutation.data as any)?.response) && (
        <div className="p-2.5 bg-paper rounded border border-paper-line text-xs font-mono text-forest">
          {sendMessageMutation.data?.message?.content || (sendMessageMutation.data as any)?.response}
        </div>
      )}
    </div>
  );
}
