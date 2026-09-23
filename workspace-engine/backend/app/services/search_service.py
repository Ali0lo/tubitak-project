"""Full-text fuzzy search service across pages and block contents."""
import uuid
from typing import List
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.block import Block
from app.models.page import Page
from app.schemas.search import SearchResponse, SearchResultItem


class SearchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def search(
        self, workspace_id: uuid.UUID, query: str, limit: int = 20
    ) -> SearchResponse:
        cleaned_query = query.strip()
        if not cleaned_query:
            return SearchResponse(query="", total=0, results=[])

        search_pattern = f"%{cleaned_query}%"
        results: List[SearchResultItem] = []

        # 1. Search page titles
        page_stmt = (
            select(Page)
            .where(
                Page.workspace_id == workspace_id,
                Page.is_archived.is_(False),
                Page.title.ilike(search_pattern),
            )
            .limit(limit)
        )
        page_res = await self.db.execute(page_stmt)
        pages = page_res.scalars().all()

        for p in pages:
            results.append(
                SearchResultItem(
                    id=p.id,
                    page_id=p.id,
                    title=p.title,
                    icon=p.icon,
                    snippet=f"Page title matching: '{p.title}'",
                    match_type="title",
                    block_id=None,
                )
            )

        # 2. Search block contents (cast JSONB to text)
        if len(results) < limit:
            remaining = limit - len(results)
            block_stmt = (
                select(Block, Page)
                .join(Page, Block.page_id == Page.id)
                .where(
                    Page.workspace_id == workspace_id,
                    Page.is_archived.is_(False),
                    Block.content.cast(sqlalchemy_text_type()).ilike(search_pattern),
                )
                .limit(remaining)
            )
            block_res = await self.db.execute(block_stmt)
            for block, page in block_res.all():
                # Extract simple text snippet from JSON structure
                snippet = self._extract_snippet(block.content, cleaned_query)
                results.append(
                    SearchResultItem(
                        id=block.id,
                        page_id=page.id,
                        title=page.title,
                        icon=page.icon,
                        snippet=snippet,
                        match_type="content",
                        block_id=block.id,
                    )
                )

        return SearchResponse(
            query=cleaned_query,
            total=len(results),
            results=results,
        )

    def _extract_snippet(self, content: list, query: str) -> str:
        extracted = []
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and "text" in item:
                    extracted.append(str(item["text"]))
                elif isinstance(item, str):
                    extracted.append(item)
        full_text = " ".join(extracted)
        if not full_text:
            return "Block content match"

        lower_text = full_text.lower()
        idx = lower_text.find(query.lower())
        if idx == -1:
            return full_text[:80] + ("..." if len(full_text) > 80 else "")

        start = max(0, idx - 30)
        end = min(len(full_text), idx + len(query) + 40)
        prefix = "..." if start > 0 else ""
        suffix = "..." if end < len(full_text) else ""
        return f"{prefix}{full_text[start:end]}{suffix}"


def sqlalchemy_text_type():
    from sqlalchemy import Text

    return Text
