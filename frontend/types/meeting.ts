export type MeetingStatus = "scheduled" | "cancelled" | "completed";
export type ParticipantResponseStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "tentative";

export interface Participant {
  id: string;
  email: string;
  name: string | null;
  response_status: ParticipantResponseStatus;
}

export interface Meeting {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  status: MeetingStatus;
  is_recurring?: boolean;
  recurrence_rule?: any;
  created_at: string;
  updated_at: string;
  participants: Participant[];

  // Computed overdue & reminder fields
  is_overdue?: boolean;
  overdue_since?: string | null;
  overdue_duration?: string | null;
  next_reminder_at?: string | null;
  last_notification_sent?: string | null;
}

export interface ParticipantInput {
  email: string;
  name?: string;
}

export interface MeetingCreateInput {
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  participants?: ParticipantInput[];
}

export interface MeetingUpdateInput {
  title?: string;
  description?: string;
  location?: string;
  start_time?: string;
  end_time?: string;
  status?: MeetingStatus;
}

export interface MeetingFilters {
  status?: MeetingStatus;
  starts_after?: string;
  starts_before?: string;
  overdue?: boolean;
  missed?: boolean;
  today?: boolean;
  upcoming?: boolean;
}

