#!/usr/bin/env bash
# Todotak - frontend full implementation (Next.js 15 App Router)
# (supersedes the earlier setup_frontend.sh - this one is upgraded
#  to Next.js 15.5.18 + React 19.2.7 after Next 14.x reached
#  end-of-security-patches; see tests/security/README.md)
# Run this from the root of your todotak/ repo:
#   bash setup_frontend.sh
set -euo pipefail

echo '==> Creating frontend directories'
mkdir -p "frontend"
mkdir -p "frontend/app"
mkdir -p "frontend/app/calendar"
mkdir -p "frontend/app/chat"
mkdir -p "frontend/app/dashboard"
mkdir -p "frontend/app/login"
mkdir -p "frontend/app/meetings"
mkdir -p "frontend/app/register"
mkdir -p "frontend/app/tasks"
mkdir -p "frontend/components/auth"
mkdir -p "frontend/components/calendar"
mkdir -p "frontend/components/chat"
mkdir -p "frontend/components/dashboard"
mkdir -p "frontend/components/layout"
mkdir -p "frontend/components/meetings"
mkdir -p "frontend/components/tasks"
mkdir -p "frontend/components/ui"
mkdir -p "frontend/hooks"
mkdir -p "frontend/lib"
mkdir -p "frontend/public"
mkdir -p "frontend/stores"
mkdir -p "frontend/tests"
mkdir -p "frontend/types"

echo '==> Writing frontend/.env.local.example'
cat > "frontend/.env.local.example" << 'TODOTAK_EOF'
# Base URL the browser calls for API requests. In development this
# points at the Next.js rewrite proxy (see next.config.js), which
# forwards to NEXT_PUBLIC_GATEWAY_URL server-side and avoids CORS
# entirely. In production, point NEXT_PUBLIC_GATEWAY_URL at your
# deployed gateway and keep this as /api/gateway.
NEXT_PUBLIC_API_BASE_URL=/api/gateway

# Server-side target for the rewrite proxy above.
NEXT_PUBLIC_GATEWAY_URL=http://localhost:8000
TODOTAK_EOF

echo '==> Writing frontend/.eslintrc.json'
cat > "frontend/.eslintrc.json" << 'TODOTAK_EOF'
{
  "extends": "next/core-web-vitals"
}
TODOTAK_EOF

echo '==> Writing frontend/.gitignore'
cat > "frontend/.gitignore" << 'TODOTAK_EOF'
node_modules/
.next/
out/
build/
*.tsbuildinfo
.env.local
.env*.local
.DS_Store
npm-debug.log*
next-env.d.ts
TODOTAK_EOF

echo '==> Writing frontend/Dockerfile'
cat > "frontend/Dockerfile" << 'TODOTAK_EOF'
FROM node:20-slim AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
TODOTAK_EOF

echo '==> Writing frontend/app/calendar/page.tsx'
cat > "frontend/app/calendar/page.tsx" << 'TODOTAK_EOF'
"use client";

import { AppShell } from "@/components/layout/app-shell";
import { CalendarView } from "@/components/calendar/calendar-view";

export default function CalendarPage() {
  return (
    <AppShell title="Calendar">
      <CalendarView />
    </AppShell>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/app/chat/page.tsx'
cat > "frontend/app/chat/page.tsx" << 'TODOTAK_EOF'
"use client";

import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ChatWindow } from "@/components/chat/chat-window";
import { ConversationSidebar } from "@/components/chat/conversation-sidebar";
import { Card } from "@/components/ui/card";

export default function ChatPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);

  return (
    <AppShell title="Chat">
      <Card className="flex h-[calc(100vh-176px)] overflow-hidden">
        <ConversationSidebar
          activeConversationId={conversationId}
          onSelect={setConversationId}
        />
        <ChatWindow
          conversationId={conversationId}
          onConversationCreated={setConversationId}
        />
      </Card>
    </AppShell>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/app/dashboard/page.tsx'
cat > "frontend/app/dashboard/page.tsx" << 'TODOTAK_EOF'
"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ReminderSummaryCard } from "@/components/dashboard/reminder-summary-card";
import { TaskSummaryCard } from "@/components/dashboard/task-summary-card";
import { UpcomingMeetingsCard } from "@/components/dashboard/upcoming-meetings-card";

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TaskSummaryCard />
        <UpcomingMeetingsCard />
        <div className="lg:col-span-2">
          <ReminderSummaryCard />
        </div>
      </div>
    </AppShell>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/app/globals.css'
cat > "frontend/app/globals.css" << 'TODOTAK_EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    @apply antialiased;
  }
  body {
    @apply bg-paper text-ink font-sans;
  }
  ::selection {
    @apply bg-amber-tint text-forest-dark;
  }
}

