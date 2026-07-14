"use client";

import { Send } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (message: string) => void;
  isSending: boolean;
}

export function ChatInput({ onSend, isSending }: ChatInputProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isSending) return;
    onSend(trimmed);
    setValue("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 border-t border-paper-line p-4"
    >
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder="Ask me to add a task, schedule a meeting, or set a reminder..."
        className="max-h-32"
        aria-label="Message"
      />
      <Button type="submit" isLoading={isSending} disabled={!value.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
