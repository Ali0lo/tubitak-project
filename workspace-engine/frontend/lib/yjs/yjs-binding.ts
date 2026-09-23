import * as Y from "yjs";
import { Block } from "@/types/block";
import { useEditorStore } from "@/stores/editor-store";

export class YjsBlockBinding {
  private ydoc: Y.Doc;
  private yblocks: Y.Array<Y.Map<unknown>>;
  private isApplyingRemote = false;

  constructor(ydoc: Y.Doc) {
    this.ydoc = ydoc;
    this.yblocks = ydoc.getArray<Y.Map<unknown>>("blocks");

    this.yblocks.observeDeep(() => {
      if (this.isApplyingRemote) return;
      this.syncFromYjs();
    });
  }

  public syncFromYjs() {
    this.isApplyingRemote = true;
    try {
      const blocks: Block[] = [];
      for (let i = 0; i < this.yblocks.length; i++) {
        const ymap = this.yblocks.get(i);
        const blockJson = ymap.toJSON() as unknown as Block;
        blocks.push(blockJson);
      }
      blocks.sort((a, b) => a.sort_order.localeCompare(b.sort_order));
      if (blocks.length > 0) {
        useEditorStore.getState().setBlocks(blocks);
      }
    } finally {
      this.isApplyingRemote = false;
    }
  }

  public syncToYjs(blocks: Block[]) {
    if (this.isApplyingRemote) return;

    this.ydoc.transact(() => {
      // Clear existing and rewrite current array
      this.yblocks.delete(0, this.yblocks.length);

      for (const block of blocks) {
        const ymap = new Y.Map<unknown>();
        ymap.set("id", block.id);
        ymap.set("page_id", block.page_id);
        ymap.set("parent_block_id", block.parent_block_id);
        ymap.set("type", block.type);
        ymap.set("content", block.content);
        ymap.set("properties", block.properties);
        ymap.set("sort_order", block.sort_order);
        this.yblocks.push([ymap]);
      }
    }, "local");
  }
}
