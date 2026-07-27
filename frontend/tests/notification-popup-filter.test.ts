import { describe, it, expect } from "vitest";
import { filterUpcomingMeetingPopups, NotificationItem } from "@/components/notifications/notification-bell";

describe("filterUpcomingMeetingPopups", () => {
  const referenceNow = new Date("2026-07-27T10:00:00Z");

  it("filters out non-meeting notifications (e.g. task reminders)", () => {
    const taskNotification: NotificationItem = {
      id: "notif-1",
      user_id: "user-1",
      source: "task",
      source_reference_id: "task-123",
      message: "Task due soon: Finish documentation",
      scheduled_for: "2026-07-27T10:10:00Z", // 10 mins from now
      status: "pending",
      is_read: false,
      read_at: null,
      created_at: "2026-07-27T09:00:00Z",
    };

    const seenIds = new Set<string>();
    const result = filterUpcomingMeetingPopups([taskNotification], seenIds, referenceNow);

    expect(result).toHaveLength(0);
  });

  it("filters out stale meeting notifications from the past (e.g. 45-min reminder sent 30 mins ago)", () => {
    const staleMeetingNotification: NotificationItem = {
      id: "notif-old-meeting",
      user_id: "user-1",
      source: "meeting",
      source_reference_id: "meeting-99",
      message: "Meeting starting in 45 minutes: Sync call",
      scheduled_for: "2026-07-27T09:30:00Z", // 30 minutes in the past
      status: "pending",
      is_read: false,
      read_at: null,
      created_at: "2026-07-27T09:15:00Z",
    };

    const seenIds = new Set<string>();
    const result = filterUpcomingMeetingPopups([staleMeetingNotification], seenIds, referenceNow);

    expect(result).toHaveLength(0);
  });

  it("selects ONLY the single most immediate upcoming meeting notification within 15 minutes", () => {
    const meetingSoon15Min: NotificationItem = {
      id: "meeting-15",
      user_id: "user-1",
      source: "meeting",
      source_reference_id: "m-1",
      message: "Meeting in 15 minutes: Team Standup",
      scheduled_for: "2026-07-27T10:15:00Z", // 15 mins from now
      status: "pending",
      is_read: false,
      read_at: null,
      created_at: "2026-07-27T09:50:00Z",
    };

    const meetingFarInFuture: NotificationItem = {
      id: "meeting-60",
      user_id: "user-1",
      source: "meeting",
      source_reference_id: "m-2",
      message: "Meeting in 60 minutes: Project Planning",
      scheduled_for: "2026-07-27T11:00:00Z", // 60 mins from now
      status: "pending",
      is_read: false,
      read_at: null,
      created_at: "2026-07-27T09:50:00Z",
    };

    const seenIds = new Set<string>();
    const result = filterUpcomingMeetingPopups(
      [meetingFarInFuture, meetingSoon15Min],
      seenIds,
      referenceNow
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("meeting-15");
  });
});
