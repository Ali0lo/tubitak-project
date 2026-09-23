"""Block API endpoints."""

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.block import (
    BlockBatchSyncRequest,
    BlockCreate,
    BlockMoveRequest,
    BlockResponse,
    BlockTreeNode,
    BlockUpdate,
)
from app.services.block_service import BlockService

router = APIRouter(prefix="/blocks", tags=["blocks"])


@router.get("/page/{page_id}", response_model=List[BlockResponse])
async def get_page_blocks(page_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    service = BlockService(db)
    return await service.get_page_blocks(page_id)


@router.get("/page/{page_id}/tree", response_model=List[BlockTreeNode])
async def get_page_block_tree(page_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    service = BlockService(db)
    return await service.build_block_tree(page_id)


@router.post("", response_model=BlockResponse, status_code=status.HTTP_201_CREATED)
async def create_block(data: BlockCreate, db: AsyncSession = Depends(get_db)):
    service = BlockService(db)
    return await service.create_block(data)


@router.patch("/{block_id}", response_model=BlockResponse)
async def update_block(
    block_id: uuid.UUID, data: BlockUpdate, db: AsyncSession = Depends(get_db)
):
    service = BlockService(db)
    return await service.update_block(block_id, data)


@router.post("/{block_id}/move", response_model=BlockResponse)
async def move_block(
    block_id: uuid.UUID, data: BlockMoveRequest, db: AsyncSession = Depends(get_db)
):
    service = BlockService(db)
    return await service.move_block(block_id, data)


@router.delete("/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_block(block_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    service = BlockService(db)
    deleted = await service.delete_block(block_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Block not found")
    return None


@router.post("/batch-sync", response_model=List[BlockResponse])
async def batch_sync_blocks(
    data: BlockBatchSyncRequest, db: AsyncSession = Depends(get_db)
):
    service = BlockService(db)
    return await service.batch_sync_blocks(data)
