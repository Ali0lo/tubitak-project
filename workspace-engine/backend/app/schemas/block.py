"""Schemas for Block resources."""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.block import BlockType


class BlockBase(BaseModel):
    type: BlockType = BlockType.TEXT
    content: List[Dict[str, Any]] = Field(default_factory=list)
    properties: Dict[str, Any] = Field(default_factory=dict)


class BlockCreate(BlockBase):
    page_id: uuid.UUID
    parent_block_id: Optional[uuid.UUID] = None
    before_block_id: Optional[uuid.UUID] = None
    after_block_id: Optional[uuid.UUID] = None


class BlockUpdate(BaseModel):
    type: Optional[BlockType] = None
    content: Optional[List[Dict[str, Any]]] = None
    properties: Optional[Dict[str, Any]] = None
    parent_block_id: Optional[uuid.UUID] = None


class BlockMoveRequest(BaseModel):
    new_parent_block_id: Optional[uuid.UUID] = None
    before_block_id: Optional[uuid.UUID] = None
    after_block_id: Optional[uuid.UUID] = None


class BlockSyncItem(BaseModel):
    id: uuid.UUID
    parent_block_id: Optional[uuid.UUID] = None
    type: BlockType
    content: List[Dict[str, Any]] = Field(default_factory=list)
    properties: Dict[str, Any] = Field(default_factory=dict)
    sort_order: str


class BlockBatchSyncRequest(BaseModel):
    page_id: uuid.UUID
    blocks: List[BlockSyncItem]


class BlockResponse(BlockBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    page_id: uuid.UUID
    parent_block_id: Optional[uuid.UUID] = None
    sort_order: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BlockTreeNode(BlockResponse):
    children: List["BlockTreeNode"] = Field(default_factory=list)


BlockTreeNode.model_rebuild()
