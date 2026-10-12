"""AlgoCeleris Campus Multi-Tenant Institutional Assessment & Live Proctoring Portal Schema.

Revision ID: 0002_campus_portal
Revises: 0001_initial_schema
Create Date: 2026-10-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0002_campus_portal"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Organizations
    op.create_table(
        "organizations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("domain_whitelist", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("branding_config", sa.JSON(), server_default="{}", nullable=False),
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
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)

    # 2. Cohorts
    op.create_table(
        "cohorts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("term", sa.String(length=50), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "code", name="uq_org_cohort_code"),
    )
    op.create_index("ix_cohorts_org_id", "cohorts", ["org_id"], unique=False)

    # 3. Organization Memberships
    op.create_table(
        "org_memberships",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("cohort_id", sa.Uuid(), nullable=True),
        sa.Column(
            "role",
            sa.String(length=30),
            server_default="student",
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=30),
            server_default="active",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["cohort_id"], ["cohorts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "user_id", "cohort_id", name="uq_user_org_cohort"),
    )
    op.create_index("ix_org_memberships_user_id", "org_memberships", ["user_id"], unique=False)
    op.create_index("ix_org_memberships_cohort_id", "org_memberships", ["cohort_id"], unique=False)

    # 4. Assessments
    op.create_table(
        "assessments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("cohort_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "mode",
            sa.String(length=20),
            server_default="EXAM",
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="DRAFT",
            nullable=False,
        ),
        sa.Column("problem_slugs", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("scoring_rubric", sa.JSON(), server_default="{}", nullable=False),
        sa.Column("publish_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cutoff_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("late_penalty_percent_per_hour", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("max_late_penalty_percent", sa.Float(), server_default="100.0", nullable=False),
        sa.Column("proctoring_config", sa.JSON(), server_default="{}", nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
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
        sa.CheckConstraint(
            "publish_at <= starts_at AND starts_at <= due_at AND due_at <= cutoff_at",
            name="ck_assessment_timeline",
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["cohort_id"], ["cohorts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_assessments_cohort_id", "assessments", ["cohort_id"], unique=False)
    op.create_index("ix_assessments_status", "assessments", ["status"], unique=False)

    # 5. Assessment Submissions
    op.create_table(
        "assessment_submissions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("assessment_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("submission_id", sa.Uuid(), nullable=False),
        sa.Column("raw_score", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("late_penalty_deduction", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("final_score", sa.Float(), server_default="0.0", nullable=False),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("is_late", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("proctor_events_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("eval_verdict", sa.String(length=50), server_default="PENDING", nullable=False),
        sa.Column("feedback_notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["assessment_id"], ["assessments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_asub_assessment_user", "assessment_submissions", ["assessment_id", "user_id"], unique=False)

    # 6. Interview Rooms (Viva)
    op.create_table(
        "interview_rooms",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=True),
        sa.Column("assessment_id", sa.Uuid(), nullable=True),
        sa.Column("room_code", sa.String(length=32), nullable=False),
        sa.Column("host_user_id", sa.Uuid(), nullable=False),
        sa.Column("candidate_user_id", sa.Uuid(), nullable=False),
        sa.Column("problem_slug", sa.String(length=100), nullable=False),
        sa.Column("language", sa.String(length=20), server_default="python", nullable=False),
        sa.Column("status", sa.String(length=30), server_default="WAITING", nullable=False),
        sa.Column("editor_code", sa.Text(), server_default="", nullable=False),
        sa.Column("interviewer_notes", sa.Text(), server_default="", nullable=False),
        sa.Column("rubric_scores", sa.JSON(), server_default="{}", nullable=False),
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
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assessment_id"], ["assessments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["host_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["candidate_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_interview_rooms_room_code", "interview_rooms", ["room_code"], unique=True)

    # 7. Proctor Events
    op.create_table(
        "proctor_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("assessment_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("severity", sa.String(length=20), server_default="warning", nullable=False),
        sa.Column("metadata", sa.JSON(), server_default="{}", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["assessment_id"], ["assessments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_proctor_assessment", "proctor_events", ["assessment_id", "user_id"], unique=False)

    # 8. Extend Submissions table with nullable assessment_id and room_id foreign keys
    with op.batch_alter_table("submissions") as batch_op:
        batch_op.add_column(sa.Column("assessment_id", sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column("room_id", sa.Uuid(), nullable=True))
        batch_op.create_foreign_key(
            "fk_submissions_assessment_id",
            "assessments",
            ["assessment_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_foreign_key(
            "fk_submissions_room_id",
            "interview_rooms",
            ["room_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_submissions_assessment_id", ["assessment_id"], unique=False)
        batch_op.create_index("ix_submissions_room_id", ["room_id"], unique=False)


def downgrade() -> None:
    # 1. Remove extended columns from submissions
    with op.batch_alter_table("submissions") as batch_op:
        batch_op.drop_index("ix_submissions_room_id")
        batch_op.drop_index("ix_submissions_assessment_id")
        batch_op.drop_constraint("fk_submissions_room_id", type_="foreignkey")
        batch_op.drop_constraint("fk_submissions_assessment_id", type_="foreignkey")
        batch_op.drop_column("room_id")
        batch_op.drop_column("assessment_id")

    # 2. Drop campus tables in reverse order
    op.drop_table("proctor_events")
    op.drop_table("interview_rooms")
    op.drop_table("assessment_submissions")
    op.drop_table("assessments")
    op.drop_table("org_memberships")
    op.drop_table("cohorts")
    op.drop_table("organizations")
