"use client";

import React, { useState } from "react";
import { Send, User as UserIcon } from "lucide-react";
import { useCreateComment, useTaskComments } from "@/hooks/use-task-comments";
import { formatTimestamp } from "@/lib/utils";

interface TaskCommentsProps {
  taskId: string;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
  const { data: comments = [], isLoading } = useTaskComments(taskId);
  const createComment = useCreateComment(taskId);
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    createComment.mutate(
      { message: message.trim(), author_name: "You" },
      {
        onSuccess: () => setMessage(""),
      }
    );
  };

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
        Comments & Discussion ({comments.length})
      </h4>

      {/* Discussion Thread */}
      {isLoading ? (
        <div className="py-4 text-center text-xs text-ink-faint">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-paper-line p-4 text-center text-xs text-ink-faint">
          No comments yet. Start the conversation below!
        </div>
      ) : (
        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="flex items-start gap-2.5 rounded-lg border border-paper-line bg-paper/70 p-3"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest text-xs font-bold">
                <UserIcon className="h-3.5 w-3.5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">{comment.author_name}</span>
                  <span className="text-[10px] text-ink-faint">
                    {formatTimestamp(comment.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink whitespace-pre-wrap">{comment.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Write a comment..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="focus-ring flex-1 rounded-md border border-paper-line bg-paper px-3 py-2 text-xs text-ink placeholder:text-ink-faint"
        />
        <button
          type="submit"
          disabled={!message.trim() || createComment.isPending}
          className="focus-ring inline-flex items-center gap-1 rounded-md bg-forest px-3 py-2 text-xs font-semibold text-paper hover:bg-forest-dark transition-colors disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Comment</span>
        </button>
      </form>
    </div>
  );
}
