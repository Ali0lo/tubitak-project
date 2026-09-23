"""Schemas for hierarchical Page resources."""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class PageBase(BaseModel):
    title: str = Field(default="Untitled", max_length=255)
    icon: Optional[str] = "📄"
    cover_image: Optional[str] = None
    is_favorite: bool = False
    is_archived: bool = False


class PageCreate(BaseModel):
    workspace_id: uuid.UUID
    parent_id: Optional[uuid.UUID] = None
    title: str = Field(default="Untitled", max_length=255)
    icon: Optional[str] = "📄"
    cover_image: Optional[str] = None
    before_page_id: Optional[uuid.UUID] = None
    after_page_id: Optional[uuid.UUID] = None


class PageUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    icon: Optional[str] = None
    cover_image: Optional[str] = None
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None
    parent_id: Optional[uuid.UUID] = None
    metadata: Optional[Dict[str, Any]] = None


class PageMoveRequest(BaseModel):
    new_parent_id: Optional[uuid.UUID] = None
    before_page_id: Optional[uuid.UUID] = None
    after_page_id: Optional[uuid.UUID] = None


class PageResponse(PageBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    parent_id: Optional[uuid.UUID] = None
    sort_order: str
    metadata: Dict[str, Any] = Field(default_factory=dict, alias="page_metadata")
    created_at: datetime
    updated_at: datetime


class PageTreeNode(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    parent_id: Optional[uuid.UUID] = None
    title: str
    icon: Optional[str] = "📄"
    is_favorite: bool = False
    is_archived: bool = False
    sort_order: str
    children: List["PageTreeNode"] = Field(default_factory=list)


PageTreeNode.model_rebuild()
