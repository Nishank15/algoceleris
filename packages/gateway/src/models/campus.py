from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class CampusRole(str, Enum):
    """Institutional access control roles."""
    ORG_ADMIN = "org_admin"
    INSTRUCTOR = "instructor"
    TEACHING_ASSISTANT = "teaching_assistant"
    STUDENT = "student"


class MembershipStatus(str, Enum):
    """Cohort enrollment statuses."""
    ACTIVE = "active"
    INVITED = "invited"
    SUSPENDED = "suspended"


class AssessmentMode(str, Enum):
    """Assessment execution formats."""
    EXAM = "EXAM"
    HOMEWORK = "HOMEWORK"
    VIVA = "VIVA"


class AssessmentStatus(str, Enum):
    """Assessment state machine statuses."""
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    ACTIVE = "ACTIVE"
    GRACE_PERIOD = "GRACE_PERIOD"
    CLOSED = "CLOSED"


class Organization(Base):
    """Multi-tenant educational or corporate enterprise account."""

    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    domain_whitelist: Mapped[List[str]] = mapped_column(
        JSON, default=list, nullable=False
    )
    branding_config: Mapped[Dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    cohorts: Mapped[List["Cohort"]] = relationship(
        "Cohort", back_populates="organization", cascade="all, delete-orphan"
    )
    memberships: Mapped[List["OrgMembership"]] = relationship(
        "OrgMembership", back_populates="organization", cascade="all, delete-orphan"
    )
    assessments: Mapped[List["Assessment"]] = relationship(
        "Assessment", back_populates="organization", cascade="all, delete-orphan"
    )
    interview_rooms: Mapped[List["InterviewRoom"]] = relationship(
        "InterviewRoom", back_populates="organization", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Organization slug={self.slug!r} name={self.name!r}>"


class Cohort(Base):
    """Academic class, section, or batch of students within an Organization."""

    __tablename__ = "cohorts"
    __table_args__ = (
        UniqueConstraint("org_id", "code", name="uq_org_cohort_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    term: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization", back_populates="cohorts"
    )
    memberships: Mapped[List["OrgMembership"]] = relationship(
        "OrgMembership", back_populates="cohort"
    )
    assessments: Mapped[List["Assessment"]] = relationship(
        "Assessment", back_populates="cohort", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Cohort code={self.code!r} name={self.name!r}>"


class OrgMembership(Base):
    """User membership within an organization and optional cohort assignment."""

    __tablename__ = "org_memberships"
    __table_args__ = (
        UniqueConstraint("org_id", "user_id", "cohort_id", name="uq_user_org_cohort"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    cohort_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("cohorts.id", ondelete="SET NULL"), index=True, nullable=True
    )
    role: Mapped[str] = mapped_column(
        String(30), default=CampusRole.STUDENT, nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(30), default=MembershipStatus.ACTIVE, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization", back_populates="memberships"
    )
    user: Mapped["User"] = relationship("User")
    cohort: Mapped[Optional["Cohort"]] = relationship(
        "Cohort", back_populates="memberships"
    )

    def __repr__(self) -> str:
        return f"<OrgMembership user_id={self.user_id} role={self.role!r}>"


class Assessment(Base):
    """Institutional exam, homework assignment, or live viva session."""

    __tablename__ = "assessments"
    __table_args__ = (
        CheckConstraint(
            "publish_at <= starts_at AND starts_at <= due_at AND due_at <= cutoff_at",
            name="ck_assessment_timeline",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    cohort_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("cohorts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    mode: Mapped[str] = mapped_column(
        String(20), default=AssessmentMode.EXAM, nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), default=AssessmentStatus.DRAFT, index=True, nullable=False
    )
    problem_slugs: Mapped[List[str]] = mapped_column(
        JSON, default=list, nullable=False
    )
    scoring_rubric: Mapped[Dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False
    )
    publish_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    due_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    cutoff_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    duration_minutes: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    late_penalty_percent_per_hour: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False
    )
    max_late_penalty_percent: Mapped[float] = mapped_column(
        Float, default=100.0, nullable=False
    )
    proctoring_config: Mapped[Dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization", back_populates="assessments"
    )
    cohort: Mapped["Cohort"] = relationship(
        "Cohort", back_populates="assessments"
    )
    creator: Mapped["User"] = relationship("User")
    submissions: Mapped[List["AssessmentSubmission"]] = relationship(
        "AssessmentSubmission", back_populates="assessment", cascade="all, delete-orphan"
    )
    proctor_events: Mapped[List["ProctorEvent"]] = relationship(
        "ProctorEvent", back_populates="assessment", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Assessment id={self.id} title={self.title!r} status={self.status!r}>"


class AssessmentSubmission(Base):
    """Institutional student submission record capturing grades, late penalties, and proctoring stats."""

    __tablename__ = "assessment_submissions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("assessments.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("submissions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    raw_score: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False
    )
    late_penalty_deduction: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False
    )
    final_score: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    is_late: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    proctor_events_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    eval_verdict: Mapped[str] = mapped_column(
        String(50), default="PENDING", nullable=False
    )
    feedback_notes: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )

    # Relationships
    assessment: Mapped["Assessment"] = relationship(
        "Assessment", back_populates="submissions"
    )
    user: Mapped["User"] = relationship("User")
    submission: Mapped["Submission"] = relationship("Submission")

    def __repr__(self) -> str:
        return f"<AssessmentSubmission user={self.user_id} final_score={self.final_score}>"


class InterviewRoom(Base):
    """Real-time multiplayer technical interview or viva examination room."""

    __tablename__ = "interview_rooms"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True
    )
    assessment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("assessments.id", ondelete="SET NULL"), index=True, nullable=True
    )
    room_code: Mapped[str] = mapped_column(
        String(32), unique=True, index=True, nullable=False
    )
    host_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    candidate_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    problem_slug: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    language: Mapped[str] = mapped_column(
        String(20), default="python", nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(30), default="WAITING", nullable=False
    )
    editor_code: Mapped[str] = mapped_column(
        Text, default="", nullable=False
    )
    interviewer_notes: Mapped[str] = mapped_column(
        Text, default="", nullable=False
    )
    rubric_scores: Mapped[Dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    organization: Mapped[Optional["Organization"]] = relationship(
        "Organization", back_populates="interview_rooms"
    )
    assessment: Mapped[Optional["Assessment"]] = relationship("Assessment")
    host: Mapped["User"] = relationship("User", foreign_keys=[host_user_id])
    candidate: Mapped["User"] = relationship("User", foreign_keys=[candidate_user_id])

    def __repr__(self) -> str:
        return f"<InterviewRoom room_code={self.room_code!r} status={self.status!r}>"


class ProctorEvent(Base):
    """Proctoring anomaly telemetry event captured during an assessment."""

    __tablename__ = "proctor_events"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("assessments.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    event_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )
    severity: Mapped[str] = mapped_column(
        String(20), default="warning", nullable=False
    )
    event_metadata: Mapped[Dict[str, Any]] = mapped_column(
        "metadata", JSON, default=dict, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    assessment: Mapped["Assessment"] = relationship(
        "Assessment", back_populates="proctor_events"
    )
    user: Mapped["User"] = relationship("User")

    def __repr__(self) -> str:
        return f"<ProctorEvent event_type={self.event_type!r} severity={self.severity!r}>"
