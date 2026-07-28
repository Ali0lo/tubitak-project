"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Subtask, SubtaskCreateInput, SubtaskUpdateInput } from "@/types";

const subtasksKey = (taskId?: string | null) => ["subtasks", taskId] as const;

export function useSubtasks(taskId?: string | null) {
  return useQuery({
    queryKey: subtasksKey(taskId),
    queryFn: () => apiClient.get<Subtask[]>(`/api/v1/tasks/${taskId}/subtasks`),
    enabled: Boolean(taskId),
  });
}

export function useCreateSubtask(taskId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubtaskCreateInput) =>
      apiClient.post<Subtask>(`/api/v1/tasks/${taskId}/subtasks`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subtasksKey(taskId) });
      queryClient.invalidateQueries({ queryKey: ["task-activities", taskId] });
    },
  });
}

export function useUpdateSubtask(taskId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      subtaskId,
      input,
    }: {
      subtaskId: string;
      input: SubtaskUpdateInput;
    }) =>
      apiClient.patch<Subtask>(
        `/api/v1/tasks/${taskId}/subtasks/${subtaskId}`,
        input
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subtasksKey(taskId) });
      queryClient.invalidateQueries({ queryKey: ["task-activities", taskId] });
    },
  });
}

export function useDeleteSubtask(taskId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subtaskId: string) =>
      apiClient.delete<void>(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subtasksKey(taskId) });
      queryClient.invalidateQueries({ queryKey: ["task-activities", taskId] });
    },
  });
}

export function useReorderSubtasks(taskId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subtaskIds: string[]) =>
      apiClient.post<Subtask[]>(`/api/v1/tasks/${taskId}/subtasks/reorder`, {
        subtask_ids: subtaskIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subtasksKey(taskId) });
    },
  });
}
