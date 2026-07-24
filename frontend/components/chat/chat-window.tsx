"use client";

import { useEffect, useRef } from "react";

import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble, TypingIndicatorBubble } from "@/components/chat/message-bubble";
import { Spinner } from "@/components/ui/spinner";
import { useConversation, useSendMessage } from "@/hooks/use-chat";

interface ChatWindowProps {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
}

export function ChatWindow({
  conversationId,
  onConversationCreated,
}: ChatWindowProps) {
  const { data: conversation, isLoading } = useConversation(conversationId);
  const sendMessage = useSendMessage();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length, sendMessage.isPending]);

  const handleSend = (text: string) => {
    sendMessage.mutate(
      { message: text, conversation_id: conversationId ?? undefined },
      {
        onSuccess: (data) => {
          if (!conversationId) onConversationCreated(data.conversation_id);
        },
      }
    );
  };

  const messagesList = conversation?.messages ?? [];
  const lastMsgIndex = messagesList.length - 1;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!conversationId ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="font-display text-xl text-ink">
              What can I help with?
            </p>
            <p className="mt-1 max-w-sm text-sm text-ink-muted">
              Ask me to add a task, schedule a meeting, set a reminder, or
              check what&apos;s on your plate today.
            </p>
          </div>
        ) : isLoading ? (
          <Spinner label="Loading conversation" />
        ) : (
          <>
            {messagesList.map((message, idx) => (
              <MessageBubble
                key={message.id}
                message={message}
                animateStream={idx === lastMsgIndex && message.role === "assistant"}
              />
            ))}
            {sendMessage.isPending && <TypingIndicatorBubble />}
            <div ref={bottomRef} />
          </>
        )}
      </div>
      <ChatInput onSend={handleSend} isSending={sendMessage.isPending} />
    </div>
  );
}
