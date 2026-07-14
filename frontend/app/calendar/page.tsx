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
