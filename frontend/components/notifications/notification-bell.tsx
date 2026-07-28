"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, Check, CheckCheck, ExternalLink, Video, X } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

import { apiClient } from "@/lib/api-client";
import { PageResponse } from "@/types";

export interface NotificationItem {
  id: string;
  user_id: string;
  source: string;
  source_reference_id: string;
  message: string;
  scheduled_for: string;
  status: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

/**
 * Filters notifications to find ONLY upcoming meeting reminders starting soon.
 * - Must be a meeting notification (source === 'meeting' or message contains 'meeting').
 * - Scheduled time must be in the immediate near future (starting within 15 minutes: diffMinutes >= -2 && diffMinutes <= 15).
 * - Excludes stale notifications (e.g. 45-min reminder scheduled 30 min ago, or past notifications).
 * - Returns ONLY the single most immediate upcoming meeting reminder.
 */
export function filterUpcomingMeetingPopups(
  items: NotificationItem[],
  seenIds: Set<string>,
  now: Date = new Date()
): NotificationItem[] {
  const nowMs = now.getTime();

  const qualifyingMeetings = items.filter((item) => {
    if (item.is_read || seenIds.has(item.id)) return false;

    const isMeeting =
      item.source === "meeting" ||
      item.message.toLowerCase().includes("meeting");
    if (!isMeeting) return false;

    const scheduledMs = new Date(item.scheduled_for).getTime();
    if (isNaN(scheduledMs)) return false;

    const diffMinutes = (scheduledMs - nowMs) / 60000;

    // Only allow reminders for meetings starting within the next 15 minutes (or up to 2 minutes past start time)
    return diffMinutes >= -2 && diffMinutes <= 15;
  });

  if (qualifyingMeetings.length === 0) return [];

  // Sort by closest time to now to get the most immediate/recent upcoming meeting
  qualifyingMeetings.sort((a, b) => {
    const diffA = Math.abs(new Date(a.scheduled_for).getTime() - nowMs);
    const diffB = Math.abs(new Date(b.scheduled_for).getTime() - nowMs);
    return diffA - diffB;
  });

  const closest = qualifyingMeetings[0];
  return closest ? [closest] : [];
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [toastQueue, setToastQueue] = useState<NotificationItem[]>([]);
  const seenToastIdsRef = useRef<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Request browser notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get<PageResponse<NotificationItem>>(
        "/api/v1/notifications",
        { page_size: 20 }
      );
      const countRes = await apiClient.get<{ unread_count: number }>(
        "/api/v1/notifications/unread-count"
      );

      const items = (res.items || []).filter(
        (n) => n.source !== "auth" && !n.message.toLowerCase().includes("verification token")
      );
      setNotifications(items);
      setUnreadCount(countRes.unread_count || 0);

      // Filter for exclusively upcoming meeting reminders starting within 15 mins
      const qualifyingMeetingToasts = filterUpcomingMeetingPopups(
        items,
        seenToastIdsRef.current
      );

      if (qualifyingMeetingToasts.length > 0 && qualifyingMeetingToasts[0]) {
        const meetingToast = qualifyingMeetingToasts[0];
        seenToastIdsRef.current.add(meetingToast.id);

        // Show only the single most immediate upcoming meeting toast popup
        setToastQueue([meetingToast]);

        // Trigger native Web Notification popup for meeting if allowed
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification("Upcoming Meeting Reminder", {
              body: meetingToast.message,
              icon: "/favicon.ico",
            });
          } catch {
            // Ignore native notification errors
          }
        }
      }
    } catch {
      // Ignore poll errors
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 8000); // Poll every 8 seconds
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiClient.patch(`/api/v1/notifications/${id}/read`);
      fetchNotifications();
    } catch {
      // Ignore error
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiClient.post("/api/v1/notifications/read-all");
      fetchNotifications();
    } catch {
      // Ignore error
    }
  };

  const dismissToast = (id: string) => {
    setToastQueue((prev) => prev.filter((t) => t.id !== id));
  };

  // Auto-dismiss meeting toast after 8 seconds
  useEffect(() => {
    if (toastQueue.length > 0) {
      const timer = setTimeout(() => {
        setToastQueue([]);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [toastQueue]);

  return (
    <>
      {/* Floating In-App Toast Popup - Exclusively for Imminent Upcoming Meetings */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toastQueue.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto p-4 rounded-xl bg-ink text-paper shadow-2xl border border-sky-500/30 flex items-start justify-between gap-3 animate-in slide-in-from-top-5 duration-300"
          >
            <div className="space-y-1">
              <p className="text-xs font-mono uppercase tracking-wider text-sky-400 font-semibold flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5 inline text-sky-400" /> Upcoming Meeting Reminder
              </p>
              <p className="text-sm font-medium">{toast.message}</p>
              <p className="text-[10px] text-paper-muted font-mono">
                Scheduled for {format(new Date(toast.scheduled_for), "HH:mm")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="text-paper-muted hover:text-paper p-1"
              title="Dismiss popup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Bell Icon Widget */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 rounded-seal hover:bg-forest-tint text-ink transition-colors focus-ring"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>

        {/* Notifications Dropdown Drawer */}
        {isOpen ? (
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-paper border border-paper-line shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-3.5 border-b border-paper-line flex items-center justify-between bg-paper-raised">
              <h3 className="font-display font-semibold text-sm text-ink">Notifications</h3>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-forest font-medium flex items-center gap-1 hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              ) : null}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-paper-line">
              {notifications.length === 0 ? (
                <p className="p-4 text-xs text-ink-muted text-center italic">No notifications.</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 text-xs flex items-start justify-between gap-2 transition-colors ${
                      n.is_read ? "bg-paper/40" : "bg-forest-tint/40 font-medium"
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="text-ink">{n.message}</p>
                      <p className="text-[10px] font-mono text-ink-faint">
                        {format(new Date(n.scheduled_for), "MMM d, HH:mm")}
                      </p>
                    </div>
                    {!n.is_read ? (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(n.id)}
                        className="p-1 text-forest hover:bg-forest-tint rounded"
                        title="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            <div className="p-2.5 border-t border-paper-line bg-paper-raised text-center">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-xs font-medium text-forest hover:underline inline-flex items-center gap-1"
              >
                View all notification history <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
