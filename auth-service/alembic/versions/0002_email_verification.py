"""email verification tokens

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-23 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_verification_tokens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auth.users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "token_hash",
            sa.String(64),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "used",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        schema="auth",
    )

    op.create_index(
        "ix_auth_email_verification_tokens_user_id",
        "email_verification_tokens",
        ["user_id"],
        schema="auth",
    )

    op.create_index(
        "ix_auth_email_verification_tokens_token_hash",
        "email_verification_tokens",
        ["token_hash"],
        unique=True,
        schema="auth",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_auth_email_verification_tokens_token_hash",
        table_name="email_verification_tokens",
        schema="auth",
    )

    op.drop_index(
        "ix_auth_email_verification_tokens_user_id",
        table_name="email_verification_tokens",
        schema="auth",
    )

    op.drop_table(
        "email_verification_tokens",
        schema="auth",
    )