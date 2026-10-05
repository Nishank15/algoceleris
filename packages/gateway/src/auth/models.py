from datetime import datetime
import re
from typing import Optional
import uuid

from pydantic import BaseModel, Field, field_validator


class SignupRequest(BaseModel):
    """Payload for user registration."""

    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    college_name: Optional[str] = Field(None, max_length=255)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        cleaned = v.strip()
        if not re.match(r"^[a-zA-Z0-9_-]+$", cleaned):
            raise ValueError(
                "Username may only contain alphanumeric characters, underscores, and hyphens"
            )
        return cleaned

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if not re.match(r"^[^@]+@[^@]+\.[^@]+$", cleaned):
            raise ValueError("Invalid email address format")
        return cleaned


class LoginRequest(BaseModel):
    """Payload for user authentication."""

    username_or_email: Optional[str] = None
    identifier: Optional[str] = None
    password: str = Field(..., min_length=1)

    def get_identifier(self) -> str:
        val = self.username_or_email or self.identifier
        if not val or not val.strip():
            raise ValueError("Username or email identifier is required")
        return val.strip()


class UserResponse(BaseModel):
    """Public user profile data returned to client."""

    id: uuid.UUID
    username: str
    email: str
    account_type: str = "free"
    college_name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Authentication token response with in-memory access token and profile."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int = 900  # 15 minutes
    user: UserResponse


class AvailabilityResponse(BaseModel):
    """Result of username or email availability pre-check."""

    available: bool
    field: str
    value: str
    message: str
