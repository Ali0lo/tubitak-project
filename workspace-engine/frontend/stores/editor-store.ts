import { create } from "zustand";
import { Block, BlockType, RichTextSpan } from "@/types/block";
import { Page } from "@/types/page";

interface EditorState {
  activePage: Page | null;
  blocks: Block[];
  focusedBlockId: string | null;
  focusCaretOffset: number | null;

  // Slash command menu state
  slashMenuOpen: boolean;
  slashMenuTargetBlockId: string | null;
  slashMenuFilter: string;
  slashMenuPosition: { top: number; left: number } | null;

  // Bubble menu state
  bubbleMenuVisible: boolean;
  bubbleMenuPosition: { top: number; left: number } | null;

  // Persistence state
  isSaving: boolean;
  lastSavedAt: number | null;

  // Actions
  setActivePage: (page: Page | null) => void;
  setBlocks: (blocks: Block[]) => void;
  setFocusedBlockId: (id: string | null, caretOffset?: number) => void;

  addBlock: (block: Block, afterBlockId?: string) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  updateBlockContent: (id: string, content: RichTextSpan[]) => void;
  updateBlockType: (id: string, type: BlockType) => void;
  removeBlock: (id: string) => void;
  reorderBlockOptimistic: (blockId: string, newSortOrder: string) => void;

  openSlashMenu: (
    blockId: string,
    position: { top: number; left: number },
    filter?: string
  ) => void;
  updateSlashMenuFilter: (filter: string) => void;
  closeSlashMenu: () => void;

  showBubbleMenu: (position: { top: number; left: number }) => void;
  hideBubbleMenu: () => void;

  setIsSaving: (saving: boolean) => void;
  setLastSavedAt: (timestamp: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  activePage: null,
  blocks: [],
  focusedBlockId: null,
  focusCaretOffset: null,

  slashMenuOpen: false,
  slashMenuTargetBlockId: null,
  slashMenuFilter: "",
  slashMenuPosition: null,

  bubbleMenuVisible: false,
  bubbleMenuPosition: null,

  isSaving: false,
  lastSavedAt: null,

  setActivePage: (activePage) => set({ activePage }),
  setBlocks: (blocks) => set({ blocks }),
  setFocusedBlockId: (focusedBlockId, caretOffset) =>
    set({
      focusedBlockId,
      focusCaretOffset: caretOffset !== undefined ? caretOffset : null,
    }),

  addBlock: (block, afterBlockId) =>
    set((state) => {
      if (!afterBlockId) {
        return { blocks: [...state.blocks, block] };
      }
      const idx = state.blocks.findIndex((b) => b.id === afterBlockId);
      if (idx === -1) {
        return { blocks: [...state.blocks, block] };
      }
      const nextBlocks = [...state.blocks];
      nextBlocks.splice(idx + 1, 0, block);
      return { blocks: nextBlocks };
    }),

  updateBlock: (id, updates) =>
    set((state) => ({
      blocks: state.blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),

  updateBlockContent: (id, content) =>
    set((state) => ({
      blocks: state.blocks.map((b) => (b.id === id ? { ...b, content } : b)),
    })),

  updateBlockType: (id, type) =>
    set((state) => ({
      blocks: state.blocks.map((b) => (b.id === id ? { ...b, type } : b)),
    })),

  removeBlock: (id) =>
    set((state) => ({
      blocks: state.blocks.filter((b) => b.id !== id),
    })),

  reorderBlockOptimistic: (blockId, newSortOrder) =>
    set((state) => {
      const updated = state.blocks.map((b) =>
        b.id === blockId ? { ...b, sort_order: newSortOrder } : b
      );
      updated.sort((a, b) => a.sort_order.localeCompare(b.sort_order));
      return { blocks: updated };
    }),

  openSlashMenu: (blockId, position, filter = "") =>
    set({
      slashMenuOpen: true,
      slashMenuTargetBlockId: blockId,
      slashMenuPosition: position,
      slashMenuFilter: filter,
    }),

  updateSlashMenuFilter: (filter) => set({ slashMenuFilter: filter }),
  closeSlashMenu: () =>
    set({
      slashMenuOpen: false,
      slashMenuTargetBlockId: null,
      slashMenuPosition: null,
      slashMenuFilter: "",
    }),

  showBubbleMenu: (position) =>
    set({ bubbleMenuVisible: true, bubbleMenuPosition: position }),
  hideBubbleMenu: () =>
    set({ bubbleMenuVisible: false, bubbleMenuPosition: null }),

  setIsSaving: (isSaving) => set({ isSaving }),
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),
}));
