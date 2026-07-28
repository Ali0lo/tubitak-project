"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { TaskCard } from "@/components/tasks/task-card";
import { useTasks } from "@/hooks/use-tasks";
import { EmptyState } from "@/components/ui/empty-state";
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
      <EmptyState
        title="Nothing on the ledger yet!"
        description="Your task workspace is clear. Create a new task or use natural language bulk actions above."
        iconType="cat"
      />
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
