"use client";

import React, { useState } from "react";
import { Block, BlockType } from "@/types/block";
import { DragHandle } from "./drag-handle";
import { TextBlock } from "./extensions/block-types/text-block";
import { HeadingBlock } from "./extensions/block-types/heading-block";
import { TodoBlock } from "./extensions/block-types/todo-block";
import { ListBlock } from "./extensions/block-types/list-block";
import { ToggleBlock } from "./extensions/block-types/toggle-block";
import { CodeBlock } from "./extensions/block-types/code-block";
import { QuoteBlock } from "./extensions/block-types/quote-block";
import { CalloutBlock } from "./extensions/block-types/callout-block";
import { DividerBlock } from "./extensions/block-types/divider-block";
import { TableBlock } from "./extensions/block-types/table-block";
import { ImageBlock } from "./extensions/block-types/image-block";
import { evaluateMarkdownTrigger } from "./extensions/markdown-shortcuts";
import { handleBlockKeyDown } from "./extensions/keyboard-handlers";
import { UserPresence } from "@/types/presence";

interface BlockItemProps {
  block: Block;
  blocks: Block[];
  isFocused: boolean;
  caretOffset: number | null;
  remotePresences: UserPresence[];
  onAddBlock: (newBlock: Block, afterId: string) => void;
  onUpdateBlock: (id: string, updates: Partial<Block>) => void;
  onRemoveBlock: (id: string) => void;
  onFocusBlock: (id: string, caretOffset?: number) => void;
  onOpenSlashMenu: (
    blockId: string,
    position: { top: number; left: number },
    filter?: string
  ) => void;
  onCloseSlashMenu: () => void;
  onDropBlock: (draggedBlockId: string, targetBlockId: string, position: "before" | "after") => void;
}

