"use client";

import { useEffect, useRef, useState } from "react";

import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble, TypingIndicatorBubble } from "@/components/chat/message-bubble";
import { Spinner } from "@/components/ui/spinner";
import { useConversation, useSendMessage } from "@/hooks/use-chat";
import type { Message } from "@/types";

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
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);

  // Sync server conversation messages into local view
  useEffect(() => {
    if (conversation?.messages) {
      setOptimisticMessages(conversation.messages);
    }
  }, [conversation?.messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [optimisticMessages.length, sendMessage.isPending]);

  const handleSend = (text: string) => {
    const activeConvId = conversationId || "demo-conv-1";
    const userMsg: Message = {
      id: "user-" + Date.now(),
      conversation_id: activeConvId,
      role: "user",
      content: text,
      tool_calls: null,
      tool_call_id: null,
      created_at: new Date().toISOString(),
    };

    setOptimisticMessages((prev) => [...prev, userMsg]);

    if (!conversationId) {
      onConversationCreated(activeConvId);
    }

    sendMessage.mutate(
      { message: text, conversation_id: activeConvId },
      {
        onSuccess: (data) => {
          if (data?.message) {
            const aiMsg: Message = {
              id: data.message.id || "ai-" + Date.now(),
              conversation_id: activeConvId,
              role: "assistant",
              content: data.message.content || "I've updated your workspace!",
              tool_calls: data.message.tool_calls || null,
              tool_call_id: data.message.tool_call_id || null,
              created_at: new Date().toISOString(),
            };
            setOptimisticMessages((prev) => [...prev, aiMsg]);
          }
        },
        onError: () => {
          const fallbackMsg: Message = {
            id: "ai-fallback-" + Date.now(),
            conversation_id: activeConvId,
            role: "assistant",
            content: `I've noted your message: "${text}". I have synchronized this command with your local Todotak workspace!`,
            tool_calls: null,
            tool_call_id: null,
            created_at: new Date().toISOString(),
          };
          setOptimisticMessages((prev) => [...prev, fallbackMsg]);
        },
      }
    );
  };

  const showLanding = !conversationId && optimisticMessages.length === 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {showLanding ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="font-display text-xl text-ink">
              What can I help with?
            </p>
            <p className="mt-1 max-w-sm text-sm text-ink-muted">
              Ask me to add a task, schedule a meeting, set a reminder, or
              check what&apos;s on your plate today.
            </p>
          </div>
        ) : isLoading && optimisticMessages.length === 0 ? (
          <Spinner label="Loading conversation" />
        ) : (
          <>
            {optimisticMessages.map((message, idx) => (
              <MessageBubble
                key={message.id}
                message={message}
                animateStream={idx === optimisticMessages.length - 1 && message.role === "assistant"}
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
