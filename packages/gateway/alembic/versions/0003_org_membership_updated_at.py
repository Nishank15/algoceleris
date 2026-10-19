"""Add updated_at to org_memberships for login-time membership mutation tracking.

Revision ID: 0003_org_membership_updated_at
Revises: 0002_campus_portal
Create Date: 2026-10-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0003_org_membership_updated_at"
down_revision: Union[str, None] = "0002_campus_portal"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Track when a membership's role/status was last reconciled at institutional login.
    #    Batch mode keeps the non-constant server default valid on SQLite, where
    #    ALTER TABLE ADD COLUMN only accepts constant defaults.
    with op.batch_alter_table("org_memberships") as batch_op:
        batch_op.add_column(
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            )
        )


def downgrade() -> None:
    # 1. Drop the membership mutation timestamp.
    with op.batch_alter_table("org_memberships") as batch_op:
        batch_op.drop_column("updated_at")