export function BlockItem({
  block,
  blocks,
  isFocused,
  caretOffset,
  remotePresences,
  onAddBlock,
  onUpdateBlock,
  onRemoveBlock,
  onFocusBlock,
  onOpenSlashMenu,
  onCloseSlashMenu,
  onDropBlock,
}: BlockItemProps) {
  const [isDragOver, setIsDragOver] = useState<"before" | "after" | null>(null);
  const [toggleOpen, setToggleOpen] = useState(
    block.properties?.isOpen !== undefined ? block.properties.isOpen : true
  );

  const handleTextChange = (text: string) => {
    // 1. Check for Markdown triggers (e.g. "# ", "[] ", "1. ", etc.)
    const mdResult = evaluateMarkdownTrigger(text);
    if (mdResult.matched) {
      onUpdateBlock(block.id, {
        type: mdResult.type,
        content: [{ text: mdResult.remainingText }],
        properties:
          mdResult.type === "to_do" ? { checked: false } : block.properties,
      });
      return;
    }

    // 2. Check for slash menu trigger '/'
    if (text.startsWith("/")) {
      const filter = text.slice(1);
      // Estimate menu position near block
      const element = document.getElementById(`block-${block.id}`);
      if (element) {
        const rect = element.getBoundingClientRect();
        onOpenSlashMenu(
          block.id,
          { top: rect.bottom + 4, left: Math.max(16, rect.left) },
          filter
        );
      }
    } else {
      onCloseSlashMenu();
    }

    // 3. Update block content
    onUpdateBlock(block.id, {
      content: [{ text }],
    });
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    currentOffset: number,
    text: string
  ) => {
    handleBlockKeyDown(e, {
      block,
      blocks,
      caretOffset: currentOffset,
      textValue: text,
      onAddBlock,
      onUpdateBlock,
      onRemoveBlock,
      onFocusBlock,
    });
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", block.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setIsDragOver(e.clientY < midY ? "before" : "after");
  };

  const handleDragLeave = () => {
    setIsDragOver(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (draggedId && draggedId !== block.id && isDragOver) {
      onDropBlock(draggedId, block.id, isDragOver);
    }
    setIsDragOver(null);
  };

  const renderBlockContent = () => {
    switch (block.type) {
      case "heading_1":
        return (
          <HeadingBlock
            block={block}
            level={1}
            isFocused={isFocused}
            caretOffset={caretOffset}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusBlock(block.id)}
          />
        );
      case "heading_2":
        return (
          <HeadingBlock
            block={block}
            level={2}
            isFocused={isFocused}
            caretOffset={caretOffset}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusBlock(block.id)}
          />
        );
      case "heading_3":
        return (
          <HeadingBlock
            block={block}
            level={3}
            isFocused={isFocused}
            caretOffset={caretOffset}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusBlock(block.id)}
          />
        );
      case "to_do":
        return (
          <TodoBlock
            block={block}
            isFocused={isFocused}
            caretOffset={caretOffset}
            onChange={handleTextChange}
            onToggleCheck={(checked) =>
              onUpdateBlock(block.id, {
                properties: { ...block.properties, checked },
              })
            }
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusBlock(block.id)}
          />
        );
      case "bulleted_list":
        return (
          <ListBlock
            block={block}
            listType="bulleted_list"
            isFocused={isFocused}
            caretOffset={caretOffset}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusBlock(block.id)}
          />
        );
      case "numbered_list":
        return (
          <ListBlock
            block={block}
            listType="numbered_list"
            isFocused={isFocused}
            caretOffset={caretOffset}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusBlock(block.id)}
          />
        );
      case "toggle":
        return (
          <ToggleBlock
            block={block}
            isFocused={isFocused}
            caretOffset={caretOffset}
            isOpen={toggleOpen}
            onToggleOpen={() => {
              const next = !toggleOpen;
              setToggleOpen(next);
              onUpdateBlock(block.id, {
                properties: { ...block.properties, isOpen: next },
              });
            }}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusBlock(block.id)}
          />
        );
      case "code":
        return (
          <CodeBlock
            block={block}
            isFocused={isFocused}
            caretOffset={caretOffset}
            onChange={handleTextChange}
            onLanguageChange={(lang) =>
              onUpdateBlock(block.id, {
                properties: { ...block.properties, language: lang },
              })
            }
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusBlock(block.id)}
          />
        );
      case "quote":
        return (
          <QuoteBlock
            block={block}
            isFocused={isFocused}
            caretOffset={caretOffset}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusBlock(block.id)}
          />
        );
      case "callout":
        return (
          <CalloutBlock
            block={block}
            isFocused={isFocused}
            caretOffset={caretOffset}
            onChange={handleTextChange}
            onIconChange={(icon) =>
              onUpdateBlock(block.id, {
                properties: { ...block.properties, calloutIcon: icon },
              })
            }
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusBlock(block.id)}
          />
        );
      case "divider":
        return <DividerBlock block={block} onFocus={() => onFocusBlock(block.id)} />;
      case "table":
        return (
          <TableBlock
            block={block}
            onChange={(tableData) =>
              onUpdateBlock(block.id, {
                properties: { ...block.properties, tableData },
              })
            }
            onFocus={() => onFocusBlock(block.id)}
          />
        );
      case "image":
        return (
          <ImageBlock
            block={block}
            onChangeUrl={(url) =>
              onUpdateBlock(block.id, {
                properties: { ...block.properties, url },
              })
            }
            onFocus={() => onFocusBlock(block.id)}
          />
        );
      case "text":
      default:
        return (
          <TextBlock
            block={block}
            isFocused={isFocused}
            caretOffset={caretOffset}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => onFocusBlock(block.id)}
          />
        );
    }
  };

  const isNested = !!block.parent_block_id;

  return (
    <div
      id={`block-${block.id}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group/block relative flex items-start gap-1 py-0.5 rounded transition-all ${
        isNested ? "ml-6" : ""
      } ${
        isDragOver === "before"
          ? "border-t-2 border-indigo-500"
          : isDragOver === "after"
          ? "border-b-2 border-indigo-500"
          : ""
      }`}
    >
      {/* Left Gutter: Drag Handle & Quick Add */}
      <div className="w-12 -ml-12 flex-shrink-0 flex justify-end pr-1 pt-0.5 select-none">
        <DragHandle
          block={block}
          onAddBlockBelow={() => {
            const nextBlock: Block = {
              id: crypto.randomUUID(),
              page_id: block.page_id,
              parent_block_id: block.parent_block_id,
              type: "text",
              content: [{ text: "" }],
              properties: {},
              sort_order: "",
            };
            onAddBlock(nextBlock, block.id);
          }}
          onDeleteBlock={() => onRemoveBlock(block.id)}
          onDuplicateBlock={() => {
            const dup: Block = {
              ...block,
              id: crypto.randomUUID(),
              sort_order: "",
            };
            onAddBlock(dup, block.id);
          }}
          onTurnInto={(type) => onUpdateBlock(block.id, { type })}
          onDragStart={handleDragStart}
        />
      </div>

      {/* Block Content Container */}
      <div className="flex-1 min-w-0 relative">
        {renderBlockContent()}

        {/* Remote Collaborator Presence Tag */}
        {remotePresences.length > 0 && (
          <div className="absolute right-0 top-0 flex items-center gap-1 pointer-events-none">
            {remotePresences.map((peer) => (
              <span
                key={peer.clientId}
                style={{ backgroundColor: peer.color }}
                className="text-[10px] font-semibold text-white px-1.5 py-0.5 rounded shadow-sm opacity-90 animate-pulse"
              >
                {peer.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
