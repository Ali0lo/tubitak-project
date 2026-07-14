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
  created_at: string;
  updated_at: string;
  participants: Participant[];
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
