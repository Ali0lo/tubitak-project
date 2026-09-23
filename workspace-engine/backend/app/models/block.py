"""Atomic block entity model supporting tree nesting and rich content."""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class BlockType(str, enum.Enum):
    TEXT = "text"
    HEADING_1 = "heading_1"
    HEADING_2 = "heading_2"
    HEADING_3 = "heading_3"
    BULLETED_LIST = "bulleted_list"
    NUMBERED_LIST = "numbered_list"
    TO_DO = "to_do"
    TOGGLE = "toggle"
    CODE = "code"
    QUOTE = "quote"
    CALLOUT = "callout"
    DIVIDER = "divider"
    TABLE = "table"
    IMAGE = "image"
    EMBED = "embed"


class Block(Base):
    __tablename__ = "blocks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    page_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_block_id = Column(
        UUID(as_uuid=True),
        ForeignKey("blocks.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    type = Column(
        Enum(BlockType, name="block_type_enum", native_enum=False),
        default=BlockType.TEXT,
        nullable=False,
        index=True,
    )
    # Rich text content array, e.g. [{"text": "Hello ", "bold": true}, {"text": "world", "link": "https://..."}]
    content = Column(JSONB, default=list, nullable=False)
    # Block properties, e.g. {"checked": true, "language": "typescript", "color": "blue", "icon": "💡"}
    properties = Column(JSONB, default=dict, nullable=False)
    # Fractional index string for O(1) vertical reordering
    sort_order = Column(String(128), default="a0", nullable=False, index=True)

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

    page = relationship("Page", back_populates="blocks")
    children = relationship(
        "Block",
        backref="parent_block",
        remote_side=[id],
        cascade="all, delete-orphan",
        order_by="Block.sort_order",
    )

    __table_args__ = (
        Index("ix_blocks_page_parent_sort", "page_id", "parent_block_id", "sort_order"),
    )
