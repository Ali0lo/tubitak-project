"use client";

import { Menu } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { formatLongDate } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { MiniPomodoroTimer } from "@/components/pomodoro/mini-pomodoro-timer";
import { PomodoroModal } from "@/components/pomodoro/pomodoro-modal";
import { PomodoroAlarmBanner } from "@/components/pomodoro/pomodoro-alarm-banner";

interface HeaderProps {
  title: string;
  onOpenMobileSidebar?: () => void;
}

export function Header({ title, onOpenMobileSidebar }: HeaderProps) {
  const { user } = useAuth();
  const today = new Date().toISOString();

  return (
    <header className="flex items-center justify-between border-b border-paper-line bg-paper px-4 md:px-8 py-5">
      <div className="flex items-center gap-3">
        {onOpenMobileSidebar && (
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            aria-label="Open mobile navigation menu"
            className="md:hidden p-2 rounded-lg border border-paper-line bg-paper text-ink hover:bg-paper-tint focus-ring"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div>
          <h1 className="font-display text-xl md:text-2xl text-ink">{title}</h1>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            {formatLongDate(today)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <MiniPomodoroTimer />
        <ThemeToggle />
        <NotificationBell />
        {user ? (
          <div className="text-right border-l border-paper-line pl-4">
            <p className="text-sm font-medium text-ink">{user.full_name}</p>
            <p className="font-mono text-xs text-ink-faint">{user.email}</p>
          </div>
        ) : null}
      </div>

      <PomodoroModal />
      <PomodoroAlarmBanner />
    </header>
  );
}

