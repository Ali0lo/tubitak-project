"""Page API endpoints."""

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.page import (
    PageCreate,
    PageMoveRequest,
    PageResponse,
    PageTreeNode,
    PageUpdate,
)
from app.services.page_service import PageService

router = APIRouter(prefix="/pages", tags=["pages"])


@router.get("/tree/{workspace_id}", response_model=List[PageTreeNode])
async def get_page_tree(
    workspace_id: uuid.UUID,
    include_archived: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    service = PageService(db)
    return await service.build_page_tree(
        workspace_id, include_archived=include_archived
    )


@router.post("", response_model=PageResponse, status_code=status.HTTP_201_CREATED)
async def create_page(data: PageCreate, db: AsyncSession = Depends(get_db)):
    service = PageService(db)
    return await service.create_page(data)


@router.get("/{page_id}", response_model=PageResponse)
async def get_page(page_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    service = PageService(db)
    page = await service.get_page_by_id(page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


@router.patch("/{page_id}", response_model=PageResponse)
async def update_page(
    page_id: uuid.UUID, data: PageUpdate, db: AsyncSession = Depends(get_db)
):
    service = PageService(db)
    return await service.update_page(page_id, data)


@router.post("/{page_id}/move", response_model=PageResponse)
async def move_page(
    page_id: uuid.UUID, data: PageMoveRequest, db: AsyncSession = Depends(get_db)
):
    service = PageService(db)
    return await service.move_page(page_id, data)


@router.delete("/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_page(page_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    service = PageService(db)
    deleted = await service.delete_page(page_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Page not found")
    return None
