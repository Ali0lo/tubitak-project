import { Block, BlockType } from "@/types/block";
import { generateFractionalIndex } from "@/lib/fractional-indexing";

export interface KeyContext {
  block: Block;
  blocks: Block[];
  caretOffset: number;
  textValue: string;
  onAddBlock: (newBlock: Block, afterId: string) => void;
  onUpdateBlock: (id: string, updates: Partial<Block>) => void;
  onRemoveBlock: (id: string) => void;
  onFocusBlock: (id: string, offset?: number) => void;
}

export function handleBlockKeyDown(
  e: React.KeyboardEvent,
  ctx: KeyContext
): boolean {
  const {
    block,
    blocks,
    caretOffset,
    textValue,
    onAddBlock,
    onUpdateBlock,
    onRemoveBlock,
    onFocusBlock,
  } = ctx;

  const currentIndex = blocks.findIndex((b) => b.id === block.id);
  const prevBlock = currentIndex > 0 ? blocks[currentIndex - 1] : null;
  const nextBlock = currentIndex < blocks.length - 1 ? blocks[currentIndex + 1] : null;

  // 1. Enter key: Split or create sibling
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    // Split text if caret is in the middle
    const beforeText = textValue.slice(0, caretOffset);
    const afterText = textValue.slice(caretOffset);

    // Update current block with beforeText
    onUpdateBlock(block.id, {
      content: [{ text: beforeText }],
    });

    // Create new block after current
    const nextSortOrder = generateFractionalIndex(
      block.sort_order,
      nextBlock?.sort_order ?? null
    );

    // Determine type for new block:
    // Lists and to_do continue same type unless empty; headings reset to text
    let newType: BlockType = "text";
    if (
      (block.type === "bulleted_list" ||
        block.type === "numbered_list" ||
        block.type === "to_do") &&
      textValue.trim() !== ""
    ) {
      newType = block.type;
    }

    const newBlock: Block = {
      id: crypto.randomUUID(),
      page_id: block.page_id,
      parent_block_id: block.parent_block_id,
      type: newType,
      content: [{ text: afterText }],
      properties: newType === "to_do" ? { checked: false } : {},
      sort_order: nextSortOrder,
    };

    onAddBlock(newBlock, block.id);
    setTimeout(() => onFocusBlock(newBlock.id, 0), 0);
    return true;
  }

  // 2. Backspace key: Convert to text or merge with previous block
  if (e.key === "Backspace" && caretOffset === 0) {
    // If block is not "text", convert it back to standard text first
    if (block.type !== "text") {
      e.preventDefault();
      onUpdateBlock(block.id, { type: "text" });
      return true;
    }

    // If block is already "text" and there is a previous block, merge or focus previous
    if (prevBlock) {
      e.preventDefault();
      const prevText = prevBlock.content.map((c) => c.text).join("");
      const mergedText = prevText + textValue;

      // Update previous block with merged content
      onUpdateBlock(prevBlock.id, {
        content: [{ text: mergedText }],
      });

      // Remove current block
      onRemoveBlock(block.id);

      // Focus previous block at merge point
      setTimeout(() => onFocusBlock(prevBlock.id, prevText.length), 0);
      return true;
    }
  }

  // 3. Tab key: Indent (Tab) or unindent (Shift+Tab)
  if (e.key === "Tab") {
    e.preventDefault();
    if (e.shiftKey) {
      // Unindent: remove parent_block_id
      if (block.parent_block_id) {
        onUpdateBlock(block.id, { parent_block_id: null });
      }
    } else {
      // Indent: make child of previous sibling
      if (prevBlock && prevBlock.id !== block.id) {
        onUpdateBlock(block.id, { parent_block_id: prevBlock.id });
      }
    }
    return true;
  }

  // 4. Arrow navigation
  if (e.key === "ArrowUp" && caretOffset === 0 && prevBlock) {
    e.preventDefault();
    const prevLen = prevBlock.content.map((c) => c.text).join("").length;
    onFocusBlock(prevBlock.id, prevLen);
    return true;
  }

  if (e.key === "ArrowDown" && caretOffset === textValue.length && nextBlock) {
    e.preventDefault();
    onFocusBlock(nextBlock.id, 0);
    return true;
  }

  return false;
}
