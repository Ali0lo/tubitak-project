"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { CalendarView } from "@/components/calendar/calendar-view";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { TaskBoardView } from "@/components/tasks/task-board-view";
import { TaskDetailsDrawer } from "@/components/tasks/task-details-drawer";
import { TaskFiltersBar } from "@/components/tasks/task-filters";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskList } from "@/components/tasks/task-list";
import { TaskViewSwitcher, type TaskViewMode } from "@/components/tasks/task-view-switcher";
import { NaturalLanguageBulkActions } from "@/components/tasks/natural-language-bulk-actions";
import { AIProjectSummaryCard } from "@/components/tasks/ai-project-summary-card";
import { useTasks } from "@/hooks/use-tasks";
import type { TaskFilters } from "@/types";

export default function TasksPage() {
  const [filters, setFilters] = useState<TaskFilters>({});
  const [viewMode, setViewMode] = useState<TaskViewMode>("list");
  const [isDialogOpen, setDialogOpen] = useState(false);

  const { data: tasksData } = useTasks(filters);
  const tasks = useMemo(() => tasksData?.items ?? [], [tasksData]);

  return (
    <AppShell title="Tasks">
      <div className="space-y-4 mb-4">
        <NaturalLanguageBulkActions tasks={tasks} />
        <AIProjectSummaryCard tasks={tasks} selectedTag={filters.tag} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <TaskFiltersBar filters={filters} onChange={setFilters} />
            <TaskViewSwitcher mode={viewMode} onChange={setViewMode} />
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New task
          </Button>
        </div>
      </div>

      {viewMode === "list" && <TaskList filters={filters} />}
      {viewMode === "board" && (
        <TaskBoardView filters={filters} onNewTaskClick={() => setDialogOpen(true)} />
      )}
      {viewMode === "calendar" && <CalendarView />}

      <TaskFormDialog open={isDialogOpen} onClose={() => setDialogOpen(false)} />
      <TaskDetailsDrawer />
    </AppShell>
  );
}

