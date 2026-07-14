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
