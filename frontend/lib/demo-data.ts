import { Task, Meeting } from "@/types";
import type { NotificationItem } from "@/components/notifications/notification-bell";

export const DEMO_TASKS: Task[] = [
  {
    id: "demo-task-1",
    user_id: "demo-user",
    title: "🚀 Launch Todotak v2.0 Production Stack",
    description: "Verify all microservices, API Gateway rate limits, and SSL configuration before public release.",
    status: "in_progress",
    priority: "urgent",
    due_date: new Date(Date.now() + 3600000 * 4).toISOString(),
    completed_at: null,
    is_recurring: false,
    recurrence_rule: null,
    recurrence_parent_id: null,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
    tags: [{ id: "tag-1", name: "launch" }, { id: "tag-2", name: "devops" }],
    is_due_today: true,
    is_overdue: false,
  },
  {
    id: "demo-task-2",
    user_id: "demo-user",
    title: "⚡ Optimize React Query Cache & Micro-Animations",
    description: "Refine focus rings, pixel art mascot petting interactions, and keyboard shortcut listeners.",
    status: "completed",
    priority: "high",
    due_date: new Date(Date.now() - 86400000).toISOString(),
    completed_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    is_recurring: false,
    recurrence_rule: null,
    recurrence_parent_id: null,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date().toISOString(),
    tags: [{ id: "tag-3", name: "frontend" }, { id: "tag-4", name: "performance" }],
    is_due_today: false,
    is_overdue: false,
  },
  {
    id: "demo-task-3",
    user_id: "demo-user",
    title: "Overdue API Security Audit & Token Renewal",
    description: "Review JWT claims, refresh token rotation, and CORS origins across auth-service.",
    status: "pending",
    priority: "urgent",
    due_date: new Date(Date.now() - 86400000 * 2).toISOString(),
    completed_at: null,
    is_recurring: false,
    recurrence_rule: null,
    recurrence_parent_id: null,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date().toISOString(),
    tags: [{ id: "tag-5", name: "security" }],
    is_overdue: true,
    overdue_duration: "2 days overdue",
  },
  {
    id: "demo-task-4",
    user_id: "demo-user",
    title: "🔁 Weekly Infrastructure Health Review",
    description: "Inspect Grafana dashboard CPU/memory gauges and Prometheus error rates.",
    status: "pending",
    priority: "medium",
    due_date: new Date(Date.now() + 86400000 * 2).toISOString(),
    completed_at: null,
    is_recurring: true,
    recurrence_rule: { frequency: "weekly", interval: 1 },
    recurrence_parent_id: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    tags: [{ id: "tag-2", name: "devops" }],
    is_due_today: false,
    is_overdue: false,
  },
];

export const DEMO_MEETINGS: Meeting[] = [
  {
    id: "demo-meeting-1",
    user_id: "demo-user",
    title: "🤝 Product Architecture & AI Strategy Sync",
    description: "Discuss natural language bulk action features and tool-calling agent capabilities.",
    location: "Google Meet",
    meeting_link: "https://meet.google.com/abc-defg-hij",
    start_time: new Date(Date.now() + 3600000 * 2).toISOString(),
    end_time: new Date(Date.now() + 3600000 * 3).toISOString(),
    status: "scheduled",
    participants: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_overdue: false,
  },
  {
    id: "demo-meeting-2",
    user_id: "demo-user",
    title: "📊 Weekly Engineering All-Hands",
    description: "Team review of completion streaks, Pomodoro focus hours, and sprint roadmap.",
    location: "Zoom",
    meeting_link: "https://zoom.us/j/123456789",
    start_time: new Date(Date.now() + 86400000).toISOString(),
    end_time: new Date(Date.now() + 86400000 + 3600000).toISOString(),
    status: "scheduled",
    participants: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_overdue: false,
  },
];

export const DEMO_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "demo-notif-1",
    user_id: "demo-user",
    source: "meeting_reminder",
    source_reference_id: "demo-meeting-1",
    message: "Product Architecture & AI Strategy Sync starts at " + new Date(Date.now() + 3600000 * 2).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    scheduled_for: new Date(Date.now() + 3600000 * 2).toISOString(),
    status: "sent",
    is_read: false,
    read_at: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-notif-2",
    user_id: "demo-user",
    source: "task_overdue",
    source_reference_id: "demo-task-3",
    message: "Task 'Overdue API Security Audit & Token Renewal' requires your attention.",
    scheduled_for: new Date(Date.now() - 3600000).toISOString(),
    status: "sent",
    is_read: false,
    read_at: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

export function isDemoModeActive(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("todotak_demo_mode_active") === "true";
}

export function seedDemoData(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("todotak_demo_mode_active", "true");
  localStorage.setItem("todotak_demo_tasks", JSON.stringify(DEMO_TASKS));
  localStorage.setItem("todotak_demo_meetings", JSON.stringify(DEMO_MEETINGS));
  localStorage.setItem("todotak_demo_notifications", JSON.stringify(DEMO_NOTIFICATIONS));
}

export function clearDemoData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("todotak_demo_mode_active");
  localStorage.removeItem("todotak_demo_tasks");
  localStorage.removeItem("todotak_demo_meetings");
  localStorage.removeItem("todotak_demo_notifications");
}
