"""Initial baseline schema for users, subscriptions, submissions, and contest participations.

Revision ID: 0001_initial_schema
Revises: None
Create Date: 2026-10-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Users table
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "account_type",
            sa.String(length=20),
            server_default="free",
            nullable=False,
        ),
        sa.Column("college_name", sa.String(length=255), nullable=True),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index(
        "ix_users_college_name", "users", ["college_name"], unique=False
    )

    # 2. Subscriptions table
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column("customer_id", sa.String(length=100), nullable=True),
        sa.Column("subscription_id", sa.String(length=100), nullable=True),
        sa.Column(
            "status",
            sa.String(length=30),
            server_default="active",
            nullable=False,
        ),
        sa.Column(
            "current_period_end", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_subscriptions_user_id", "subscriptions", ["user_id"], unique=False
    )
    op.create_index(
        "ix_subscriptions_subscription_id",
        "subscriptions",
        ["subscription_id"],
        unique=False,
    )

    # 3. Submissions table
    op.create_table(
        "submissions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("problem_slug", sa.String(length=100), nullable=False),
        sa.Column("language", sa.String(length=20), nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("verdict", sa.String(length=30), nullable=False),
        sa.Column(
            "runtime_ms", sa.Integer(), server_default="0", nullable=False
        ),
        sa.Column("memory_kb", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "testcases_passed",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "total_testcases", sa.Integer(), server_default="0", nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_submissions_user_id", "submissions", ["user_id"], unique=False
    )
    op.create_index(
        "ix_submissions_problem_slug",
        "submissions",
        ["problem_slug"],
        unique=False,
    )
    op.create_index(
        "ix_submissions_created_at", "submissions", ["created_at"], unique=False
    )

    # 4. Contest Participations table
    op.create_table(
        "contest_participations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("contest_id", sa.String(length=100), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=True),
        sa.Column("score", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "penalty_minutes", sa.Integer(), server_default="0", nullable=False
        ),
        sa.Column(
            "rating_delta", sa.Integer(), server_default="0", nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "contest_id", name="uq_user_contest"),
    )
    op.create_index(
        "ix_contest_participations_user_id",
        "contest_participations",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_contest_participations_contest_id",
        "contest_participations",
        ["contest_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("contest_participations")
    op.drop_table("submissions")
    op.drop_table("subscriptions")
    op.drop_table("users")
