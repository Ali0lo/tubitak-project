"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { TaskActivity } from "@/types";

const activityKey = (taskId?: string | null) => ["task-activities", taskId] as const;

export function useTaskActivity(taskId?: string | null) {
  return useQuery({
    queryKey: activityKey(taskId),
    queryFn: () => apiClient.get<TaskActivity[]>(`/api/v1/tasks/${taskId}/activities`),
    enabled: Boolean(taskId),
  });
}
