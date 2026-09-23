"""Workspace and WorkspaceMember models."""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class WorkspaceRole(str, enum.Enum):
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    icon = Column(String(50), default="🪐", nullable=False)
    owner_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    members = relationship(
        "WorkspaceMember",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )
    pages = relationship(
        "Page",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    role = Column(
        Enum(WorkspaceRole, name="workspace_role_enum", native_enum=False),
        default=WorkspaceRole.EDITOR,
        nullable=False,
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    workspace = relationship("Workspace", back_populates="members")

    __table_args__ = (
        UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"),
    )
