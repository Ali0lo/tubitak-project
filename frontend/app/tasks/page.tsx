"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { TaskFiltersBar } from "@/components/tasks/task-filters";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskList } from "@/components/tasks/task-list";
import type { TaskFilters } from "@/types";

export default function TasksPage() {
  const [filters, setFilters] = useState<TaskFilters>({});
  const [isDialogOpen, setDialogOpen] = useState(false);

  return (
    <AppShell title="Tasks">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TaskFiltersBar filters={filters} onChange={setFilters} />
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New task
        </Button>
      </div>
      <TaskList filters={filters} />
      <TaskFormDialog open={isDialogOpen} onClose={() => setDialogOpen(false)} />
    </AppShell>
  );
}
