"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type {
  ChatRequest,
  ChatResponse,
  ConversationDetail,
  ConversationSummary,
  PageResponse,
} from "@/types";

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () =>
      apiClient.get<PageResponse<ConversationSummary>>(
        "/api/v1/ai/conversations",
        { page_size: 50 }
      ),
  });
}

export function useConversation(conversationId: string | null) {
  return useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () =>
      apiClient.get<ConversationDetail>(
        `/api/v1/ai/conversations/${conversationId}`
      ),
    enabled: Boolean(conversationId),
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ChatRequest) =>
      apiClient.post<ChatResponse>("/api/v1/ai/chat", payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({
        queryKey: ["conversation", data.conversation_id],
      });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      apiClient.delete<void>(`/api/v1/ai/conversations/${conversationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
