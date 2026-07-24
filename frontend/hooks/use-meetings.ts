"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type {
  Meeting,
  MeetingCreateInput,
  MeetingFilters,
  PageResponse,
  ParticipantResponseStatus,
} from "@/types";

const meetingsKey = (filters: MeetingFilters = {}) =>
  ["meetings", filters] as const;

export function useMeetings(filters: MeetingFilters = {}) {
  return useQuery({
    queryKey: meetingsKey(filters),
    queryFn: () =>
      apiClient.get<PageResponse<Meeting>>("/api/v1/meetings", {
        status: filters.status,
        starts_after: filters.starts_after,
        starts_before: filters.starts_before,
        overdue: filters.overdue,
        missed: filters.missed,
        today: filters.today,
        upcoming: filters.upcoming,
        page_size: 100,
      }),
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MeetingCreateInput) =>
      apiClient.post<Meeting>("/api/v1/meetings", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useCancelMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (meetingId: string) =>
      apiClient.post<Meeting>(`/api/v1/meetings/${meetingId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (meetingId: string) =>
      apiClient.delete<void>(`/api/v1/meetings/${meetingId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useUpdateParticipantResponse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      meetingId,
      participantId,
      responseStatus,
    }: {
      meetingId: string;
      participantId: string;
      responseStatus: ParticipantResponseStatus;
    }) =>
      apiClient.patch<Meeting>(
        `/api/v1/meetings/${meetingId}/participants/${participantId}`,
        { response_status: responseStatus }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}
