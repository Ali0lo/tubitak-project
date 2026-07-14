export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface ToolCallPayload {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string | null;
  tool_calls: ToolCallPayload[] | null;
  tool_call_id: string | null;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: Message[];
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface ChatResponse {
  conversation_id: string;
  message: Message;
  tool_messages: Message[];
}
