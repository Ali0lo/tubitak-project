"""add notification read state

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-24 10:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column("is_read", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        schema="notification",
    )
    op.add_column(
        "notifications",
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        schema="notification",
    )
    op.create_index(
        "ix_notification_notifications_is_read",
        "notifications",
        ["is_read"],
        schema="notification",
    )


def downgrade() -> None:
    op.drop_index("ix_notification_notifications_is_read", table_name="notifications", schema="notification")
    op.drop_column("notifications", "read_at", schema="notification")
    op.drop_column("notifications", "is_read", schema="notification")
