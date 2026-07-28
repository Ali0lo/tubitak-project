"use client";

import {
  Bell,
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLogout } from "@/hooks/use-auth";
import { useUnreadNotificationCount } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { PixelCatMascot, PixelMascotSidebarWidget } from "@/components/ui/pixel-art";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/meetings", label: "Meetings", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/chat", label: "Chat", icon: MessageSquareText },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

interface SidebarProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ isOpenMobile, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const logout = useLogout();
  const { data: unreadData } = useUnreadNotificationCount();
  const unreadCount = unreadData?.unread_count || 0;

  const content = (
    <aside className="flex h-full w-56 shrink-0 flex-col bg-forest-dark dark:bg-paper-raised dark:border-r dark:border-paper-line text-paper transition-colors duration-200">
      <div className="border-b border-paper/10 dark:border-paper-line px-5 py-5 flex items-center gap-3">
        <PixelCatMascot size={26} />
        <div>
          <p className="font-display text-xl leading-none flex items-center gap-1">
            Todotak
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-paper/50 dark:text-ink-muted">
            your day, kept
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              onClick={onCloseMobile}
              className={cn(
                "focus-ring flex items-center justify-between gap-3 rounded-seal px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-forest-tint/30 text-paper dark:bg-forest/20 dark:text-forest-light font-medium"
                  : "text-paper/70 dark:text-ink-muted hover:bg-paper/5 dark:hover:bg-paper-line/40 hover:text-paper dark:hover:text-ink"
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

      <PixelMascotSidebarWidget />

      <div className="border-t border-paper/10 dark:border-paper-line px-3 py-3">
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          aria-label="Sign out of Todotak"
          className="focus-ring flex w-full items-center gap-3 rounded-seal px-3 py-2 text-sm text-paper/70 dark:text-ink-muted transition-colors hover:bg-paper/5 dark:hover:bg-paper-line/40 hover:text-paper dark:hover:text-ink disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          {logout.isPending ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden md:flex h-full">{content}</div>

      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={onCloseMobile}
            aria-label="Close mobile navigation overlay"
          />
          <div className="relative z-50 flex h-full animate-in slide-in-from-left duration-200">{content}</div>
        </div>
      )}
    </>
  );
}
