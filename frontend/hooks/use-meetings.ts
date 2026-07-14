"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type {
  Meeting,
  MeetingCreateInput,
  MeetingStatus,
  PageResponse,
  ParticipantResponseStatus,
} from "@/types";

interface MeetingFilters {
  status?: MeetingStatus;
}

const meetingsKey = (filters: MeetingFilters = {}) =>
  ["meetings", filters] as const;

export function useMeetings(filters: MeetingFilters = {}) {
  return useQuery({
    queryKey: meetingsKey(filters),
    queryFn: () =>
      apiClient.get<PageResponse<Meeting>>("/api/v1/meetings", {
        status: filters.status,
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