@layer components {
  /* The signature "ledger line" motif: a mono timestamp, a serif
     title, a hairline rule beneath. Reused across dashboard, tasks,
     meetings, and calendar so the whole app reads as one kept
     journal rather than a set of unrelated screens. */
  .ledger-line {
    @apply flex items-baseline gap-4 border-b border-paper-line py-3 last:border-b-0;
  }
  .ledger-stamp {
    @apply font-mono text-xs tabular-nums text-ink-faint shrink-0 w-16;
  }
  .ledger-title {
    @apply font-display text-base text-ink;
  }

  .focus-ring {
    @apply outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-paper;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
TODOTAK_EOF

echo '==> Writing frontend/app/layout.tsx'
cat > "frontend/app/layout.tsx" << 'TODOTAK_EOF'
import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import type { ReactNode } from "react";

import { Providers } from "@/app/providers";

import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Todotak",
  description: "Your day, kept — an AI-powered task and meeting assistant.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/app/login/page.tsx'
cat > "frontend/app/login/page.tsx" << 'TODOTAK_EOF'
import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl text-ink">Todotak</p>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-ink-faint">
            your day, kept
          </p>
        </div>
        <div className="rounded-seal border border-paper-line bg-paper-raised p-6 shadow-ledger">
          <h1 className="mb-6 font-display text-xl text-ink">Sign in</h1>
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-sm text-ink-muted">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-forest hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/app/meetings/page.tsx'
cat > "frontend/app/meetings/page.tsx" << 'TODOTAK_EOF'
"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { MeetingFormDialog } from "@/components/meetings/meeting-form-dialog";
import { MeetingList } from "@/components/meetings/meeting-list";
import type { MeetingStatus } from "@/types";

export default function MeetingsPage() {
  const [status, setStatus] = useState<MeetingStatus | undefined>(undefined);
  const [isDialogOpen, setDialogOpen] = useState(false);

  return (
    <AppShell title="Meetings">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Select
          aria-label="Filter by status"
          value={status ?? ""}
          onChange={(event) =>
            setStatus(
              (event.target.value || undefined) as MeetingStatus | undefined
            )
          }
          className="w-44"
        >
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New meeting
        </Button>
      </div>
      <MeetingList status={status} />
      <MeetingFormDialog
        open={isDialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </AppShell>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/app/page.tsx'
cat > "frontend/app/page.tsx" << 'TODOTAK_EOF'
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    router.replace(isAuthenticated ? "/dashboard" : "/login");
  }, [isReady, isAuthenticated, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-paper">
      <Spinner label="Loading Todotak" />
    </div>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/app/providers.tsx'
cat > "frontend/app/providers.tsx" << 'TODOTAK_EOF'
"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { createQueryClient } from "@/lib/query-client";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/app/register/page.tsx'
cat > "frontend/app/register/page.tsx" << 'TODOTAK_EOF'
import Link from "next/link";

import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl text-ink">Todotak</p>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-ink-faint">
            your day, kept
          </p>
        </div>
        <div className="rounded-seal border border-paper-line bg-paper-raised p-6 shadow-ledger">
          <h1 className="mb-6 font-display text-xl text-ink">
            Create your account
          </h1>
          <RegisterForm />
        </div>
        <p className="mt-4 text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-forest hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/app/tasks/page.tsx'
cat > "frontend/app/tasks/page.tsx" << 'TODOTAK_EOF'
"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { TaskFiltersBar } from "@/components/tasks/task-filters";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskList } from "@/components/tasks/task-list";
import type { TaskFilters } from "@/types";

export default function TasksPage() {
  const [filters, setFilters] = useState<TaskFilters>({});
  const [isDialogOpen, setDialogOpen] = useState(false);

  return (
    <AppShell title="Tasks">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TaskFiltersBar filters={filters} onChange={setFilters} />
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New task
        </Button>
      </div>
      <TaskList filters={filters} />
      <TaskFormDialog open={isDialogOpen} onClose={() => setDialogOpen(false)} />
    </AppShell>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/auth/login-form.tsx'
cat > "frontend/components/auth/login-form.tsx" << 'TODOTAK_EOF'
"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/hooks/use-auth";
import { ApiError } from "@/types/api";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ email, password });
  };

  const errorMessage =
    login.error instanceof ApiError
      ? login.error.detail
      : login.error
        ? "Something went wrong. Please try again."
        : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-ink-muted">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm text-ink-muted"
        >
          Password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {errorMessage ? (
        <p role="alert" className="text-sm text-brick">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" isLoading={login.isPending} className="mt-2">
        Sign in
      </Button>
    </form>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/auth/register-form.tsx'
cat > "frontend/components/auth/register-form.tsx" << 'TODOTAK_EOF'
"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRegister } from "@/hooks/use-auth";
import { ApiError } from "@/types/api";

export function RegisterForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatchError, setMismatchError] = useState<string | null>(null);
  const register = useRegister();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setMismatchError("Passwords don't match.");
      return;
    }
    setMismatchError(null);
    register.mutate({ email, full_name: fullName, password });
  };

  const apiErrorMessage =
    register.error instanceof ApiError
      ? register.error.detail
      : register.error
        ? "Something went wrong. Please try again."
        : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="full_name" className="mb-1 block text-sm text-ink-muted">
          Full name
        </label>
        <Input
          id="full_name"
          type="text"
          autoComplete="name"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-ink-muted">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm text-ink-muted"
        >
          Password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div>
        <label
          htmlFor="confirm_password"
          className="mb-1 block text-sm text-ink-muted"
        >
          Confirm password
        </label>
        <Input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>
      {mismatchError || apiErrorMessage ? (
        <p role="alert" className="text-sm text-brick">
          {mismatchError ?? apiErrorMessage}
        </p>
      ) : null}
      <Button type="submit" isLoading={register.isPending} className="mt-2">
        Create account
      </Button>
    </form>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/calendar/calendar-view.tsx'
cat > "frontend/components/calendar/calendar-view.tsx" << 'TODOTAK_EOF'
"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useMeetings } from "@/hooks/use-meetings";
import { useTasks } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView() {
  const [cursor, setCursor] = useState(() => new Date());
  const { data: taskData, isLoading: tasksLoading } = useTasks();
  const { data: meetingData, isLoading: meetingsLoading } = useMeetings();

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  if (tasksLoading || meetingsLoading) {
    return (
      <Card>
        <Spinner label="Loading calendar" />
      </Card>
    );
  }

  const tasksWithDueDate = (taskData?.items ?? []).filter((t) => t.due_date);
  const meetings = meetingData?.items ?? [];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-paper-line px-5 py-4">
        <button
          type="button"
          onClick={() => setCursor((c) => subMonths(c, 1))}
          aria-label="Previous month"
          className="focus-ring rounded-seal p-1.5 hover:bg-forest-tint"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="font-display text-lg text-ink">
          {format(cursor, "MMMM yyyy")}
        </h2>
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, 1))}
          aria-label="Next month"
          className="focus-ring rounded-seal p-1.5 hover:bg-forest-tint"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-paper-line text-center font-mono text-[11px] uppercase tracking-wide text-ink-faint">
        {WEEKDAY_LABELS.map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayTasks = tasksWithDueDate.filter(
            (t) => t.due_date && isSameDay(new Date(t.due_date), day)
          );
          const dayMeetings = meetings.filter((m) =>
            isSameDay(new Date(m.start_time), day)
          );
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, new Date());
          const overflowCount = dayTasks.length + dayMeetings.length - 4;

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[96px] border-b border-r border-paper-line p-2 last:border-r-0",
                !inMonth && "bg-paper/50"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-xs",
                  inMonth ? "text-ink-muted" : "text-ink-faint/50",
                  isToday && "bg-forest text-paper"
                )}
              >
                {format(day, "d")}
              </span>
              <div className="mt-1 space-y-1">
                {dayMeetings.slice(0, 2).map((meeting) => (
                  <Badge
                    key={meeting.id}
                    tone="forest"
                    className="block w-fit max-w-full truncate normal-case"
                  >
                    {meeting.title}
                  </Badge>
                ))}
                {dayTasks.slice(0, 2).map((task) => (
                  <Badge
                    key={task.id}
                    tone="amber"
                    className="block w-fit max-w-full truncate normal-case"
                  >
                    {task.title}
                  </Badge>
                ))}
                {overflowCount > 0 ? (
                  <p className="font-mono text-[10px] text-ink-faint">
                    +{overflowCount} more
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/chat/chat-input.tsx'
cat > "frontend/components/chat/chat-input.tsx" << 'TODOTAK_EOF'
"use client";

import { Send } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (message: string) => void;
  isSending: boolean;
}

export function ChatInput({ onSend, isSending }: ChatInputProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isSending) return;
    onSend(trimmed);
    setValue("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 border-t border-paper-line p-4"
    >
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder="Ask me to add a task, schedule a meeting, or set a reminder..."
        className="max-h-32"
        aria-label="Message"
      />
      <Button type="submit" isLoading={isSending} disabled={!value.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/chat/chat-window.tsx'
cat > "frontend/components/chat/chat-window.tsx" << 'TODOTAK_EOF'
"use client";

import { useEffect, useRef } from "react";

import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Spinner } from "@/components/ui/spinner";
import { useConversation, useSendMessage } from "@/hooks/use-chat";

interface ChatWindowProps {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
}

export function ChatWindow({
  conversationId,
  onConversationCreated,
}: ChatWindowProps) {
  const { data: conversation, isLoading } = useConversation(conversationId);
  const sendMessage = useSendMessage();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length]);

  const handleSend = (text: string) => {
    sendMessage.mutate(
      { message: text, conversation_id: conversationId ?? undefined },
      {
        onSuccess: (data) => {
          if (!conversationId) onConversationCreated(data.conversation_id);
        },
      }
    );
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!conversationId ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="font-display text-xl text-ink">
              What can I help with?
            </p>
            <p className="mt-1 max-w-sm text-sm text-ink-muted">
              Ask me to add a task, schedule a meeting, set a reminder, or
              check what&apos;s on your plate today.
            </p>
          </div>
        ) : isLoading ? (
          <Spinner label="Loading conversation" />
        ) : (
          <>
            {conversation?.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
      <ChatInput onSend={handleSend} isSending={sendMessage.isPending} />
    </div>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/chat/conversation-sidebar.tsx'
cat > "frontend/components/chat/conversation-sidebar.tsx" << 'TODOTAK_EOF'
"use client";

import { Plus, Trash2 } from "lucide-react";

import { useConversations, useDeleteConversation } from "@/hooks/use-chat";
import { cn, formatRelative } from "@/lib/utils";

interface ConversationSidebarProps {
  activeConversationId: string | null;
  onSelect: (id: string | null) => void;
}

export function ConversationSidebar({
  activeConversationId,
  onSelect,
}: ConversationSidebarProps) {
  const { data, isLoading } = useConversations();
  const deleteConversation = useDeleteConversation();

  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-paper-line">
      <div className="border-b border-paper-line p-3">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="focus-ring flex w-full items-center gap-2 rounded-seal border border-paper-line px-3 py-2 text-sm text-ink hover:border-forest/40"
        >
          <Plus className="h-4 w-4" />
          New conversation
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="p-4 text-sm text-ink-faint">Loading...</p>
        ) : null}
        {data && data.items.length === 0 ? (
          <p className="p-4 text-sm text-ink-faint">No conversations yet.</p>
        ) : null}
        {data?.items.map((conversation) => (
          <div
            key={conversation.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(conversation.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSelect(conversation.id);
            }}
            className={cn(
              "group flex cursor-pointer items-center justify-between gap-2 border-b border-paper-line px-3 py-3",
              activeConversationId === conversation.id
                ? "bg-forest-tint"
                : "hover:bg-paper"
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">
                {conversation.title || "New conversation"}
              </p>
              <p className="font-mono text-[10px] text-ink-faint">
                {formatRelative(conversation.updated_at)}
              </p>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                deleteConversation.mutate(conversation.id);
                if (activeConversationId === conversation.id) onSelect(null);
              }}
              aria-label="Delete conversation"
              className="focus-ring shrink-0 rounded-seal p-1 text-ink-faint opacity-0 hover:bg-brick-tint hover:text-brick group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/chat/message-bubble.tsx'
cat > "frontend/components/chat/message-bubble.tsx" << 'TODOTAK_EOF'
import { Bot, User, Wrench } from "lucide-react";

import { cn, formatTimestamp } from "@/lib/utils";
import type { Message } from "@/types";

function summarizeToolContent(content: string | null): string {
  if (!content) return "Done.";
  try {
    const parsed = JSON.parse(content);
    if (parsed?.error) return `Couldn't complete that: ${parsed.error}`;
    if (parsed?.status === "deleted") return "Deleted.";
    if (typeof parsed?.title === "string") return `"${parsed.title}"`;
    return "Done.";
  } catch {
    return content;
  }
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "system") return null;

  if (message.role === "tool") {
    return (
      <div className="flex items-center gap-2 py-1 pl-9 text-xs text-ink-faint">
        <Wrench className="h-3 w-3" />
        <span>{summarizeToolContent(message.content)}</span>
      </div>
    );
  }

  // Assistant messages that only carried tool_calls (no text yet) don't
  // need their own bubble; the tool notes above stand in for them.
  if (message.role === "assistant" && !message.content && message.tool_calls?.length) {
    return null;
  }

  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 py-2", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-amber-tint text-amber-dark"
            : "bg-forest-tint text-forest-dark"
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[75%] rounded-seal border px-4 py-2.5 text-sm",
          isUser
            ? "border-amber/30 bg-amber-tint text-ink"
            : "border-forest/20 bg-forest-tint text-ink"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p className="mt-1 font-mono text-[10px] text-ink-faint">
          {formatTimestamp(message.created_at)}
        </p>
      </div>
    </div>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/dashboard/reminder-summary-card.tsx'
cat > "frontend/components/dashboard/reminder-summary-card.tsx" << 'TODOTAK_EOF'
"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useReminders } from "@/hooks/use-reminders";
import { formatDateLabel, formatTimestamp } from "@/lib/utils";

export function ReminderSummaryCard() {
  const { data, isLoading } = useReminders(false);

  const upcoming = [...(data?.items ?? [])]
    .sort(
      (a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime()
    )
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reminders</CardTitle>
      </CardHeader>
      {isLoading ? (
        <Spinner label="Loading reminders" />
      ) : upcoming.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-muted">
          No pending reminders.
        </p>
      ) : (
        <div className="py-1">
          {upcoming.map((reminder) => (
            <div key={reminder.id} className="ledger-line px-5">
              <span className="ledger-stamp">
                {formatDateLabel(reminder.remind_at)}
                <br />
                {formatTimestamp(reminder.remind_at)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="ledger-title truncate">
                  {reminder.message || "Reminder"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/dashboard/task-summary-card.tsx'
cat > "frontend/components/dashboard/task-summary-card.tsx" << 'TODOTAK_EOF'
"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useTasks } from "@/hooks/use-tasks";
import { formatDateLabel, formatTimestamp } from "@/lib/utils";

export function TaskSummaryCard() {
  const { data, isLoading } = useTasks({ status: "pending" });

  const relevantTasks = (data?.items ?? [])
    .filter((task) => task.due_date)
    .sort(
      (a, b) =>
        new Date(a.due_date as string).getTime() -
        new Date(b.due_date as string).getTime()
    )
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks due soon</CardTitle>
        <Link
          href="/tasks"
          className="focus-ring rounded-seal font-mono text-xs uppercase tracking-wide text-forest hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      {isLoading ? (
        <Spinner label="Loading tasks" />
      ) : relevantTasks.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-muted">
          Nothing due — you&apos;re clear for now.
        </p>
      ) : (
        <div className="py-1">
          {relevantTasks.map((task) => (
            <div key={task.id} className="ledger-line px-5">
              <span className="ledger-stamp">
                {formatDateLabel(task.due_date as string)}
                <br />
                {formatTimestamp(task.due_date as string)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="ledger-title truncate">{task.title}</p>
              </div>
              <Badge tone={task.priority === "urgent" ? "brick" : "neutral"}>
                {task.priority}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/dashboard/upcoming-meetings-card.tsx'
cat > "frontend/components/dashboard/upcoming-meetings-card.tsx" << 'TODOTAK_EOF'
"use client";

import Link from "next/link";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useMeetings } from "@/hooks/use-meetings";
import { formatDateLabel, formatTimestamp } from "@/lib/utils";

export function UpcomingMeetingsCard() {
  const { data, isLoading } = useMeetings({ status: "scheduled" });

  const upcoming = (data?.items ?? [])
    .filter((meeting) => new Date(meeting.start_time).getTime() >= Date.now())
    .sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    )
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming meetings</CardTitle>
        <Link
          href="/meetings"
          className="focus-ring rounded-seal font-mono text-xs uppercase tracking-wide text-forest hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      {isLoading ? (
        <Spinner label="Loading meetings" />
      ) : upcoming.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-muted">
          Nothing scheduled yet.
        </p>
      ) : (
        <div className="py-1">
          {upcoming.map((meeting) => (
            <div key={meeting.id} className="ledger-line px-5">
              <span className="ledger-stamp">
                {formatDateLabel(meeting.start_time)}
                <br />
                {formatTimestamp(meeting.start_time)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="ledger-title truncate">{meeting.title}</p>
                {meeting.location ? (
                  <p className="text-sm text-ink-muted">{meeting.location}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/layout/app-shell.tsx'
cat > "frontend/components/layout/app-shell.tsx" << 'TODOTAK_EOF'
"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";

interface AppShellProps {
  title: string;
  children: ReactNode;
}

/** Wraps every authenticated page: enforces login and renders the shell. */
export function AppShell({ title, children }: AppShellProps) {
  const router = useRouter();
  const { isAuthenticated, isReady } = useAuth();

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isReady, isAuthenticated, router]);

  if (!isReady || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-paper">
        <Spinner label="Checking your session" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/layout/header.tsx'
cat > "frontend/components/layout/header.tsx" << 'TODOTAK_EOF'
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
TODOTAK_EOF

echo '==> Writing frontend/components/layout/sidebar.tsx'
cat > "frontend/components/layout/sidebar.tsx" << 'TODOTAK_EOF'
"use client";

import {
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
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/meetings", label: "Meetings", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/chat", label: "Chat", icon: MessageSquareText },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const logout = useLogout();

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
                "focus-ring flex items-center gap-3 rounded-seal px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-paper/10 text-paper"
                  : "text-paper/70 hover:bg-paper/5 hover:text-paper"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
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
TODOTAK_EOF

echo '==> Writing frontend/components/meetings/meeting-card.tsx'
cat > "frontend/components/meetings/meeting-card.tsx" << 'TODOTAK_EOF'
"use client";

import { Ban, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useCancelMeeting, useDeleteMeeting } from "@/hooks/use-meetings";
import { cn, formatDateLabel, formatTimestamp } from "@/lib/utils";
import type { Meeting, MeetingStatus } from "@/types";

const statusTone: Record<
  MeetingStatus,
  "neutral" | "forest" | "amber" | "brick"
> = {
  scheduled: "forest",
  completed: "neutral",
  cancelled: "brick",
};

interface MeetingCardProps {
  meeting: Meeting;
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  const cancelMeeting = useCancelMeeting();
  const deleteMeeting = useDeleteMeeting();
  const isCancelled = meeting.status === "cancelled";

  return (
    <div className="ledger-line group px-5">
      <span className="ledger-stamp">
        {formatDateLabel(meeting.start_time)}
        <br />
        {formatTimestamp(meeting.start_time)}–{formatTimestamp(meeting.end_time)}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "ledger-title",
            isCancelled && "text-ink-faint line-through"
          )}
        >
          {meeting.title}
        </p>
        {meeting.location ? (
          <p className="mt-0.5 text-sm text-ink-muted">{meeting.location}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone={statusTone[meeting.status]}>{meeting.status}</Badge>
          {meeting.participants.map((participant) => (
            <Badge key={participant.id} tone="neutral">
              {participant.name || participant.email}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {!isCancelled ? (
          <button
            type="button"
            onClick={() => cancelMeeting.mutate(meeting.id)}
            aria-label="Cancel meeting"
            className="focus-ring rounded-seal p-1.5 text-ink-faint hover:bg-amber-tint hover:text-amber-dark"
          >
            <Ban className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => deleteMeeting.mutate(meeting.id)}
          aria-label="Delete meeting"
          className="focus-ring rounded-seal p-1.5 text-ink-faint hover:bg-brick-tint hover:text-brick"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/meetings/meeting-form-dialog.tsx'
cat > "frontend/components/meetings/meeting-form-dialog.tsx" << 'TODOTAK_EOF'
"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateMeeting } from "@/hooks/use-meetings";
import { localInputToIso } from "@/lib/utils";
import type { ParticipantInput } from "@/types";

interface MeetingFormDialogProps {
  open: boolean;
  onClose: () => void;
}

function parseParticipants(raw: string): ParticipantInput[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((email) => ({ email }));
}

export function MeetingFormDialog({ open, onClose }: MeetingFormDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [participantsInput, setParticipantsInput] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const createMeeting = useCreateMeeting();

  const resetAndClose = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setStartTime("");
    setEndTime("");
    setParticipantsInput("");
    setValidationError(null);
    onClose();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const startIso = localInputToIso(startTime);
    const endIso = localInputToIso(endTime);
    if (!startIso || !endIso) {
      setValidationError("Start and end time are required.");
      return;
    }
    if (new Date(endIso) <= new Date(startIso)) {
      setValidationError("End time must be after start time.");
      return;
    }
    setValidationError(null);

    createMeeting.mutate(
      {
        title,
        description: description || undefined,
        location: location || undefined,
        start_time: startIso,
        end_time: endIso,
        participants: parseParticipants(participantsInput),
      },
      { onSuccess: resetAndClose }
    );
  };

  return (
    <Dialog open={open} onClose={resetAndClose} title="New meeting">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="meeting_title"
            className="mb-1 block text-sm text-ink-muted"
          >
            Title
          </label>
          <Input
            id="meeting_title"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="meeting_description"
            className="mb-1 block text-sm text-ink-muted"
          >
            Description
          </label>
          <Textarea
            id="meeting_description"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="meeting_location"
            className="mb-1 block text-sm text-ink-muted"
          >
            Location
          </label>
          <Input
            id="meeting_location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Zoom, Room 4B, ..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="meeting_start"
              className="mb-1 block text-sm text-ink-muted"
            >
              Starts
            </label>
            <Input
              id="meeting_start"
              type="datetime-local"
              required
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="meeting_end"
              className="mb-1 block text-sm text-ink-muted"
            >
              Ends
            </label>
            <Input
              id="meeting_end"
              type="datetime-local"
              required
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="meeting_participants"
            className="mb-1 block text-sm text-ink-muted"
          >
            Participant emails (comma separated)
          </label>
          <Input
            id="meeting_participants"
            value={participantsInput}
            onChange={(event) => setParticipantsInput(event.target.value)}
            placeholder="ali@example.com, teammate@example.com"
          />
        </div>
        {validationError ? (
          <p role="alert" className="text-sm text-brick">
            {validationError}
          </p>
        ) : null}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={createMeeting.isPending}>
            Schedule meeting
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/meetings/meeting-list.tsx'
cat > "frontend/components/meetings/meeting-list.tsx" << 'TODOTAK_EOF'
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { MeetingCard } from "@/components/meetings/meeting-card";
import { useMeetings } from "@/hooks/use-meetings";
import type { MeetingStatus } from "@/types";

interface MeetingListProps {
  status?: MeetingStatus;
}

export function MeetingList({ status }: MeetingListProps) {
  const { data, isLoading, isError } = useMeetings({ status });

  if (isLoading) {
    return (
      <Card>
        <Spinner label="Loading meetings" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-brick">
            Couldn&apos;t load your meetings. Try refreshing the page.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="font-display text-lg text-ink">
            No meetings on the ledger
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Schedule one, or ask the assistant to set it up.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <div className="py-1">
        {data.items.map((meeting) => (
          <MeetingCard key={meeting.id} meeting={meeting} />
        ))}
      </div>
    </Card>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/tasks/task-card.tsx'
cat > "frontend/components/tasks/task-card.tsx" << 'TODOTAK_EOF'
"use client";

import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useDeleteTask, useUpdateTask } from "@/hooks/use-tasks";
import { cn, formatDateLabel, formatTimestamp } from "@/lib/utils";
import type { Task, TaskPriority } from "@/types";

const priorityTone: Record<
  TaskPriority,
  "neutral" | "forest" | "amber" | "brick"
> = {
  low: "neutral",
  medium: "forest",
  high: "amber",
  urgent: "brick",
};

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const isCompleted = task.status === "completed";

  const toggleComplete = () => {
    updateTask.mutate({
      taskId: task.id,
      input: { status: isCompleted ? "pending" : "completed" },
    });
  };

  return (
    <div className="ledger-line group px-5">
      <span className="ledger-stamp">
        {task.due_date ? (
          <>
            {formatDateLabel(task.due_date)}
            <br />
            {formatTimestamp(task.due_date)}
          </>
        ) : (
          "—"
        )}
      </span>

      <button
        type="button"
        onClick={toggleComplete}
        aria-pressed={isCompleted}
        aria-label={
          isCompleted ? "Mark task as not completed" : "Mark task as completed"
        }
        className={cn(
          "focus-ring mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
          isCompleted ? "border-forest bg-forest" : "border-ink-faint"
        )}
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "ledger-title",
            isCompleted && "text-ink-faint line-through"
          )}
        >
          {task.title}
        </p>
        {task.description ? (
          <p className="mt-0.5 line-clamp-1 text-sm text-ink-muted">
            {task.description}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
          {task.tags.map((tag) => (
            <Badge key={tag.id} tone="neutral">
              #{tag.name}
            </Badge>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => deleteTask.mutate(task.id)}
        aria-label="Delete task"
        className="focus-ring rounded-seal p-1.5 text-ink-faint opacity-0 transition-opacity hover:bg-brick-tint hover:text-brick group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/tasks/task-filters.tsx'
cat > "frontend/components/tasks/task-filters.tsx" << 'TODOTAK_EOF'
"use client";

import { Select } from "@/components/ui/select";
import type { TaskFilters, TaskPriority, TaskStatus } from "@/types";

interface TaskFiltersBarProps {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
}

const STATUS_OPTIONS: TaskStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];
const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high", "urgent"];

export function TaskFiltersBar({ filters, onChange }: TaskFiltersBarProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Select
        aria-label="Filter by status"
        value={filters.status ?? ""}
        onChange={(event) =>
          onChange({
            ...filters,
            status: (event.target.value || undefined) as
              | TaskStatus
              | undefined,
          })
        }
        className="w-44"
      >
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {status.replace("_", " ")}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by priority"
        value={filters.priority ?? ""}
        onChange={(event) =>
          onChange({
            ...filters,
            priority: (event.target.value || undefined) as
              | TaskPriority
              | undefined,
          })
        }
        className="w-44"
      >
        <option value="">All priorities</option>
        {PRIORITY_OPTIONS.map((priority) => (
          <option key={priority} value={priority}>
            {priority}
          </option>
        ))}
      </Select>
    </div>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/tasks/task-form-dialog.tsx'
cat > "frontend/components/tasks/task-form-dialog.tsx" << 'TODOTAK_EOF'
"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTask } from "@/hooks/use-tasks";
import { localInputToIso } from "@/lib/utils";
import type { TaskPriority } from "@/types";

interface TaskFormDialogProps {
  open: boolean;
  onClose: () => void;
}

export function TaskFormDialog({ open, onClose }: TaskFormDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const createTask = useCreateTask();

  const resetAndClose = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setTagsInput("");
    onClose();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createTask.mutate(
      {
        title,
        description: description || undefined,
        priority,
        due_date: localInputToIso(dueDate),
        tags: tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      },
      { onSuccess: resetAndClose }
    );
  };

  return (
    <Dialog open={open} onClose={resetAndClose} title="New task">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="task_title"
            className="mb-1 block text-sm text-ink-muted"
          >
            Title
          </label>
          <Input
            id="task_title"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="task_description"
            className="mb-1 block text-sm text-ink-muted"
          >
            Description
          </label>
          <Textarea
            id="task_description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="task_priority"
              className="mb-1 block text-sm text-ink-muted"
            >
              Priority
            </label>
            <Select
              id="task_priority"
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as TaskPriority)
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>
          <div>
            <label
              htmlFor="task_due"
              className="mb-1 block text-sm text-ink-muted"
            >
              Due
            </label>
            <Input
              id="task_due"
              type="datetime-local"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="task_tags"
            className="mb-1 block text-sm text-ink-muted"
          >
            Tags (comma separated)
          </label>
          <Input
            id="task_tags"
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            placeholder="work, urgent"
          />
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={createTask.isPending}>
            Add task
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/tasks/task-list.tsx'
cat > "frontend/components/tasks/task-list.tsx" << 'TODOTAK_EOF'
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { TaskCard } from "@/components/tasks/task-card";
import { useTasks } from "@/hooks/use-tasks";
import type { TaskFilters } from "@/types";

interface TaskListProps {
  filters: TaskFilters;
}

export function TaskList({ filters }: TaskListProps) {
  const { data, isLoading, isError } = useTasks(filters);

  if (isLoading) {
    return (
      <Card>
        <Spinner label="Loading tasks" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-brick">
            Couldn&apos;t load your tasks. Try refreshing the page.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="font-display text-lg text-ink">
            Nothing on the ledger yet
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Add a task, or tell the assistant what you need to do.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <div className="py-1">
        {data.items.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </Card>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/ui/badge.tsx'
cat > "frontend/components/ui/badge.tsx" << 'TODOTAK_EOF'
import { type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "forest" | "amber" | "brick";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-paper text-ink-muted border-paper-line",
  forest: "bg-forest-tint text-forest-dark border-forest/20",
  amber: "bg-amber-tint text-amber-dark border-amber/30",
  brick: "bg-brick-tint text-brick border-brick/30",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/ui/button.tsx'
cat > "frontend/components/ui/button.tsx" << 'TODOTAK_EOF'
"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-forest text-paper hover:bg-forest-dark",
  secondary:
    "bg-paper-raised text-ink border border-paper-line hover:border-forest/40",
  ghost: "bg-transparent text-ink hover:bg-forest-tint",
  danger: "bg-brick text-paper hover:bg-brick/90",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "text-sm px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2 gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "focus-ring inline-flex items-center justify-center rounded-seal font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
TODOTAK_EOF

echo '==> Writing frontend/components/ui/card.tsx'
cat > "frontend/components/ui/card.tsx" << 'TODOTAK_EOF'
import { type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-seal border border-paper-line bg-paper-raised shadow-ledger",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-paper-line px-5 py-4",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("font-display text-lg text-ink", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: CardProps) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}
TODOTAK_EOF

echo '==> Writing frontend/components/ui/dialog.tsx'
cat > "frontend/components/ui/dialog.tsx" << 'TODOTAK_EOF'
"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";

import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "w-full max-w-lg rounded-seal border border-paper-line bg-paper-raised shadow-xl",
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-paper-line px-5 py-4">
          <h2 id="dialog-title" className="font-display text-lg text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="focus-ring rounded-seal p-1 text-ink-muted hover:bg-forest-tint hover:text-forest-dark"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/ui/input.tsx'
cat > "frontend/components/ui/input.tsx" << 'TODOTAK_EOF'
"use client";

import { type InputHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        <input
          ref={ref}
          className={cn(
            "focus-ring w-full rounded-seal border border-paper-line bg-paper-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint",
            error && "border-brick",
            className
          )}
          {...props}
        />
        {error ? <p className="text-xs text-brick">{error}</p> : null}
      </div>
    );
  }
);
Input.displayName = "Input";
TODOTAK_EOF

echo '==> Writing frontend/components/ui/select.tsx'
cat > "frontend/components/ui/select.tsx" << 'TODOTAK_EOF'
"use client";

import { type SelectHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "focus-ring w-full rounded-seal border border-paper-line bg-paper-raised px-3 py-2 text-sm text-ink",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";
TODOTAK_EOF

echo '==> Writing frontend/components/ui/spinner.tsx'
cat > "frontend/components/ui/spinner.tsx" << 'TODOTAK_EOF'
import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  label?: string;
}

export function Spinner({ className, label = "Loading" }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("flex items-center justify-center py-8", className)}
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-forest border-t-transparent" />
    </div>
  );
}
TODOTAK_EOF

echo '==> Writing frontend/components/ui/textarea.tsx'
cat > "frontend/components/ui/textarea.tsx" << 'TODOTAK_EOF'
"use client";

import { type TextareaHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "focus-ring w-full resize-none rounded-seal border border-paper-line bg-paper-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
TODOTAK_EOF

echo '==> Writing frontend/hooks/use-auth.ts'
cat > "frontend/hooks/use-auth.ts" << 'TODOTAK_EOF'
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import type { LoginRequest, RegisterRequest, TokenResponse, User } from "@/types";

/** Read-only view of the current session. */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  return {
    user,
    isAuthenticated: Boolean(accessToken && user),
    isReady: hasHydrated,
  };
}

export function useLogin() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  return useMutation({
    mutationFn: (payload: LoginRequest) =>
      apiClient.post<TokenResponse>("/api/v1/auth/login", payload, {
        skipAuth: true,
      }),
    onSuccess: async (tokens) => {
      // Set the token first so the /me request below is authenticated.
      setAccessToken(tokens.access_token);
      const user = await apiClient.get<User>("/api/v1/auth/me");
      setSession(user, tokens.access_token);
      router.push("/dashboard");
    },
  });
}

export function useRegister() {
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: RegisterRequest) =>
      apiClient.post<User>("/api/v1/auth/register", payload, {
        skipAuth: true,
      }),
    onSuccess: () => {
      router.push("/login?registered=1");
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const clearSession = useAuthStore((s) => s.clearSession);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post<void>("/api/v1/auth/logout"),
    onSettled: () => {
      clearSession();
      queryClient.clear();
      router.push("/login");
    },
  });
}
TODOTAK_EOF

echo '==> Writing frontend/hooks/use-chat.ts'
cat > "frontend/hooks/use-chat.ts" << 'TODOTAK_EOF'
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type {
  ChatRequest,
  ChatResponse,
  ConversationDetail,
  ConversationSummary,
  PageResponse,
} from "@/types";

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () =>
      apiClient.get<PageResponse<ConversationSummary>>(
        "/api/v1/ai/conversations",
        { page_size: 50 }
      ),
  });
}

export function useConversation(conversationId: string | null) {
  return useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () =>
      apiClient.get<ConversationDetail>(
        `/api/v1/ai/conversations/${conversationId}`
      ),
    enabled: Boolean(conversationId),
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ChatRequest) =>
      apiClient.post<ChatResponse>("/api/v1/ai/chat", payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({
        queryKey: ["conversation", data.conversation_id],
      });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      apiClient.delete<void>(`/api/v1/ai/conversations/${conversationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
TODOTAK_EOF

echo '==> Writing frontend/hooks/use-meetings.ts'
cat > "frontend/hooks/use-meetings.ts" << 'TODOTAK_EOF'
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type {
  Meeting,
  MeetingCreateInput,
  MeetingStatus,
  PageResponse,
  ParticipantResponseStatus,
} from "@/types";

interface MeetingFilters {
  status?: MeetingStatus;
}

const meetingsKey = (filters: MeetingFilters = {}) =>
  ["meetings", filters] as const;

export function useMeetings(filters: MeetingFilters = {}) {
  return useQuery({
    queryKey: meetingsKey(filters),
    queryFn: () =>
      apiClient.get<PageResponse<Meeting>>("/api/v1/meetings", {
        status: filters.status,
        page_size: 100,
      }),
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MeetingCreateInput) =>
      apiClient.post<Meeting>("/api/v1/meetings", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useCancelMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (meetingId: string) =>
      apiClient.post<Meeting>(`/api/v1/meetings/${meetingId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (meetingId: string) =>
      apiClient.delete<void>(`/api/v1/meetings/${meetingId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}

export function useUpdateParticipantResponse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      meetingId,
      participantId,
      responseStatus,
    }: {
      meetingId: string;
      participantId: string;
      responseStatus: ParticipantResponseStatus;
    }) =>
      apiClient.patch<Meeting>(
        `/api/v1/meetings/${meetingId}/participants/${participantId}`,
        { response_status: responseStatus }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
  });
}
TODOTAK_EOF

echo '==> Writing frontend/hooks/use-reminders.ts'
cat > "frontend/hooks/use-reminders.ts" << 'TODOTAK_EOF'
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { PageResponse, Reminder, ReminderCreateInput } from "@/types";

export function useReminders(isSent?: boolean) {
  return useQuery({
    queryKey: ["reminders", { isSent }] as const,
    queryFn: () =>
      apiClient.get<PageResponse<Reminder>>("/api/v1/reminders", {
        is_sent: isSent,
        page_size: 100,
      }),
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReminderCreateInput) =>
      apiClient.post<Reminder>("/api/v1/reminders", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reminderId: string) =>
      apiClient.delete<void>(`/api/v1/reminders/${reminderId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });
}
TODOTAK_EOF

echo '==> Writing frontend/hooks/use-tasks.ts'
cat > "frontend/hooks/use-tasks.ts" << 'TODOTAK_EOF'
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type {
  PageResponse,
  Task,
  TaskCreateInput,
  TaskFilters,
  TaskUpdateInput,
} from "@/types";

const tasksKey = (filters: TaskFilters = {}) => ["tasks", filters] as const;

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: tasksKey(filters),
    queryFn: () =>
      apiClient.get<PageResponse<Task>>("/api/v1/tasks", {
        status: filters.status,
        priority: filters.priority,
        tag: filters.tag,
        page_size: 100,
      }),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskCreateInput) =>
      apiClient.post<Task>("/api/v1/tasks", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      input,
    }: {
      taskId: string;
      input: TaskUpdateInput;
    }) => apiClient.patch<Task>(`/api/v1/tasks/${taskId}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      apiClient.delete<void>(`/api/v1/tasks/${taskId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
TODOTAK_EOF

echo '==> Writing frontend/lib/api-client.ts'
cat > "frontend/lib/api-client.ts" << 'TODOTAK_EOF'
import { API_BASE_URL } from "@/lib/constants";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/types/api";

type QueryParams = Record<string, string | number | boolean | undefined>;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  params?: QueryParams;
  /** Skip attaching the Authorization header (login/register/refresh). */
  skipAuth?: boolean;
}

// Coalesces concurrent 401s into a single refresh call rather than
// firing one refresh request per failed request.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) {
          useAuthStore.getState().clearSession();
          return null;
        }
        const data = (await response.json()) as { access_token: string };
        useAuthStore.getState().setAccessToken(data.access_token);
        return data.access_token;
      } catch {
        useAuthStore.getState().clearSession();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

function buildPath(path: string, params?: QueryParams): string {
  if (!params) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data && typeof data.detail === "string") return data.detail;
  } catch {
    // Response body wasn't JSON; fall through to the generic message.
  }
  return `Request failed with status ${response.status}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params, skipAuth = false } = options;
  const url = `${API_BASE_URL}${buildPath(path, params)}`;

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (!skipAuth) {
      const token = useAuthStore.getState().accessToken;
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return fetch(url, {
      method,
      headers,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let response = await doFetch();

  if (response.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await doFetch();
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorDetail(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(path: string, params?: QueryParams) =>
    request<T>(path, { method: "GET", params }),
  post: <T>(path: string, body?: unknown, options?: Partial<RequestOptions>) =>
    request<T>(path, { method: "POST", body, ...options }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
TODOTAK_EOF

echo '==> Writing frontend/lib/constants.ts'
cat > "frontend/lib/constants.ts" << 'TODOTAK_EOF'
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "/api/gateway";
TODOTAK_EOF

echo '==> Writing frontend/lib/query-client.ts'
cat > "frontend/lib/query-client.ts" << 'TODOTAK_EOF'
import { QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
TODOTAK_EOF

echo '==> Writing frontend/lib/utils.ts'
cat > "frontend/lib/utils.ts" << 'TODOTAK_EOF'
import { type ClassValue, clsx } from "clsx";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Mono ledger-stamp time, e.g. "14:30". */
export function formatTimestamp(iso: string): string {
  return format(new Date(iso), "HH:mm");
}

/** Human day label used in section headings: "Today", "Tomorrow", "Jul 20". */
export function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "MMM d");
}

/** Full ledger date heading, e.g. "Monday, July 20". */
export function formatLongDate(iso: string): string {
  return format(new Date(iso), "EEEE, MMMM d");
}

export function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

/** Converts a <input type="datetime-local"> value to an ISO string, or undefined if empty. */
export function localInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

/** Converts an ISO string to a value usable by <input type="datetime-local">. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}
TODOTAK_EOF

echo '==> Writing frontend/next-env.d.ts'
cat > "frontend/next-env.d.ts" << 'TODOTAK_EOF'
/// <reference types="next" />
/// <reference types="next/image-types/global" />
/// <reference path="./.next/types/routes.d.ts" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
TODOTAK_EOF

echo '==> Writing frontend/next.config.js'
cat > "frontend/next.config.js" << 'TODOTAK_EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/gateway/:path*",
        destination: `${process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8000"}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
TODOTAK_EOF

echo '==> Writing frontend/package.json'
cat > "frontend/package.json" << 'TODOTAK_EOF'
{
  "name": "todotak-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "15.5.18",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "@tanstack/react-query": "5.59.0",
    "zustand": "4.5.5",
    "clsx": "2.1.1",
    "tailwind-merge": "2.5.2",
    "date-fns": "3.6.0",
    "lucide-react": "0.446.0"
  },
  "devDependencies": {
    "typescript": "5.6.2",
    "@types/node": "20.16.10",
    "@types/react": "19.2.3",
    "@types/react-dom": "19.2.3",
    "tailwindcss": "3.4.13",
    "postcss": "8.5.19",
    "autoprefixer": "10.4.20",
    "eslint": "8.57.1",
    "eslint-config-next": "15.5.18",
    "vitest": "2.1.1",
    "@vitejs/plugin-react": "4.3.1",
    "jsdom": "25.0.1"
  }
}
TODOTAK_EOF

echo '==> Writing frontend/postcss.config.js'
cat > "frontend/postcss.config.js" << 'TODOTAK_EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
TODOTAK_EOF

echo '==> Writing frontend/public/.gitkeep'
cat > "frontend/public/.gitkeep" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing frontend/stores/auth-store.ts'
cat > "frontend/stores/auth-store.ts" << 'TODOTAK_EOF'
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  hasHydrated: boolean;
  setSession: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  setHasHydrated: (value: boolean) => void;
}

/**
 * Holds the current user and short-lived access token in memory,
 * persisted to localStorage so a page refresh doesn't force a
 * re-login. The refresh token itself never touches JS — it lives in
 * an httpOnly cookie set by auth-service and is only ever sent
 * automatically by the browser to /auth/refresh.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      hasHydrated: false,
      setSession: (user, accessToken) => set({ user, accessToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      clearSession: () => set({ user: null, accessToken: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "todotak-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
TODOTAK_EOF

echo '==> Writing frontend/tailwind.config.ts'
cat > "frontend/tailwind.config.ts" << 'TODOTAK_EOF'
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // "Hand-kept ledger" token system.
        paper: {
          DEFAULT: "#F5F6F3", // cool paper background, deliberately not cream
          raised: "#FFFFFF",
          line: "#E4E6E1", // hairline rule color
        },
        ink: {
          DEFAULT: "#20241F", // near-black warm charcoal, primary text
          muted: "#5B655C",
          faint: "#8A9A8E",
        },
        forest: {
          DEFAULT: "#1F4B43", // deep teal-ink, primary accent
          dark: "#163731",
          light: "#2F6B5E",
          tint: "#E6EDEA",
        },
        amber: {
          DEFAULT: "#C9762C", // burnt amber, secondary accent
          dark: "#A65F20",
          tint: "#F6E9D9",
        },
        brick: {
          DEFAULT: "#9B3A2E", // urgent/danger, deliberately not bright red
          tint: "#F3E1DE",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-plex-sans)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      boxShadow: {
        ledger: "0 1px 0 0 rgba(32, 36, 31, 0.06)",
      },
      borderRadius: {
        seal: "0.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
TODOTAK_EOF

echo '==> Writing frontend/tests/utils.test.ts'
cat > "frontend/tests/utils.test.ts" << 'TODOTAK_EOF'
import { describe, expect, it } from "vitest";

import {
  cn,
  formatDateLabel,
  formatTimestamp,
  isoToLocalInput,
  localInputToIso,
} from "@/lib/utils";

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-ink", undefined, false, "font-bold")).toBe(
      "text-ink font-bold"
    );
  });
});

describe("formatTimestamp", () => {
  it("formats an ISO string as HH:mm", () => {
    const iso = new Date(2026, 6, 20, 14, 30).toISOString();
    expect(formatTimestamp(iso)).toBe("14:30");
  });
});

describe("formatDateLabel", () => {
  it("labels today as 'Today'", () => {
    const now = new Date();
    expect(formatDateLabel(now.toISOString())).toBe("Today");
  });

  it("labels a far-future date with month and day", () => {
    const future = new Date(2030, 0, 15);
    expect(formatDateLabel(future.toISOString())).toBe("Jan 15");
  });
});

describe("localInputToIso / isoToLocalInput", () => {
  it("round-trips a datetime-local value", () => {
    const localValue = "2026-07-20T14:30";
    const iso = localInputToIso(localValue);
    expect(iso).toBeDefined();
    expect(isoToLocalInput(iso)).toBe(localValue);
  });

  it("returns undefined for an empty input", () => {
    expect(localInputToIso("")).toBeUndefined();
  });

  it("returns an empty string for a null/undefined ISO value", () => {
    expect(isoToLocalInput(null)).toBe("");
    expect(isoToLocalInput(undefined)).toBe("");
  });
});
TODOTAK_EOF

echo '==> Writing frontend/tsconfig.json'
cat > "frontend/tsconfig.json" << 'TODOTAK_EOF'
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules", "tests"]
}
TODOTAK_EOF

echo '==> Writing frontend/types/api.ts'
cat > "frontend/types/api.ts" << 'TODOTAK_EOF'
export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiErrorBody {
  detail: string;
  errors?: unknown;
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}
TODOTAK_EOF

echo '==> Writing frontend/types/auth.ts'
cat > "frontend/types/auth.ts" << 'TODOTAK_EOF'
export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  full_name: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}
TODOTAK_EOF

echo '==> Writing frontend/types/chat.ts'
cat > "frontend/types/chat.ts" << 'TODOTAK_EOF'
export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface ToolCallPayload {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string | null;
  tool_calls: ToolCallPayload[] | null;
  tool_call_id: string | null;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: Message[];
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface ChatResponse {
  conversation_id: string;
  message: Message;
  tool_messages: Message[];
}
TODOTAK_EOF

echo '==> Writing frontend/types/index.ts'
cat > "frontend/types/index.ts" << 'TODOTAK_EOF'
export * from "./api";
export * from "./auth";
export * from "./task";
export * from "./meeting";
export * from "./reminder";
export * from "./chat";
TODOTAK_EOF

echo '==> Writing frontend/types/meeting.ts'
cat > "frontend/types/meeting.ts" << 'TODOTAK_EOF'
export type MeetingStatus = "scheduled" | "cancelled" | "completed";
export type ParticipantResponseStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "tentative";

export interface Participant {
  id: string;
  email: string;
  name: string | null;
  response_status: ParticipantResponseStatus;
}

export interface Meeting {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  status: MeetingStatus;
  created_at: string;
  updated_at: string;
  participants: Participant[];
}

export interface ParticipantInput {
  email: string;
  name?: string;
}

export interface MeetingCreateInput {
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  participants?: ParticipantInput[];
}

export interface MeetingUpdateInput {
  title?: string;
  description?: string;
  location?: string;
  start_time?: string;
  end_time?: string;
  status?: MeetingStatus;
}
TODOTAK_EOF

echo '==> Writing frontend/types/reminder.ts'
cat > "frontend/types/reminder.ts" << 'TODOTAK_EOF'
export interface Reminder {
  id: string;
  user_id: string;
  task_id: string | null;
  meeting_id: string | null;
  remind_at: string;
  message: string | null;
  is_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReminderCreateInput {
  remind_at: string;
  message?: string;
  task_id?: string;
  meeting_id?: string;
}

export interface ReminderUpdateInput {
  remind_at?: string;
  message?: string;
}
TODOTAK_EOF

echo '==> Writing frontend/types/task.ts'
cat > "frontend/types/task.ts" << 'TODOTAK_EOF'
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskTag {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  tags: TaskTag[];
}

export interface TaskCreateInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: string;
  tags?: string[];
}

export interface TaskUpdateInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  tag?: string;
}
TODOTAK_EOF

echo '==> Writing frontend/vitest.config.ts'
cat > "frontend/vitest.config.ts" << 'TODOTAK_EOF'
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": __dirname,
    },
  },
});
TODOTAK_EOF

echo '==> frontend files written successfully'
echo 'Next steps:'
echo '  1. cp frontend/.env.local.example frontend/.env.local'
echo '  2. cd frontend && npm install'
echo '  3. npm run typecheck   (should be clean)'
echo '  4. npm test            (7 tests, no backend needed)'
echo '  5. npm run dev         (starts on http://localhost:3000)'