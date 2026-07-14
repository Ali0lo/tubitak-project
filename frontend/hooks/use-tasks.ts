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

const tasksKey = (filters: TaskFilters = {}) => ["tasks", filters] as const;

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: tasksKey(filters),
    queryFn: () =>
      apiClient.get<PageResponse<Task>>("/api/v1/tasks", {
        status: filters.status,
        priority: filters.priority,
        tag: filters.tag,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
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
