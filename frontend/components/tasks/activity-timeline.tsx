"use client";

import { Activity, CheckCircle2, Clock, MessageSquare, Plus, Tag, Edit3 } from "lucide-react";
import { useTaskActivity } from "@/hooks/use-task-activity";
import { formatTimestamp } from "@/lib/utils";

interface ActivityTimelineProps {
  taskId: string;
}

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  created: Plus,
  completed: CheckCircle2,
  subtask_added: Plus,
  subtask_completed: CheckCircle2,
  subtask_deleted: Edit3,
  tag_added: Tag,
  tag_removed: Tag,
  comment_added: MessageSquare,
  status_changed: Activity,
  priority_changed: Activity,
  due_date_changed: Clock,
};

export function ActivityTimeline({ taskId }: ActivityTimelineProps) {
  const { data: activities = [], isLoading } = useTaskActivity(taskId);

  if (isLoading) {
    return <div className="py-4 text-center text-xs text-ink-faint">Loading activity timeline...</div>;
  }

  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-paper-line p-4 text-center text-xs text-ink-faint">
        No activity recorded yet for this task.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
        Activity Timeline
      </h4>

      <div className="relative pl-4 border-l-2 border-paper-line space-y-4">
        {activities.map((item) => {
          const Icon = ACTION_ICONS[item.action] || Activity;
          const formattedAction = item.action.replace("_", " ");

          return (
            <div key={item.id} className="relative group">
              {/* Timeline dot */}
              <div className="absolute -left-[21px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-paper-line bg-paper text-ink-muted">
                <Icon className="h-3 w-3" />
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold capitalize text-ink">
                    {formattedAction}
                  </span>
                  <span className="text-[10px] text-ink-faint">
                    {formatTimestamp(item.created_at)}
                  </span>
                </div>
                {item.details && (
                  <p className="mt-0.5 text-xs text-ink-muted">{item.details}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
