"use client";

import { Select } from "@/components/ui/select";
import type { TaskFilters, TaskPriority, TaskStatus } from "@/types";

interface TaskFiltersBarProps {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
}

const STATUS_OPTIONS: TaskStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];
const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high", "urgent"];

export function TaskFiltersBar({ filters, onChange }: TaskFiltersBarProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Select
        aria-label="Filter by status"
        value={filters.status ?? ""}
        onChange={(event) =>
          onChange({
            ...filters,
            status: (event.target.value || undefined) as
              | TaskStatus
              | undefined,
          })
        }
        className="w-44"
      >
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {status.replace("_", " ")}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by priority"
        value={filters.priority ?? ""}
        onChange={(event) =>
          onChange({
            ...filters,
            priority: (event.target.value || undefined) as
              | TaskPriority
              | undefined,
          })
        }
        className="w-44"
      >
        <option value="">All priorities</option>
        {PRIORITY_OPTIONS.map((priority) => (
          <option key={priority} value={priority}>
            {priority}
          </option>
        ))}
      </Select>
    </div>
  );
}
