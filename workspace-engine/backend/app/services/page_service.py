"""Page business logic, tree navigation, and reordering."""
import uuid
from typing import Dict, List, Optional, Set
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.page import Page
from app.schemas.page import PageCreate, PageMoveRequest, PageTreeNode, PageUpdate
from app.services.fractional_indexing import generate_fractional_index


class PageService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_page_by_id(self, page_id: uuid.UUID) -> Optional[Page]:
        result = await self.db.execute(select(Page).where(Page.id == page_id))
        return result.scalar_one_or_none()

    async def get_workspace_pages(
        self, workspace_id: uuid.UUID, include_archived: bool = False
    ) -> List[Page]:
        stmt = (
            select(Page)
            .where(Page.workspace_id == workspace_id)
            .order_by(Page.sort_order.asc())
        )
        if not include_archived:
            stmt = stmt.where(Page.is_archived.is_(False))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def build_page_tree(
        self, workspace_id: uuid.UUID, include_archived: bool = False
    ) -> List[PageTreeNode]:
        """Fetch all pages for a workspace and build a nested tree hierarchy."""
        pages = await self.get_workspace_pages(workspace_id, include_archived)

        # Map by id
        node_map: Dict[uuid.UUID, PageTreeNode] = {}
        for p in pages:
            node_map[p.id] = PageTreeNode(
                id=p.id,
                workspace_id=p.workspace_id,
                parent_id=p.parent_id,
                title=p.title,
                icon=p.icon,
                is_favorite=p.is_favorite,
                is_archived=p.is_archived,
                sort_order=p.sort_order,
                children=[],
            )

        root_nodes: List[PageTreeNode] = []
        for p in pages:
            node = node_map[p.id]
            if p.parent_id and p.parent_id in node_map:
                node_map[p.parent_id].children.append(node)
            else:
                root_nodes.append(node)

        # Sort children by sort_order
        def sort_children(n: PageTreeNode):
            n.children.sort(key=lambda x: x.sort_order)
            for c in n.children:
                sort_children(c)

        for root in root_nodes:
            sort_children(root)
        root_nodes.sort(key=lambda x: x.sort_order)

        return root_nodes

    async def create_page(self, data: PageCreate) -> Page:
        # Determine sort_order
        before_order = None
        after_order = None

        if data.before_page_id:
            before_page = await self.get_page_by_id(data.before_page_id)
            if before_page:
                before_order = before_page.sort_order

        if data.after_page_id:
            after_page = await self.get_page_by_id(data.after_page_id)
            if after_page:
                after_order = after_page.sort_order

        if not before_order and not after_order:
            # Query last sibling order
            stmt = (
                select(Page.sort_order)
                .where(
                    Page.workspace_id == data.workspace_id,
                    Page.parent_id == data.parent_id,
                )
                .order_by(Page.sort_order.desc())
                .limit(1)
            )
            last_order = (await self.db.execute(stmt)).scalar_one_or_none()
            before_order = last_order

        sort_order = generate_fractional_index(before_order, after_order)

        page = Page(
            id=uuid.uuid4(),
            workspace_id=data.workspace_id,
            parent_id=data.parent_id,
            title=data.title or "Untitled",
            icon=data.icon or "📄",
            cover_image=data.cover_image,
            sort_order=sort_order,
            page_metadata={},
        )
        self.db.add(page)
        await self.db.flush()
        await self.db.refresh(page)
        return page

    async def update_page(self, page_id: uuid.UUID, data: PageUpdate) -> Page:
        page = await self.get_page_by_id(page_id)
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")

        if data.parent_id is not None and data.parent_id != page.parent_id:
            # Prevent cycle: page cannot be parent of itself or of any of its descendants
            await self._validate_no_cycle(page.id, data.parent_id)
            page.parent_id = data.parent_id

        if data.title is not None:
            page.title = data.title
        if data.icon is not None:
            page.icon = data.icon
        if data.cover_image is not None:
            page.cover_image = data.cover_image
        if data.is_favorite is not None:
            page.is_favorite = data.is_favorite
        if data.is_archived is not None:
            page.is_archived = data.is_archived
        if data.metadata is not None:
            page.page_metadata = data.metadata

        await self.db.flush()
        await self.db.refresh(page)
        return page

    async def move_page(self, page_id: uuid.UUID, data: PageMoveRequest) -> Page:
        """Reorder or move page to a new parent using O(1) fractional indexing."""
        page = await self.get_page_by_id(page_id)
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")

        target_parent_id = data.new_parent_id
        if target_parent_id is not None:
            await self._validate_no_cycle(page.id, target_parent_id)
            page.parent_id = target_parent_id

        before_order = None
        after_order = None

        if data.before_page_id:
            before_p = await self.get_page_by_id(data.before_page_id)
            if before_p:
                before_order = before_p.sort_order

        if data.after_page_id:
            after_p = await self.get_page_by_id(data.after_page_id)
            if after_p:
                after_order = after_p.sort_order

        page.sort_order = generate_fractional_index(before_order, after_order)
        await self.db.flush()
        await self.db.refresh(page)
        return page

    async def delete_page(self, page_id: uuid.UUID) -> bool:
        page = await self.get_page_by_id(page_id)
        if not page:
            return False
        await self.db.delete(page)
        await self.db.flush()
        return True

    async def _validate_no_cycle(
        self, moving_page_id: uuid.UUID, target_parent_id: Optional[uuid.UUID]
    ):
        """Verify that moving_page_id is not target_parent_id and not an ancestor of target_parent_id."""
        if target_parent_id is None:
            return
        if moving_page_id == target_parent_id:
            raise HTTPException(
                status_code=400, detail="A page cannot be its own parent"
            )

        visited: Set[uuid.UUID] = {moving_page_id}
        curr_id = target_parent_id
        while curr_id is not None:
            if curr_id in visited:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot move page into its own descendant (cycle detected)",
                )
            visited.add(curr_id)
            parent_page = await self.get_page_by_id(curr_id)
            curr_id = parent_page.parent_id if parent_page else None
