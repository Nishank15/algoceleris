from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class SubmissionStatus(str, Enum):
    QUEUED = "QUEUED"
    COMPILING = "COMPILING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class TestCaseInput(BaseModel):
    id: int
    input_data: str = ""
    expected_output: str
    is_sample: bool = False


class SubmissionRequest(BaseModel):
    language: str
    source_code: str = Field(..., min_length=1, max_length=65536)
    time_limit_ms: int = Field(default=2000, ge=100, le=10000)
    memory_limit_bytes: int = Field(default=268435456, ge=16777216, le=1073741824)
    test_cases: List[TestCaseInput] = Field(..., min_length=1)

    @field_validator("language")
    @classmethod
    def validate_language(cls, val: str) -> str:
        cleaned = val.strip().lower()
        allowed = {"cpp", "c++", "python", "python3", "py", "java"}
        if cleaned not in allowed:
            raise ValueError(
                f"Unsupported language '{val}'. Allowed languages: cpp, python, java"
            )
        # Normalize canonical names
        if cleaned in {"c++", "cpp"}:
            return "cpp"
        if cleaned in {"py", "python3", "python"}:
            return "python"
        if cleaned == "java":
            return "java"
        return cleaned


class SubmissionResponse(BaseModel):
    submission_id: str
    status: SubmissionStatus
    message: str = "Submission queued successfully"


class StreamEvent(BaseModel):
    event_type: str
    submission_id: str
    data: Dict[str, Any] = Field(default_factory=dict)
