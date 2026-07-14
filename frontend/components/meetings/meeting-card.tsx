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
