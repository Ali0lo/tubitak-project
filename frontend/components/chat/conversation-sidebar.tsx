"use client";

import { Plus, Trash2 } from "lucide-react";

import { useConversations, useDeleteConversation } from "@/hooks/use-chat";
import { cn, formatRelative } from "@/lib/utils";

interface ConversationSidebarProps {
  activeConversationId: string | null;
  onSelect: (id: string | null) => void;
}

export function ConversationSidebar({
  activeConversationId,
  onSelect,
}: ConversationSidebarProps) {
  const { data, isLoading } = useConversations();
  const deleteConversation = useDeleteConversation();

  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-paper-line">
      <div className="border-b border-paper-line p-3">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="focus-ring flex w-full items-center gap-2 rounded-seal border border-paper-line px-3 py-2 text-sm text-ink hover:border-forest/40"
        >
          <Plus className="h-4 w-4" />
          New conversation
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="p-4 text-sm text-ink-faint">Loading...</p>
        ) : null}
        {data && data.items.length === 0 ? (
          <p className="p-4 text-sm text-ink-faint">No conversations yet.</p>
        ) : null}
        {data?.items.map((conversation) => (
          <div
            key={conversation.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(conversation.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSelect(conversation.id);
            }}
            className={cn(
              "group flex cursor-pointer items-center justify-between gap-2 border-b border-paper-line px-3 py-3",
              activeConversationId === conversation.id
                ? "bg-forest-tint"
                : "hover:bg-paper"
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">
                {conversation.title || "New conversation"}
              </p>
              <p className="font-mono text-[10px] text-ink-faint">
                {formatRelative(conversation.updated_at)}
              </p>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                deleteConversation.mutate(conversation.id);
                if (activeConversationId === conversation.id) onSelect(null);
              }}
              aria-label="Delete conversation"
              className="focus-ring shrink-0 rounded-seal p-1 text-ink-faint opacity-0 hover:bg-brick-tint hover:text-brick group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
