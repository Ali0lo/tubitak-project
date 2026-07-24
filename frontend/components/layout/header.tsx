"use client";

import { useAuth } from "@/hooks/use-auth";
import { formatLongDate } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/notification-bell";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { user } = useAuth();
  const today = new Date().toISOString();

  return (
    <header className="flex items-center justify-between border-b border-paper-line bg-paper px-8 py-5">
      <div>
        <h1 className="font-display text-2xl text-ink">{title}</h1>
        <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">
          {formatLongDate(today)}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <NotificationBell />
        {user ? (
          <div className="text-right border-l border-paper-line pl-4">
            <p className="text-sm font-medium text-ink">{user.full_name}</p>
            <p className="font-mono text-xs text-ink-faint">{user.email}</p>
          </div>
        ) : null}
      </div>
    </header>
  );
}
