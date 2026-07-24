"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Filter,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Spinner } from "@/components/ui/spinner";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from "@/hooks/use-notifications";
import { useCreateReminder } from "@/hooks/use-reminders";

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New reminder form state
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderTime, setReminderTime] = useState(() => {
    const d = new Date(Date.now() + 2 * 60 * 1000); // default 2 mins from now
    return d.toISOString().slice(0, 16);
  });

  const { data, isLoading, refetch } = useNotifications(50, filter === "unread");
  const { data: unreadData } = useUnreadNotificationCount();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const createReminder = useCreateReminder();

  const notifications = data?.items || [];
  const unreadCount = unreadData?.unread_count || 0;

  const filteredNotifications = notifications.filter((n) =>
    n.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderMessage.trim()) return;

    try {
      await createReminder.mutateAsync({
        remind_at: new Date(reminderTime).toISOString(),
        message: reminderMessage,
      });
      setReminderMessage("");
      setIsModalOpen(false);
      refetch();
    } catch (err) {
      // Error handled by mutation
    }
  };

  return (
    <AppShell title="Notification History">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-paper-raised p-5 rounded-2xl border border-paper-line shadow-sm">
          <div>
            <h2 className="font-display text-xl text-ink flex items-center gap-2">
              <Bell className="h-5 w-5 text-forest" />
              Notifications Ledger
            </h2>
            <p className="text-xs text-ink-muted mt-1">
              Track and review all system alerts, task due dates, and custom reminders.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => markAllAsRead.mutate()}
                disabled={markAllAsRead.isPending}
                className="px-3.5 py-2 text-xs font-medium text-forest bg-forest-tint hover:bg-forest-light/20 rounded-seal transition-colors flex items-center gap-1.5 focus-ring"
              >
                <CheckCheck className="h-4 w-4" />
                {markAllAsRead.isPending ? "Marking..." : `Mark all read (${unreadCount})`}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 text-xs font-medium text-paper bg-forest hover:bg-forest-dark rounded-seal transition-colors flex items-center gap-1.5 focus-ring shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New Reminder
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center bg-paper-raised p-1 rounded-xl border border-paper-line w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors flex-1 sm:flex-none ${
                filter === "all"
                  ? "bg-forest text-paper shadow-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              All Notifications ({data?.total || 0})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors flex-1 sm:flex-none ${
                filter === "unread"
                  ? "bg-forest text-paper shadow-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-faint" />
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-paper-raised text-ink text-xs pl-9 pr-4 py-2 rounded-xl border border-paper-line focus-ring"
            />
          </div>
        </div>

        {/* Notification List */}
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Spinner label="Loading notification history..." />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-16 bg-paper-raised rounded-2xl border border-paper-line space-y-3">
            <div className="inline-flex p-3 rounded-full bg-forest-tint text-forest">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="font-display text-base text-ink">No notifications found</p>
            <p className="text-xs text-ink-muted max-w-sm mx-auto">
              {filter === "unread"
                ? "You've read all your notifications! Switch to 'All Notifications' to view history."
                : "You don't have any notifications logged in history yet."}
            </p>
          </div>
        ) : (
          <div className="bg-paper-raised rounded-2xl border border-paper-line divide-y divide-paper-line overflow-hidden shadow-sm">
            {filteredNotifications.map((n) => {
              const isUnread = !n.is_read;
              return (
                <div
                  key={n.id}
                  className={`p-4 transition-colors flex items-start justify-between gap-4 ${
                    isUnread ? "bg-forest-tint/30" : "hover:bg-paper/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        isUnread
                          ? "bg-amber-tint text-amber-dark"
                          : "bg-paper-line/50 text-ink-faint"
                      }`}
                    >
                      <Clock className="h-4 w-4" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm ${isUnread ? "font-semibold text-ink" : "text-ink/80"}`}>
                          {n.message}
                        </p>
                        {isUnread && (
                          <span className="inline-block h-2 w-2 rounded-full bg-amber" />
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-ink-faint font-mono">
                        <span>Source: {n.source}</span>
                        <span>•</span>
                        <span>{format(new Date(n.scheduled_for), "PPP 'at' p")}</span>
                        <span>•</span>
                        <span className="capitalize">Status: {n.status}</span>
                      </div>
                    </div>
                  </div>

                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => markAsRead.mutate(n.id)}
                      disabled={markAsRead.isPending}
                      className="p-1.5 text-forest hover:bg-forest-tint rounded-seal transition-colors shrink-0 flex items-center gap-1 text-xs"
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                      <span className="hidden sm:inline">Mark read</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal for creating custom test notification / reminder */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-paper-raised rounded-2xl border border-paper-line p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-paper-line pb-3">
              <h3 className="font-display font-semibold text-ink">Schedule New Reminder</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReminder} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-ink-muted mb-1">
                  Reminder Message
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Review project submission proposal"
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                  className="w-full bg-paper text-ink text-sm p-3 rounded-xl border border-paper-line focus-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-ink-muted mb-1">
                  Remind At (Date & Time)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full bg-paper text-ink text-sm p-3 rounded-xl border border-paper-line focus-ring"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createReminder.isPending}
                  className="px-4 py-2 text-xs font-medium text-paper bg-forest hover:bg-forest-dark rounded-seal focus-ring"
                >
                  {createReminder.isPending ? "Scheduling..." : "Schedule Reminder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
