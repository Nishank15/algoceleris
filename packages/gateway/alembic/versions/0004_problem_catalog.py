"""Server-authoritative problem catalog: problem definitions and test cases.

Revision ID: 0004_problem_catalog
Revises: 0003_org_membership_updated_at
Create Date: 2026-10-18 00:00:00.000000

The tables created here are the relational home of the problem catalog. Rows are
seeded idempotently at gateway startup from the canonical catalog
(`judge_db::problem_catalog` -> `judge_db::repositories::problem::seed_problem_catalog`),
so the same definitions and test cases back both the public catalog API (sample cases
only) and submission grading (all cases).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0004_problem_catalog"
down_revision: Union[str, None] = "0003_org_membership_updated_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Problem definitions (slug is the primary key).
    op.create_table(
        "problems",
        sa.Column("id", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("difficulty", sa.String(length=20), nullable=False),
        sa.Column("time_limit_ms", sa.Integer(), server_default="2000", nullable=False),
        sa.Column(
            "memory_limit_bytes",
            sa.BigInteger(),
            server_default="268435456",
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("constraints", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("tags", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("acceptance_rate", sa.Float(), server_default="0", nullable=False),
        sa.Column(
            "is_published",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_problems_published", "problems", ["is_published"])

    # 2. Test cases attached to a problem; sample cases are served publicly while the
    #    hidden ones stay server-side and are only used for grading.
    op.create_table(
        "problem_test_cases",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("problem_id", sa.String(length=100), nullable=False),
        sa.Column("input_data", sa.Text(), nullable=False),
        sa.Column("expected_output", sa.Text(), nullable=False),
        sa.Column(
            "is_sample",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["problem_id"], ["problems.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "problem_id", "ordinal", name="uq_problem_test_cases_ordinal"
        ),
    )
    op.create_index(
        "ix_problem_test_cases_problem_id", "problem_test_cases", ["problem_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_problem_test_cases_problem_id", table_name="problem_test_cases")
    op.drop_table("problem_test_cases")
    op.drop_index("ix_problems_published", table_name="problems")
    op.drop_table("problems")
