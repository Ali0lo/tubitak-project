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
