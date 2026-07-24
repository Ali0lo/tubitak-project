export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskTag {
  id: string;
  name: string;
}

export type RecurrenceFrequency =
  | "none"
  | "daily"
  | "weekdays_only"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "yearly"
  | "custom";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval?: number;
  unit?: string;
}

export interface TaskTag {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  is_recurring: boolean;
  recurrence_rule: RecurrenceRule | null;
  recurrence_parent_id: string | null;
  created_at: string;
  updated_at: string;
  tags: TaskTag[];

  // Computed overdue & reminder fields
  is_overdue?: boolean;
  overdue_since?: string | null;
  overdue_duration?: string | null;
  days_overdue?: number | null;
  is_due_today?: boolean;
  next_reminder_at?: string | null;
  last_notification_sent?: string | null;
}

export interface TaskCreateInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: string;
  tags?: string[];
  is_recurring?: boolean;
  recurrence_rule?: RecurrenceRule;
}

export interface TaskUpdateInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  is_recurring?: boolean;
  recurrence_rule?: RecurrenceRule;
  recurrence_scope?: "this_only" | "future" | "all";
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  tag?: string;
  overdue?: boolean;
  today?: boolean;
  upcoming?: boolean;
  recurring?: boolean;
}

