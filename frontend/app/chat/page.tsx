"use client";

import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ChatWindow } from "@/components/chat/chat-window";
import { ConversationSidebar } from "@/components/chat/conversation-sidebar";
import { Card } from "@/components/ui/card";

export default function ChatPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);

  return (
    <AppShell title="Chat">
      <Card className="flex h-[calc(100vh-176px)] overflow-hidden">
        <ConversationSidebar
          activeConversationId={conversationId}
          onSelect={setConversationId}
        />
        <ChatWindow
          conversationId={conversationId}
          onConversationCreated={setConversationId}
        />
      </Card>
    </AppShell>
  );
}
