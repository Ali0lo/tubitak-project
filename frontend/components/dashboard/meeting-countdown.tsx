"use client";

import { useEffect, useState, useMemo } from "react";
import { format, differenceInSeconds, isAfter, isBefore } from "date-fns";
import { Video, Clock, ExternalLink, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Meeting } from "@/types/meeting";

interface MeetingCountdownProps {
  meetings: Meeting[];
}

export function MeetingCountdown({ meetings }: MeetingCountdownProps) {
  const [now, setNow] = useState<Date>(new Date());

  // Update timer every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Find next upcoming meeting starting after current time
  const nextMeeting = useMemo(() => {
    const upcoming = meetings
      .filter((m) => m.status === "scheduled" && isAfter(new Date(m.start_time), now))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    return upcoming[0] || null;
  }, [meetings, now]);

  // Format countdown string and status
  const countdownInfo = useMemo(() => {
    if (!nextMeeting) return null;

    const startTime = new Date(nextMeeting.start_time);
    const diffSeconds = differenceInSeconds(startTime, now);

    if (diffSeconds <= 0) return { formatted: "Starting Now", isUrgent: true, minutes: 0 };

    const hours = Math.floor(diffSeconds / 3600);
    const mins = Math.floor((diffSeconds % 3600) / 60);
    const secs = diffSeconds % 60;

    let text = "";
    if (hours > 0) {
      text = `${hours}h ${mins}m`;
    } else if (mins > 0) {
      text = `${mins}m ${secs}s`;
    } else {
      text = `${secs}s`;
    }

    const totalMinutes = Math.ceil(diffSeconds / 60);

    return {
      formatted: text,
      isUrgent: diffSeconds < 900, // less than 15 minutes
      minutes: totalMinutes,
      description: totalMinutes === 1 ? "1 minute" : `${totalMinutes} minutes`,
    };
  }, [nextMeeting, now]);

  if (!nextMeeting || !countdownInfo) {
    return (
      <Card className="p-4 bg-sky-50/60 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300 rounded-lg">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-sky-600 dark:text-sky-400 font-medium">
              Upcoming Meetings
            </p>
            <p className="text-sm font-medium text-ink-muted mt-0.5">No upcoming meetings scheduled today</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={`p-4 transition-colors border ${
        countdownInfo.isUrgent
          ? "bg-gradient-to-r from-red-500/10 to-amber-500/10 border-red-300 dark:border-red-800"
          : "bg-gradient-to-r from-sky-500/10 via-indigo-500/5 to-transparent border-sky-300 dark:border-sky-800"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              countdownInfo.isUrgent
                ? "bg-red-500 text-white shadow-md shadow-red-500/20 animate-bounce"
                : "bg-sky-600 dark:bg-sky-500 text-white shadow-md shadow-sky-500/20"
            }`}
          >
            <Video className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase font-semibold text-sky-700 dark:text-sky-300">
                Next Meeting
              </span>
              <Badge tone={countdownInfo.isUrgent ? "urgent" : "sky"} className="text-[10px]">
                In {countdownInfo.description}
              </Badge>
            </div>
            <p className="font-semibold text-ink text-sm sm:text-base truncate mt-0.5">
              {nextMeeting.title}
            </p>
            <div className="flex items-center gap-2 text-xs text-ink-muted font-mono mt-0.5">
              <Clock className="h-3 w-3 text-sky-500" />
              <span>{format(new Date(nextMeeting.start_time), "HH:mm")} - {format(new Date(nextMeeting.end_time), "HH:mm")}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0">
          <div
            className={`text-lg sm:text-xl font-mono font-bold px-3 py-1 rounded-lg border ${
              countdownInfo.isUrgent
                ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                : "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800"
            }`}
          >
            {countdownInfo.formatted}
          </div>

          {(nextMeeting.meeting_link || nextMeeting.location) && (
            <a
              href={nextMeeting.meeting_link || nextMeeting.location || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
            >
              <span>{nextMeeting.location?.startsWith("http") ? "Join Call" : nextMeeting.location || "Join Call"}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
