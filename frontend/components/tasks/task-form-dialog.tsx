"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTask } from "@/hooks/use-tasks";
import { localInputToIso } from "@/lib/utils";
import type { TaskPriority } from "@/types";

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
  const createTask = useCreateTask();

  const resetAndClose = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setTagsInput("");
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
