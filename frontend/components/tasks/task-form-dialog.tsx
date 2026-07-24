"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTask } from "@/hooks/use-tasks";
import { localInputToIso } from "@/lib/utils";
import type { TaskPriority, RecurrenceFrequency } from "@/types";

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

  // Recurrence
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("daily");
  const [intervalVal, setIntervalVal] = useState(1);
  const [customUnit, setCustomUnit] = useState("days");

  const createTask = useCreateTask();

  const resetAndClose = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setTagsInput("");
    setIsRecurring(false);
    setFrequency("daily");
    setIntervalVal(1);
    setCustomUnit("days");
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
        is_recurring: isRecurring,
        recurrence_rule: isRecurring
          ? {
              frequency,
              interval: Number(intervalVal),
              unit: frequency === "custom" ? customUnit : "days",
            }
          : undefined,
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

        {/* Recurrence Section */}
        <div className="p-3 bg-paper-tint border border-paper-line rounded-md space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_recurring"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-paper-line text-forest focus:ring-forest"
            />
            <label htmlFor="is_recurring" className="text-sm font-medium text-ink cursor-pointer">
              Recurring Task
            </label>
          </div>

          {isRecurring ? (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Frequency</label>
                <Select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekdays_only">Weekdays only</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="custom">Custom interval</option>
                </Select>
              </div>

              {frequency === "custom" ? (
                <div className="flex gap-2">
                  <div className="w-1/2">
                    <label className="mb-1 block text-xs text-ink-muted">Interval</label>
                    <Input
                      type="number"
                      min={1}
                      value={intervalVal}
                      onChange={(e) => setIntervalVal(Number(e.target.value))}
                    />
                  </div>
                  <div className="w-1/2">
                    <label className="mb-1 block text-xs text-ink-muted">Unit</label>
                    <Select
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value)}
                    >
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                      <option value="years">Years</option>
                    </Select>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
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
