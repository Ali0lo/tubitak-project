"""Block business logic, tree nesting, and batch sync."""
import uuid
from typing import Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.block import Block
from app.schemas.block import (
    BlockBatchSyncRequest,
    BlockCreate,
    BlockMoveRequest,
    BlockResponse,
    BlockTreeNode,
    BlockUpdate,
)
from app.services.fractional_indexing import generate_fractional_index


class BlockService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_block_by_id(self, block_id: uuid.UUID) -> Optional[Block]:
        result = await self.db.execute(select(Block).where(Block.id == block_id))
        return result.scalar_one_or_none()

    async def get_page_blocks(self, page_id: uuid.UUID) -> List[Block]:
        stmt = (
            select(Block)
            .where(Block.page_id == page_id)
            .order_by(Block.sort_order.asc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def build_block_tree(self, page_id: uuid.UUID) -> List[BlockTreeNode]:
        """Convert flat list of blocks into a nested tree structure based on parent_block_id."""
        blocks = await self.get_page_blocks(page_id)

        node_map: Dict[uuid.UUID, BlockTreeNode] = {}
        for b in blocks:
            node_map[b.id] = BlockTreeNode(
                id=b.id,
                page_id=b.page_id,
                parent_block_id=b.parent_block_id,
                type=b.type,
                content=b.content or [],
                properties=b.properties or {},
                sort_order=b.sort_order,
                created_at=b.created_at,
                updated_at=b.updated_at,
                children=[],
            )

        roots: List[BlockTreeNode] = []
        for b in blocks:
            node = node_map[b.id]
            if b.parent_block_id and b.parent_block_id in node_map:
                node_map[b.parent_block_id].children.append(node)
            else:
                roots.append(node)

        def sort_children(n: BlockTreeNode):
            n.children.sort(key=lambda x: x.sort_order)
            for c in n.children:
                sort_children(c)

        for r in roots:
            sort_children(r)
        roots.sort(key=lambda x: x.sort_order)

        return roots

    async def create_block(self, data: BlockCreate) -> Block:
        before_order = None
        after_order = None

        if data.before_block_id:
            before_b = await self.get_block_by_id(data.before_block_id)
            if before_b:
                before_order = before_b.sort_order

        if data.after_block_id:
            after_b = await self.get_block_by_id(data.after_block_id)
            if after_b:
                after_order = after_b.sort_order

        if not before_order and not after_order:
            # Query last sibling block
            stmt = (
                select(Block.sort_order)
                .where(
                    Block.page_id == data.page_id,
                    Block.parent_block_id == data.parent_block_id,
                )
                .order_by(Block.sort_order.desc())
                .limit(1)
            )
            last_order = (await self.db.execute(stmt)).scalar_one_or_none()
            before_order = last_order

        sort_order = generate_fractional_index(before_order, after_order)

        block = Block(
            id=uuid.uuid4(),
            page_id=data.page_id,
            parent_block_id=data.parent_block_id,
            type=data.type,
            content=data.content,
            properties=data.properties,
            sort_order=sort_order,
        )
        self.db.add(block)
        await self.db.flush()
        await self.db.refresh(block)
        return block

    async def update_block(self, block_id: uuid.UUID, data: BlockUpdate) -> Block:
        block = await self.get_block_by_id(block_id)
        if not block:
            raise HTTPException(status_code=404, detail="Block not found")

        if data.type is not None:
            block.type = data.type
        if data.content is not None:
            block.content = data.content
        if data.properties is not None:
            block.properties = data.properties
        if data.parent_block_id is not None:
            block.parent_block_id = data.parent_block_id

        await self.db.flush()
        await self.db.refresh(block)
        return block

    async def move_block(self, block_id: uuid.UUID, data: BlockMoveRequest) -> Block:
        block = await self.get_block_by_id(block_id)
        if not block:
            raise HTTPException(status_code=404, detail="Block not found")

        if data.new_parent_block_id is not None:
            block.parent_block_id = data.new_parent_block_id

        before_order = None
        after_order = None

        if data.before_block_id:
            before_b = await self.get_block_by_id(data.before_block_id)
            if before_b:
                before_order = before_b.sort_order

        if data.after_block_id:
            after_b = await self.get_block_by_id(data.after_block_id)
            if after_b:
                after_order = after_b.sort_order

        block.sort_order = generate_fractional_index(before_order, after_order)
        await self.db.flush()
        await self.db.refresh(block)
        return block

    async def delete_block(self, block_id: uuid.UUID) -> bool:
        block = await self.get_block_by_id(block_id)
        if not block:
            return False
        await self.db.delete(block)
        await self.db.flush()
        return True

    async def batch_sync_blocks(self, sync_data: BlockBatchSyncRequest) -> List[Block]:
        """Atomically synchronize blocks for a page from a client or Yjs snapshot."""
        # Clean current page blocks and recreate/upsert in transaction
        await self.db.execute(delete(Block).where(Block.page_id == sync_data.page_id))

        new_blocks = []
        for item in sync_data.blocks:
            b = Block(
                id=item.id,
                page_id=sync_data.page_id,
                parent_block_id=item.parent_block_id,
                type=item.type,
                content=item.content,
                properties=item.properties,
                sort_order=item.sort_order,
            )
            self.db.add(b)
            new_blocks.append(b)

        await self.db.flush()
        return new_blocks
