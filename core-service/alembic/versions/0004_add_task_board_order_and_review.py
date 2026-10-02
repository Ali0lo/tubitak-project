"""add task board_order column and review status enum value

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-02 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add 'review' value to Postgres task_status enum in core schema
    op.execute("ALTER TYPE core.task_status ADD VALUE IF NOT EXISTS 'review' AFTER 'in_progress'")

    # 2. Add board_order column to core.tasks table
    op.add_column(
        "tasks",
        sa.Column("board_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        schema="core",
    )
    op.create_index(
        "ix_core_tasks_board_order",
        "tasks",
        ["board_order"],
        schema="core",
    )


def downgrade() -> None:
    op.drop_index("ix_core_tasks_board_order", table_name="tasks", schema="core")
    op.drop_column("tasks", "board_order", schema="core")
