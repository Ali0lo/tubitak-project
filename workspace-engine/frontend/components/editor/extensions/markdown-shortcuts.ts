import { BlockType } from "@/types/block";

export interface MarkdownMatch {
  matched: boolean;
  type: BlockType;
  remainingText: string;
}

export function evaluateMarkdownTrigger(text: string): MarkdownMatch {
  if (text.startsWith("# ")) {
    return { matched: true, type: "heading_1", remainingText: text.slice(2) };
  }
  if (text.startsWith("## ")) {
    return { matched: true, type: "heading_2", remainingText: text.slice(3) };
  }
  if (text.startsWith("### ")) {
    return { matched: true, type: "heading_3", remainingText: text.slice(4) };
  }
  if (text.startsWith("- ") || text.startsWith("* ")) {
    return { matched: true, type: "bulleted_list", remainingText: text.slice(2) };
  }
  if (text.startsWith("1. ")) {
    return { matched: true, type: "numbered_list", remainingText: text.slice(3) };
  }
  if (text.startsWith("[] ") || text.startsWith("[ ] ")) {
    const offset = text.startsWith("[ ] ") ? 4 : 3;
    return { matched: true, type: "to_do", remainingText: text.slice(offset) };
  }
  if (text.startsWith("> ")) {
    return { matched: true, type: "quote", remainingText: text.slice(2) };
  }
  if (text.startsWith("```")) {
    return { matched: true, type: "code", remainingText: text.slice(3) };
  }
  if (text === "---") {
    return { matched: true, type: "divider", remainingText: "" };
  }

  return { matched: false, type: "text", remainingText: text };
}
