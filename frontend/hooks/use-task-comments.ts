"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { TaskComment, TaskCommentCreateInput } from "@/types";

const commentsKey = (taskId?: string | null) => ["task-comments", taskId] as const;

export function useTaskComments(taskId?: string | null) {
  return useQuery({
    queryKey: commentsKey(taskId),
    queryFn: () => apiClient.get<TaskComment[]>(`/api/v1/tasks/${taskId}/comments`),
    enabled: Boolean(taskId),
  });
}

export function useCreateComment(taskId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TaskCommentCreateInput) =>
      apiClient.post<TaskComment>(`/api/v1/tasks/${taskId}/comments`, input),
    onMutate: async (newComment) => {
      await queryClient.cancelQueries({ queryKey: commentsKey(taskId) });
      const previousComments =
        queryClient.getQueryData<TaskComment[]>(commentsKey(taskId)) || [];

      const optimisticComment: TaskComment = {
        id: `temp-${Date.now()}`,
        task_id: taskId || "",
        user_id: "temp-user",
        author_name: newComment.author_name || "User",
        message: newComment.message,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<TaskComment[]>(commentsKey(taskId), [
        ...previousComments,
        optimisticComment,
      ]);

      return { previousComments };
    },
    onError: (_err, _newComment, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(commentsKey(taskId), context.previousComments);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentsKey(taskId) });
      queryClient.invalidateQueries({ queryKey: ["task-activities", taskId] });
    },
  });
}
