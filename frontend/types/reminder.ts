export interface Reminder {
  id: string;
  user_id: string;
  task_id: string | null;
  meeting_id: string | null;
  remind_at: string;
  message: string | null;
  is_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReminderCreateInput {
  remind_at: string;
  message?: string;
  task_id?: string;
  meeting_id?: string;
}

export interface ReminderUpdateInput {
  remind_at?: string;
  message?: string;
}
