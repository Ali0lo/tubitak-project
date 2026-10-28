"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type {
  PageResponse,
  Task,
  TaskCreateInput,
  TaskFilters,
  TaskUpdateInput,
} from "@/types";

import { triggerTaskCompletionEffect } from "@/lib/completion";

const tasksKey = (filters: TaskFilters = {}) => ["tasks", filters] as const;

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: tasksKey(filters),
    queryFn: () =>
      apiClient.get<PageResponse<Task>>("/api/v1/tasks", {
        status: filters.status,
        priority: filters.priority,
        tag: filters.tag,
        overdue: filters.overdue,
        today: filters.today,
        upcoming: filters.upcoming,
        recurring: filters.recurring,
        page_size: 100,
      }),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskCreateInput) =>
      apiClient.post<Task>("/api/v1/tasks", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      input,
    }: {
      taskId: string;
      input: TaskUpdateInput;
    }) => apiClient.patch<Task>(`/api/v1/tasks/${taskId}`, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (variables.input.status === "completed") {
        triggerTaskCompletionEffect();
      }
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      apiClient.delete<void>(`/api/v1/tasks/${taskId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useRescheduleOverdue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskIds,
      newDueDate,
    }: {
      taskIds?: string[];
      newDueDate: string;
    }) =>
      apiClient.post<Task[]>("/api/v1/tasks/overdue/reschedule", {
        task_ids: taskIds,
        new_due_date: newDueDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useCompleteOverdue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskIds?: string[]) =>
      apiClient.post<Task[]>("/api/v1/tasks/overdue/complete", taskIds ? { task_ids: taskIds } : {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      triggerTaskCompletionEffect();
    },
  });
}
