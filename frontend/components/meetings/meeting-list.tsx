"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { MeetingCard } from "@/components/meetings/meeting-card";
import { useMeetings } from "@/hooks/use-meetings";
import { EmptyState } from "@/components/ui/empty-state";
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
      <EmptyState
        title="No meetings on the ledger!"
        description="You have no upcoming or recorded meetings matching this filter."
        iconType="coffee"
      />
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
