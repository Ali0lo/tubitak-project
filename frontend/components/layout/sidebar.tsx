"use client";

import {
  Bell,
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLogout } from "@/hooks/use-auth";
import { useUnreadNotificationCount } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/meetings", label: "Meetings", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/chat", label: "Chat", icon: MessageSquareText },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const logout = useLogout();
  const { data: unreadData } = useUnreadNotificationCount();
  const unreadCount = unreadData?.unread_count || 0;

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col bg-forest text-paper">
      <div className="border-b border-paper/10 px-5 py-6">
        <p className="font-display text-xl leading-none">Todotak</p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-paper/50">
          your day, kept
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "focus-ring flex items-center justify-between gap-3 rounded-seal px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-paper/10 text-paper"
                  : "text-paper/70 hover:bg-paper/5 hover:text-paper"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {label}
              </div>
              {href === "/notifications" && unreadCount > 0 ? (
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-paper/10 px-3 py-4">
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="focus-ring flex w-full items-center gap-3 rounded-seal px-3 py-2 text-sm text-paper/70 transition-colors hover:bg-paper/5 hover:text-paper disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          {logout.isPending ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
