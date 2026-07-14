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
