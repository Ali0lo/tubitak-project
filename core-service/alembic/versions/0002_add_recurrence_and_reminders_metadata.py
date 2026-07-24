"""add recurrence and reminders metadata

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-24 10:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tasks table recurrence fields
    op.add_column(
        "tasks",
        sa.Column("is_recurring", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        schema="core",
    )
    op.add_column(
        "tasks",
        sa.Column("recurrence_rule", sa.JSON(), nullable=True),
        schema="core",
    )
    op.add_column(
        "tasks",
        sa.Column("recurrence_parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="core",
    )
    op.create_foreign_key(
        "fk_tasks_recurrence_parent_id",
        "tasks",
        "tasks",
        ["recurrence_parent_id"],
        ["id"],
        source_schema="core",
        referent_schema="core",
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_core_tasks_is_recurring",
        "tasks",
        ["is_recurring"],
        schema="core",
    )
    op.create_index(
        "ix_core_tasks_recurrence_parent_id",
        "tasks",
        ["recurrence_parent_id"],
        schema="core",
    )
    op.create_index(
        "ix_core_tasks_user_status_due_date",
        "tasks",
        ["user_id", "status", "due_date"],
        schema="core",
    )

    # Meetings table recurrence fields
    op.add_column(
        "meetings",
        sa.Column("is_recurring", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        schema="core",
    )
    op.add_column(
        "meetings",
        sa.Column("recurrence_rule", sa.JSON(), nullable=True),
        schema="core",
    )
    op.add_column(
        "meetings",
        sa.Column("recurrence_parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="core",
    )
    op.create_foreign_key(
        "fk_meetings_recurrence_parent_id",
        "meetings",
        "meetings",
        ["recurrence_parent_id"],
        ["id"],
        source_schema="core",
        referent_schema="core",
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_core_meetings_is_recurring",
        "meetings",
        ["is_recurring"],
        schema="core",
    )
    op.create_index(
        "ix_core_meetings_user_status_end_time",
        "meetings",
        ["user_id", "status", "end_time"],
        schema="core",
    )


def downgrade() -> None:
    op.drop_index("ix_core_meetings_user_status_end_time", table_name="meetings", schema="core")
    op.drop_index("ix_core_meetings_is_recurring", table_name="meetings", schema="core")
    op.drop_constraint("fk_meetings_recurrence_parent_id", "meetings", schema="core", type_="foreignkey")
    op.drop_column("meetings", "recurrence_parent_id", schema="core")
    op.drop_column("meetings", "recurrence_rule", schema="core")
    op.drop_column("meetings", "is_recurring", schema="core")

    op.drop_index("ix_core_tasks_user_status_due_date", table_name="tasks", schema="core")
    op.drop_index("ix_core_tasks_recurrence_parent_id", table_name="tasks", schema="core")
    op.drop_index("ix_core_tasks_is_recurring", table_name="tasks", schema="core")
    op.drop_constraint("fk_tasks_recurrence_parent_id", "tasks", schema="core", type_="foreignkey")
    op.drop_column("tasks", "recurrence_parent_id", schema="core")
    op.drop_column("tasks", "recurrence_rule", schema="core")
    op.drop_column("tasks", "is_recurring", schema="core")
