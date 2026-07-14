"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { PageResponse, Reminder, ReminderCreateInput } from "@/types";

export function useReminders(isSent?: boolean) {
  return useQuery({
    queryKey: ["reminders", { isSent }] as const,
    queryFn: () =>
      apiClient.get<PageResponse<Reminder>>("/api/v1/reminders", {
        is_sent: isSent,
        page_size: 100,
      }),
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReminderCreateInput) =>
      apiClient.post<Reminder>("/api/v1/reminders", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reminderId: string) =>
      apiClient.delete<void>(`/api/v1/reminders/${reminderId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });
}
