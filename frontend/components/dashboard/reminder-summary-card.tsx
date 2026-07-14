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
