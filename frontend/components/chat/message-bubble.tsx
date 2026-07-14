import { Bot, User, Wrench } from "lucide-react";

import { cn, formatTimestamp } from "@/lib/utils";
import type { Message } from "@/types";

function summarizeToolContent(content: string | null): string {
  if (!content) return "Done.";
  try {
    const parsed = JSON.parse(content);
    if (parsed?.error) return `Couldn't complete that: ${parsed.error}`;
    if (parsed?.status === "deleted") return "Deleted.";
    if (typeof parsed?.title === "string") return `"${parsed.title}"`;
    return "Done.";
  } catch {
    return content;
  }
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "system") return null;

  if (message.role === "tool") {
    return (
      <div className="flex items-center gap-2 py-1 pl-9 text-xs text-ink-faint">
        <Wrench className="h-3 w-3" />
        <span>{summarizeToolContent(message.content)}</span>
      </div>
    );
  }

  // Assistant messages that only carried tool_calls (no text yet) don't
  // need their own bubble; the tool notes above stand in for them.
  if (message.role === "assistant" && !message.content && message.tool_calls?.length) {
    return null;
  }

  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 py-2", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-amber-tint text-amber-dark"
            : "bg-forest-tint text-forest-dark"
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[75%] rounded-seal border px-4 py-2.5 text-sm",
          isUser
            ? "border-amber/30 bg-amber-tint text-ink"
            : "border-forest/20 bg-forest-tint text-ink"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p className="mt-1 font-mono text-[10px] text-ink-faint">
          {formatTimestamp(message.created_at)}
        </p>
      </div>
    </div>
  );
}
