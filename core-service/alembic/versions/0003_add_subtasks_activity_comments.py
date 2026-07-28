"""add subtasks activity and comments tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-29 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # subtasks table
    op.create_table(
        "subtasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("core.tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("completed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("position", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        schema="core",
    )
    op.create_index("ix_core_subtasks_task_id", "subtasks", ["task_id"], schema="core")

    # task_activities table
    op.create_table(
        "task_activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("core.tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        schema="core",
    )
    op.create_index("ix_core_task_activities_task_id", "task_activities", ["task_id"], schema="core")
    op.create_index("ix_core_task_activities_user_id", "task_activities", ["user_id"], schema="core")

    # task_comments table
    op.create_table(
        "task_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("core.tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_name", sa.String(length=128), server_default="User", nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        schema="core",
    )
    op.create_index("ix_core_task_comments_task_id", "task_comments", ["task_id"], schema="core")
    op.create_index("ix_core_task_comments_user_id", "task_comments", ["user_id"], schema="core")


def downgrade() -> None:
    op.drop_index("ix_core_task_comments_user_id", table_name="task_comments", schema="core")
    op.drop_index("ix_core_task_comments_task_id", table_name="task_comments", schema="core")
    op.drop_table("task_comments", schema="core")

    op.drop_index("ix_core_task_activities_user_id", table_name="task_activities", schema="core")
    op.drop_index("ix_core_task_activities_task_id", table_name="task_activities", schema="core")
    op.drop_table("task_activities", schema="core")

    op.drop_index("ix_core_subtasks_task_id", table_name="subtasks", schema="core")
    op.drop_table("subtasks", schema="core")
