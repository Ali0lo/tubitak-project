"""Schemas for full-text search across pages and block contents."""

import uuid
from typing import List, Optional

from pydantic import BaseModel, Field


class SearchResultItem(BaseModel):
    id: uuid.UUID
    page_id: uuid.UUID
    title: str
    icon: Optional[str] = "📄"
    snippet: str
    match_type: str  # "title" or "content"
    block_id: Optional[uuid.UUID] = None


class SearchResponse(BaseModel):
    query: str
    total: int
    results: List[SearchResultItem] = Field(default_factory=list)
