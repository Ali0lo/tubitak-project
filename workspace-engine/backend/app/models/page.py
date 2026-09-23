"""Page hierarchical tree model."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Page(Base):
    __tablename__ = "pages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pages.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    title = Column(String(255), default="Untitled", nullable=False)
    icon = Column(String(255), default="📄", nullable=True)
    cover_image = Column(Text, nullable=True)
    is_favorite = Column(Boolean, default=False, nullable=False, index=True)
    is_archived = Column(Boolean, default=False, nullable=False, index=True)
    sort_order = Column(String(128), default="a0", nullable=False, index=True)
    page_metadata = Column("metadata", JSONB, default=dict, nullable=False)

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

    workspace = relationship("Workspace", back_populates="pages")
    children = relationship(
        "Page",
        backref="parent",
        remote_side=[id],
        cascade="all, delete-orphan",
        order_by="Page.sort_order",
    )
    blocks = relationship(
        "Block",
        back_populates="page",
        cascade="all, delete-orphan",
        order_by="Block.sort_order",
    )

    __table_args__ = (
        Index("ix_pages_workspace_parent_sort", "workspace_id", "parent_id", "sort_order"),
    )
