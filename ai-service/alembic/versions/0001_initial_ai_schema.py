"""initial ai schema

Revision ID: 0001
Revises:
Create Date: 2026-07-13 00:00:00.000000
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


message_role_enum = postgresql.ENUM(
    "system", "user", "assistant", "tool", name="message_role", schema="ai"
)
tool_call_status_enum = postgresql.ENUM(
    "success", "error", name="tool_call_status", schema="ai"
)


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS ai")

    bind = op.get_bind()
    message_role_enum.create(bind, checkfirst=True)
    tool_call_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
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
        schema="ai",
    )
    op.create_index(
        "ix_ai_conversations_user_id",
        "conversations",
        ["user_id"],
        schema="ai",
    )

    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ai.conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", message_role_enum, nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("tool_calls", postgresql.JSONB(), nullable=True),
        sa.Column("tool_call_id", sa.String(64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        schema="ai",
    )
    op.create_index(
        "ix_ai_messages_conversation_id",
        "messages",
        ["conversation_id"],
        schema="ai",
    )
    op.create_index(
        "ix_ai_messages_created_at", "messages", ["created_at"], schema="ai"
    )

    op.create_table(
        "tool_call_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "message_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ai.messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tool_name", sa.String(128), nullable=False),
        sa.Column("arguments", postgresql.JSONB(), nullable=False),
        sa.Column("result", postgresql.JSONB(), nullable=True),
        sa.Column("status", tool_call_status_enum, nullable=False),
        sa.Column("error_message", sa.String(1024), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        schema="ai",
    )
    op.create_index(
        "ix_ai_tool_call_logs_message_id",
        "tool_call_logs",
        ["message_id"],
        schema="ai",
    )
    op.create_index(
        "ix_ai_tool_call_logs_tool_name",
        "tool_call_logs",
        ["tool_name"],
        schema="ai",
    )


def downgrade() -> None:
    op.drop_table("tool_call_logs", schema="ai")
    op.drop_table("messages", schema="ai")
    op.drop_table("conversations", schema="ai")

    bind = op.get_bind()
    tool_call_status_enum.drop(bind, checkfirst=True)
    message_role_enum.drop(bind, checkfirst=True)

    op.execute("DROP SCHEMA IF EXISTS ai CASCADE")
