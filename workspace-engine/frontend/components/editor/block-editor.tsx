"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { Block, BlockType } from "@/types/block";
import { Page } from "@/types/page";
import { useEditorStore } from "@/stores/editor-store";
import { usePresenceStore } from "@/stores/presence-store";
import { BlockItem } from "./block-item";
import { SlashMenu } from "./slash-menu";
import { BubbleMenu } from "./bubble-menu";
import { generateFractionalIndex } from "@/lib/fractional-indexing";
import { apiClient } from "@/lib/api-client";
import { CollaborationProvider } from "@/lib/yjs/yjs-provider";
import { YjsBlockBinding } from "@/lib/yjs/yjs-binding";

interface BlockEditorProps {
  page: Page;
  initialBlocks: Block[];
  onPageUpdate?: (updates: Partial<Page>) => void;
}

export function BlockEditor({
  page,
  initialBlocks,
  onPageUpdate,
}: BlockEditorProps) {
  const {
    blocks,
    setBlocks,
    focusedBlockId,
    focusCaretOffset,
    setFocusedBlockId,
    addBlock,
    updateBlock,
    removeBlock,
    reorderBlockOptimistic,
    slashMenuOpen,
    slashMenuTargetBlockId,
    slashMenuFilter,
    slashMenuPosition,
    openSlashMenu,
    closeSlashMenu,
    setIsSaving,
    setLastSavedAt,
  } = useEditorStore();

  const peers = usePresenceStore((s) => s.peers);
  const collabProviderRef = useRef<CollaborationProvider | null>(null);
  const yjsBindingRef = useRef<YjsBlockBinding | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize blocks
  useEffect(() => {
    if (initialBlocks.length > 0) {
      setBlocks(initialBlocks);
    } else {
      // Default initial text block
      const firstBlock: Block = {
        id: crypto.randomUUID(),
        page_id: page.id,
        parent_block_id: null,
        type: "text",
        content: [{ text: "" }],
        properties: {},
        sort_order: "a0",
      };
      setBlocks([firstBlock]);
    }
  }, [page.id, initialBlocks, setBlocks]);

  // Initialize Yjs real-time collaboration
  useEffect(() => {
    const provider = new CollaborationProvider(page.id);
    const binding = new YjsBlockBinding(provider.doc);

    collabProviderRef.current = provider;
    yjsBindingRef.current = binding;

    return () => {
      provider.destroy();
      collabProviderRef.current = null;
      yjsBindingRef.current = null;
    };
  }, [page.id]);

  // Debounced auto-save to PostgreSQL and sync to Yjs
  const persistBlocks = useCallback(
    (currentBlocks: Block[]) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      setIsSaving(true);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          await apiClient.batchSyncBlocks(page.id, currentBlocks);
          setLastSavedAt(Date.now());

          // Also sync to Yjs CRDT doc
          if (yjsBindingRef.current) {
            yjsBindingRef.current.syncToYjs(currentBlocks);
          }
        } catch (err) {
          console.error("Failed to auto-save document state:", err);
        } finally {
          setIsSaving(false);
        }
      }, 800);
    },
    [page.id, setIsSaving, setLastSavedAt]
  );

  // Trigger auto-save whenever blocks change
  useEffect(() => {
    if (blocks.length > 0) {
      persistBlocks(blocks);
    }
  }, [blocks, persistBlocks]);

  // Handle Slash Menu Block Type Selection
  const handleSelectSlashType = (type: BlockType) => {
    if (!slashMenuTargetBlockId) return;

    updateBlock(slashMenuTargetBlockId, {
      type,
      content: [{ text: "" }],
      properties: type === "to_do" ? { checked: false } : {},
    });

    closeSlashMenu();
    setFocusedBlockId(slashMenuTargetBlockId, 0);
  };

  // Handle Drag and Drop Reordering O(1)
  const handleDropBlock = (
    draggedBlockId: string,
    targetBlockId: string,
    position: "before" | "after"
  ) => {
    const targetIdx = blocks.findIndex((b) => b.id === targetBlockId);
    if (targetIdx === -1) return;

    let beforeOrder: string | null = null;
    let afterOrder: string | null = null;

    if (position === "before") {
      afterOrder = blocks[targetIdx].sort_order;
      beforeOrder = targetIdx > 0 ? blocks[targetIdx - 1].sort_order : null;
    } else {
      beforeOrder = blocks[targetIdx].sort_order;
      afterOrder =
        targetIdx < blocks.length - 1 ? blocks[targetIdx + 1].sort_order : null;
    }

    const newSortOrder = generateFractionalIndex(beforeOrder, afterOrder);
    reorderBlockOptimistic(draggedBlockId, newSortOrder);
  };

  return (
    <div className="relative min-h-[85vh] w-full max-w-3xl mx-auto px-8 py-12 md:py-16 text-slate-800 dark:text-slate-100 font-sans">
      {/* Selection Bubble Menu */}
      <BubbleMenu
        onFormat={(format, val) => {
          document.execCommand(format === "strike" ? "strikeThrough" : format, false, val);
        }}
      />

      {/* Floating Slash Command Menu */}
      <SlashMenu
        isOpen={slashMenuOpen}
        filter={slashMenuFilter}
        position={slashMenuPosition}
        onSelectType={handleSelectSlashType}
        onClose={closeSlashMenu}
      />

      {/* Document Blocks Canvas */}
      <div className="space-y-0.5 pl-8">
        {blocks.map((block) => {
          const remotePeersInBlock = peers.filter(
            (p) => p.cursor?.blockId === block.id
          );

          return (
            <BlockItem
              key={block.id}
              block={block}
              blocks={blocks}
              isFocused={focusedBlockId === block.id}
              caretOffset={focusedBlockId === block.id ? focusCaretOffset : null}
              remotePresences={remotePeersInBlock}
              onAddBlock={(newBlock, afterId) => {
                const targetIdx = blocks.findIndex((b) => b.id === afterId);
                const nextBlock =
                  targetIdx !== -1 && targetIdx < blocks.length - 1
                    ? blocks[targetIdx + 1]
                    : null;
                const newOrder = generateFractionalIndex(
                  blocks[targetIdx]?.sort_order || null,
                  nextBlock?.sort_order || null
                );
                addBlock({ ...newBlock, sort_order: newOrder }, afterId);
              }}
              onUpdateBlock={updateBlock}
              onRemoveBlock={removeBlock}
              onFocusBlock={(id, offset) => {
                setFocusedBlockId(id, offset);
                if (collabProviderRef.current) {
                  collabProviderRef.current.sendPresence({
                    blockId: id,
                    offset: offset || 0,
                  });
                }
              }}
              onOpenSlashMenu={openSlashMenu}
              onCloseSlashMenu={closeSlashMenu}
              onDropBlock={handleDropBlock}
            />
          );
        })}
      </div>

      {/* Click below last block to append new text block */}
      <div
        onClick={() => {
          const lastBlock = blocks[blocks.length - 1];
          const newOrder = generateFractionalIndex(
            lastBlock?.sort_order || null,
            null
          );
          const newBlock: Block = {
            id: crypto.randomUUID(),
            page_id: page.id,
            parent_block_id: null,
            type: "text",
            content: [{ text: "" }],
            properties: {},
            sort_order: newOrder,
          };
          addBlock(newBlock);
          setTimeout(() => setFocusedBlockId(newBlock.id, 0), 0);
        }}
        className="h-40 cursor-text"
      />
    </div>
  );
}
