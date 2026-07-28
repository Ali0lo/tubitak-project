"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Calendar,
  Command,
  Flame,
  LayoutDashboard,
  ListTodo,
  Plus,
  Sparkles,
  Timer,
  Video,
  X,
} from "lucide-react";

import { useCommandPaletteStore } from "@/stores/use-command-palette-store";
import { useQuickAddStore } from "@/stores/use-quick-add-store";
import { usePomodoroStore } from "@/stores/pomodoro-store";

export function CommandPalette() {
  const { isOpen, closePalette } = useCommandPaletteStore();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const pomodoroStore = usePomodoroStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closePalette();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closePalette]);

  if (!isOpen) return null;

  const commands = [
    {
      id: "create-task",
      title: "Create Task",
      subtitle: "Open quick add dialog",
      shortcut: "N",
      icon: Plus,
      action: () => {
        closePalette();
        useQuickAddStore.getState().openQuickAdd();
      },
    },
    {
      id: "go-dashboard",
      title: "Go to Dashboard",
      subtitle: "View stats & daily summary",
      shortcut: "G D",
      icon: LayoutDashboard,
      action: () => {
        closePalette();
        router.push("/dashboard");
      },
    },
    {
      id: "go-tasks",
      title: "Go to Tasks",
      subtitle: "List & Kanban views",
      shortcut: "G T",
      icon: ListTodo,
      action: () => {
        closePalette();
        router.push("/tasks");
      },
    },
    {
      id: "go-calendar",
      title: "Go to Calendar",
      subtitle: "View tasks & meetings schedule",
      shortcut: "G C",
      icon: Calendar,
      action: () => {
        closePalette();
        router.push("/calendar");
      },
    },
    {
      id: "open-ai",
      title: "Open AI Assistant",
      subtitle: "Ask assistant to parse or summarize",
      shortcut: "AI",
      icon: Sparkles,
      action: () => {
        closePalette();
        router.push("/chat");
      },
    },
    {
      id: "open-notifications",
      title: "Open Notifications",
      subtitle: "Check reminders & alerts",
      shortcut: "Notifications",
      icon: Bell,
      action: () => {
        closePalette();
        router.push("/notifications");
      },
    },
    {
      id: "start-pomodoro",
      title: "Start Pomodoro Focus",
      subtitle: "Launch focus timer modal",
      shortcut: "Focus",
      icon: Timer,
      action: () => {
        closePalette();
        pomodoroStore.setIsModalOpen(true);
      },
    },
  ];

  const filteredCommands = commands.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-xl border border-paper-line bg-paper shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Command Search Header */}
        <div className="flex items-center gap-3 border-b border-paper-line px-4 py-3 bg-paper-raised/40">
          <Command className="h-5 w-5 text-forest shrink-0" />
          <input
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <button
            type="button"
            onClick={closePalette}
            className="text-ink-faint hover:text-ink p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-faint">
              No command matching &quot;{query}&quot;
            </div>
          ) : (
            filteredCommands.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <div
                  key={cmd.id}
                  onClick={cmd.action}
                  className="flex items-center justify-between rounded-lg p-2.5 hover:bg-paper-raised cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-md p-1.5 bg-paper border border-paper-line group-hover:border-forest text-ink">
                      <Icon className="h-4 w-4 text-forest" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-ink leading-none">{cmd.title}</p>
                      <p className="mt-1 text-[11px] text-ink-faint leading-none">{cmd.subtitle}</p>
                    </div>
                  </div>

                  <kbd className="rounded bg-paper px-2 py-0.5 font-mono text-[10px] font-semibold text-ink-muted border border-paper-line">
                    {cmd.shortcut}
                  </kbd>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
