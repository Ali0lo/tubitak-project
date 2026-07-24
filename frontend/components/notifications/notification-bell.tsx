"use client";

import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { format } from "date-fns";

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

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [toastQueue, setToastQueue] = useState<NotificationItem[]>([]);
  const [seenToastIds, setSeenToastIds] = useState<Set<string>>(() => new Set());

  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get<PageResponse<NotificationItem>>(
        "/api/v1/notifications",
        { page_size: 20 }
      );
      const countRes = await apiClient.get<{ unread_count: number }>(
        "/api/v1/notifications/unread-count"
      );

      const items = res.items || [];
      setNotifications(items);
      setUnreadCount(countRes.unread_count || 0);

      // Check for new unread notifications that haven't been shown as toast popups yet
      const newToasts: NotificationItem[] = [];
      setSeenToastIds((prevSeen) => {
        const nextSeen = new Set(prevSeen);
        items.forEach((item) => {
          if (!item.is_read && !nextSeen.has(item.id)) {
            nextSeen.add(item.id);
            newToasts.push(item);
          }
        });
        if (newToasts.length > 0) {
          setToastQueue((prevToasts) => [...prevToasts, ...newToasts]);
        }
        return nextSeen;
      });
    } catch (e) {
      // Ignore poll errors
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // poll every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiClient.patch(`/api/v1/notifications/${id}/read`);
      fetchNotifications();
    } catch (e) {
      // Ignore error
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiClient.post("/api/v1/notifications/read-all");
      fetchNotifications();
    } catch (e) {
      // Ignore error
    }
  };

  const dismissToast = (id: string) => {
    setToastQueue((prev) => prev.filter((t) => t.id !== id));
  };

  // Auto-dismiss toast after 6 seconds
  useEffect(() => {
    if (toastQueue.length > 0) {
      const timer = setTimeout(() => {
        setToastQueue((prev) => prev.slice(1));
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [toastQueue]);

  return (
    <>
      {/* Floating In-App Toast Popups */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toastQueue.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto p-4 rounded-xl bg-ink text-paper shadow-2xl border border-paper-line/20 flex items-start justify-between gap-3 animate-in slide-in-from-top-5 duration-300"
          >
            <div className="space-y-1">
              <p className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                Reminder Alert
              </p>
              <p className="text-sm font-medium">{toast.message}</p>
              <p className="text-[10px] text-paper-muted font-mono">
                {format(new Date(toast.scheduled_for), "HH:mm")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="text-paper-muted hover:text-paper p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Bell Icon Widget */}
      <div className="relative">
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
            <div className="p-3.5 border-b border-paper-line flex items-center justify-between bg-paper-tint">
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
                      n.is_read ? "bg-paper/40" : "bg-forest-tint/30 font-medium"
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
          </div>
        ) : null}
      </div>
    </>
  );
}
