"use client";

import { useAuth } from "@/hooks/use-auth";
import { formatLongDate } from "@/lib/utils";

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
      {user ? (
        <div className="text-right">
          <p className="text-sm text-ink">{user.full_name}</p>
          <p className="font-mono text-xs text-ink-faint">{user.email}</p>
        </div>
      ) : null}
    </header>
  );
}
