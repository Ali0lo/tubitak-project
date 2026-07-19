"""initial notification schema

Revision ID: 0001
Revises:
Create Date: 2026-07-14 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


notification_status_enum = postgresql.ENUM(
    "pending",
    "queued",
    "sent",
    "cancelled",
    "failed",
    name="notification_status",
    schema="notification",
)


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS notification")


    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(64), nullable=False),
        sa.Column("source_reference_id", sa.String(64), nullable=False),
        sa.Column("message", sa.String(1024), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            notification_status_enum,
            nullable=False,
            server_default="pending",
        ),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.String(1024), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "source", "source_reference_id", name="uq_notification_source_ref"
        ),
        schema="notification",
    )
    op.create_index(
        "ix_notification_notifications_user_id",
        "notifications",
        ["user_id"],
        schema="notification",
    )
    op.create_index(
        "ix_notification_notifications_scheduled_for",
        "notifications",
        ["scheduled_for"],
        schema="notification",
    )
    op.create_index(
        "ix_notification_notifications_status",
        "notifications",
        ["status"],
        schema="notification",
    )

    op.create_table(
        "notification_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "email_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        schema="notification",
    )
    op.create_index(
        "ix_notification_notification_preferences_user_id",
        "notification_preferences",
        ["user_id"],
        schema="notification",
    )


def downgrade() -> None:
    op.drop_table("notification_preferences", schema="notification")
    op.drop_table("notifications", schema="notification")

    bind = op.get_bind()
    notification_status_enum.drop(bind, checkfirst=True)

    op.execute("DROP SCHEMA IF EXISTS notification CASCADE")
