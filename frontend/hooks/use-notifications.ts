"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { PageResponse } from "@/types";
import type { NotificationItem } from "@/components/notifications/notification-bell";

export function useNotifications(pageSize = 20, unreadOnly = false) {
  return useQuery({
    queryKey: ["notifications", { pageSize, unreadOnly }] as const,
    queryFn: () =>
      apiClient.get<PageResponse<NotificationItem>>("/api/v1/notifications", {
        page_size: pageSize,
        unread_only: unreadOnly,
      }),
    refetchInterval: 8000, // Poll every 8 seconds
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"] as const,
    queryFn: () =>
      apiClient.get<{ unread_count: number }>("/api/v1/notifications/unread-count"),
    refetchInterval: 8000,
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      apiClient.patch<NotificationItem>(`/api/v1/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post<{ marked_read: number }>("/api/v1/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
