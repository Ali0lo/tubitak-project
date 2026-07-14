"""Shared pagination response schema."""
from typing import Generic, List, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PageResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int
