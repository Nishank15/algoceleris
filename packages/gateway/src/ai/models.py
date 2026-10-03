from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AIDebugRequest(BaseModel):
    user_id: str = Field(..., description="User unique identifier")
    language: str = Field(..., description="Programming language (e.g. cpp, python, java)")
    source_code: str = Field(..., min_length=1, description="Student/user source code that failed")
    problem_title: str = Field(..., description="Competitive programming problem title")
    problem_description: str = Field(..., description="Problem description and constraints")
    failing_test_cases: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of failing test cases with input, expected, and actual output",
    )
    error_diagnostics: Optional[str] = Field(
        default=None,
        description="Compiler error log, sanitization violation, or runtime traceback",
    )


class AIDebugResponse(BaseModel):
    root_cause: str = Field(
        ...,
        description="Crisp root-cause analysis identifying the exact algorithmic bug, logic flaw, or edge case.",
    )
    complexity_analysis: str = Field(
        ...,
        description="Evaluation of current time and space complexity vs target constraints.",
    )
    fix_explanation: str = Field(
        ...,
        description="Concise description of the modifications made to fix the solution.",
    )
    fixed_code: str = Field(
        ...,
        description="Complete, syntactically valid corrected source code ready for compilation and evaluation.",
    )
    code_diff: str = Field(
        ...,
        description="Standard unified diff comparing original source code to the corrected source code.",
    )
