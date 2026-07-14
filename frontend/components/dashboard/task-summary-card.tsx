"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useTasks } from "@/hooks/use-tasks";
import { formatDateLabel, formatTimestamp } from "@/lib/utils";

export function TaskSummaryCard() {
  const { data, isLoading } = useTasks({ status: "pending" });

  const relevantTasks = (data?.items ?? [])
    .filter((task) => task.due_date)
    .sort(
      (a, b) =>
        new Date(a.due_date as string).getTime() -
        new Date(b.due_date as string).getTime()
    )
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks due soon</CardTitle>
        <Link
          href="/tasks"
          className="focus-ring rounded-seal font-mono text-xs uppercase tracking-wide text-forest hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      {isLoading ? (
        <Spinner label="Loading tasks" />
      ) : relevantTasks.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-muted">
          Nothing due — you&apos;re clear for now.
        </p>
      ) : (
        <div className="py-1">
          {relevantTasks.map((task) => (
            <div key={task.id} className="ledger-line px-5">
              <span className="ledger-stamp">
                {formatDateLabel(task.due_date as string)}
                <br />
                {formatTimestamp(task.due_date as string)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="ledger-title truncate">{task.title}</p>
              </div>
              <Badge tone={task.priority === "urgent" ? "brick" : "neutral"}>
                {task.priority}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
