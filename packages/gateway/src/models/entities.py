from datetime import datetime
from typing import List, Optional
import uuid

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class User(Base):
    """User account entity representing registered developers, students, and administrators."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    account_type: Mapped[str] = mapped_column(
        String(20), default="free", nullable=False
    )
    college_name: Mapped[Optional[str]] = mapped_column(
        String(255), index=True, nullable=True
    )
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
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
    subscriptions: Mapped[List["Subscription"]] = relationship(
        "Subscription", back_populates="user", cascade="all, delete-orphan"
    )
    submissions: Mapped[List["Submission"]] = relationship(
        "Submission", back_populates="user"
    )
    contest_participations: Mapped[List["ContestParticipation"]] = relationship(
        "ContestParticipation", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User username={self.username!r} account_type={self.account_type!r}>"


class Subscription(Base):
    """Subscription record linking a user to billing gateway subscriptions."""

    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    provider: Mapped[str] = mapped_column(String(30), nullable=False)
    customer_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    subscription_id: Mapped[Optional[str]] = mapped_column(
        String(100), index=True, nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(30), default="active", nullable=False
    )
    current_period_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="subscriptions")

    def __repr__(self) -> str:
        return f"<Subscription provider={self.provider!r} status={self.status!r}>"


class Submission(Base):
    """Historical submission record capturing user attempts, code, and judge verdicts."""

    __tablename__ = "submissions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    problem_slug: Mapped[str] = mapped_column(
        String(100), index=True, nullable=False
    )
    language: Mapped[str] = mapped_column(String(20), nullable=False)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    verdict: Mapped[str] = mapped_column(String(30), nullable=False)
    runtime_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    memory_kb: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    testcases_passed: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    total_testcases: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True, nullable=False
    )

    user: Mapped[Optional["User"]] = relationship("User", back_populates="submissions")

    def __repr__(self) -> str:
        return f"<Submission problem={self.problem_slug!r} verdict={self.verdict!r}>"


class ContestParticipation(Base):
    """User participation record within a contest including rank, score, and rating delta."""

    __tablename__ = "contest_participations"
    __table_args__ = (
        UniqueConstraint("user_id", "contest_id", name="uq_user_contest"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    contest_id: Mapped[str] = mapped_column(
        String(100), index=True, nullable=False
    )
    rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    penalty_minutes: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    rating_delta: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(
        "User", back_populates="contest_participations"
    )

    def __repr__(self) -> str:
        return f"<ContestParticipation contest={self.contest_id!r} rank={self.rank}>"
