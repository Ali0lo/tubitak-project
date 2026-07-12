"""initial core schema

Revision ID: 0001
Revises:
Create Date: 2026-07-12 00:00:00.000000
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


task_status_enum = postgresql.ENUM(
    "pending",
    "in_progress",
    "completed",
    "cancelled",
    name="task_status",
    schema="core",
)
task_priority_enum = postgresql.ENUM(
    "low", "medium", "high", "urgent", name="task_priority", schema="core"
)
meeting_status_enum = postgresql.ENUM(
    "scheduled", "cancelled", "completed", name="meeting_status", schema="core"
)
participant_response_status_enum = postgresql.ENUM(
    "pending",
    "accepted",
    "declined",
    "tentative",
    name="participant_response_status",
    schema="core",
)


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS core")

    bind = op.get_bind()
    task_status_enum.create(bind, checkfirst=True)
    task_priority_enum.create(bind, checkfirst=True)
    meeting_status_enum.create(bind, checkfirst=True)
    participant_response_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            task_status_enum,
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "priority",
            task_priority_enum,
            nullable=False,
            server_default="medium",
        ),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
        schema="core",
    )
    op.create_index("ix_core_tasks_user_id", "tasks", ["user_id"], schema="core")
    op.create_index("ix_core_tasks_status", "tasks", ["status"], schema="core")
    op.create_index(
        "ix_core_tasks_due_date", "tasks", ["due_date"], schema="core"
    )

    op.create_table(
        "task_tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("core.tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        schema="core",
    )
    op.create_index(
        "ix_core_task_tags_task_id", "task_tags", ["task_id"], schema="core"
    )

    op.create_table(
        "meetings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            meeting_status_enum,
            nullable=False,
            server_default="scheduled",
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
        schema="core",
    )
    op.create_index(
        "ix_core_meetings_user_id", "meetings", ["user_id"], schema="core"
    )
    op.create_index(
        "ix_core_meetings_start_time", "meetings", ["start_time"], schema="core"
    )
    op.create_index(
        "ix_core_meetings_status", "meetings", ["status"], schema="core"
    )

    op.create_table(
        "meeting_participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "meeting_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("core.meetings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column(
            "response_status",
            participant_response_status_enum,
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        schema="core",
    )
    op.create_index(
        "ix_core_meeting_participants_meeting_id",
        "meeting_participants",
        ["meeting_id"],
        schema="core",
    )
    op.create_index(
        "ix_core_meeting_participants_user_id",
        "meeting_participants",
        ["user_id"],
        schema="core",
    )

    op.create_table(
        "reminders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("core.tasks.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "meeting_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("core.meetings.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("remind_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("message", sa.String(512), nullable=True),
        sa.Column(
            "is_sent", sa.Boolean(), nullable=False, server_default=sa.false()
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
        schema="core",
    )
    op.create_index(
        "ix_core_reminders_user_id", "reminders", ["user_id"], schema="core"
    )
    op.create_index(
        "ix_core_reminders_task_id", "reminders", ["task_id"], schema="core"
    )
    op.create_index(
        "ix_core_reminders_meeting_id",
        "reminders",
        ["meeting_id"],
        schema="core",
    )
    op.create_index(
        "ix_core_reminders_remind_at", "reminders", ["remind_at"], schema="core"
    )
    op.create_index(
        "ix_core_reminders_is_sent", "reminders", ["is_sent"], schema="core"
    )


def downgrade() -> None:
    op.drop_table("reminders", schema="core")
    op.drop_table("meeting_participants", schema="core")
    op.drop_table("meetings", schema="core")
    op.drop_table("task_tags", schema="core")
    op.drop_table("tasks", schema="core")

    bind = op.get_bind()
    participant_response_status_enum.drop(bind, checkfirst=True)
    meeting_status_enum.drop(bind, checkfirst=True)
    task_priority_enum.drop(bind, checkfirst=True)
    task_status_enum.drop(bind, checkfirst=True)

    op.execute("DROP SCHEMA IF EXISTS core CASCADE")
