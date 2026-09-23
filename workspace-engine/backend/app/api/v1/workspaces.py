"""Workspace API endpoints."""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceResponse,
    WorkspaceUpdate,
)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=List[WorkspaceResponse])
async def list_workspaces(db: AsyncSession = Depends(get_db)):
    stmt = select(Workspace).options(selectinload(Workspace.members))
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    data: WorkspaceCreate, db: AsyncSession = Depends(get_db)
):
    # Check slug uniqueness
    stmt = select(Workspace).where(Workspace.slug == data.slug)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Workspace slug '{data.slug}' is already taken",
        )

    # In production, owner_id is taken from authenticated JWT.
    # Defaulting here for seamless multi-tenant developer testing.
    owner_id = uuid.uuid4()

    workspace = Workspace(
        id=uuid.uuid4(),
        name=data.name,
        slug=data.slug,
        icon=data.icon or "🪐",
        owner_id=owner_id,
    )
    db.add(workspace)
    await db.flush()

    # Add owner as workspace member
    owner_member = WorkspaceMember(
        id=uuid.uuid4(),
        workspace_id=workspace.id,
        user_id=owner_id,
        role=WorkspaceRole.OWNER,
    )
    db.add(owner_member)
    await db.flush()

    # Load relationships
    stmt = (
        select(Workspace)
        .where(Workspace.id == workspace.id)
        .options(selectinload(Workspace.members))
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.get("/{workspace_id_or_slug}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id_or_slug: str, db: AsyncSession = Depends(get_db)
):
    try:
        ws_id = uuid.UUID(workspace_id_or_slug)
        stmt = (
            select(Workspace)
            .where(Workspace.id == ws_id)
            .options(selectinload(Workspace.members))
        )
    except ValueError:
        stmt = (
            select(Workspace)
            .where(Workspace.slug == workspace_id_or_slug)
            .options(selectinload(Workspace.members))
        )

    result = await db.execute(stmt)
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: uuid.UUID,
    data: WorkspaceUpdate,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Workspace)
        .where(Workspace.id == workspace_id)
        .options(selectinload(Workspace.members))
    )
    workspace = (await db.execute(stmt)).scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if data.name is not None:
        workspace.name = data.name
    if data.slug is not None:
        workspace.slug = data.slug
    if data.icon is not None:
        workspace.icon = data.icon

    await db.flush()
    return workspace
