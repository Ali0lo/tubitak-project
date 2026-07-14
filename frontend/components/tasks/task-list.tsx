"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { TaskCard } from "@/components/tasks/task-card";
import { useTasks } from "@/hooks/use-tasks";
import type { TaskFilters } from "@/types";

interface TaskListProps {
  filters: TaskFilters;
}

export function TaskList({ filters }: TaskListProps) {
  const { data, isLoading, isError } = useTasks(filters);

  if (isLoading) {
    return (
      <Card>
        <Spinner label="Loading tasks" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-brick">
            Couldn&apos;t load your tasks. Try refreshing the page.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="font-display text-lg text-ink">
            Nothing on the ledger yet
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Add a task, or tell the assistant what you need to do.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <div className="py-1">
        {data.items.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </Card>
  );
}
