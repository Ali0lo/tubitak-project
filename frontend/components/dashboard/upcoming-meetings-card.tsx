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
