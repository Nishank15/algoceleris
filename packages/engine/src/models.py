from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class ExecutionVerdict(str, Enum):
    ACCEPTED = "ACCEPTED"
    WRONG_ANSWER = "WRONG_ANSWER"
    TIME_LIMIT_EXCEEDED = "TIME_LIMIT_EXCEEDED"
    MEMORY_LIMIT_EXCEEDED = "MEMORY_LIMIT_EXCEEDED"
    COMPILATION_ERROR = "COMPILATION_ERROR"
    RUNTIME_ERROR = "RUNTIME_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"


@dataclass
class ResourceLimits:
    memory_limit_bytes: int = 268435456  # 256 MB
    cpu_limit_pct: int = 100            # 100% of 1 core (1 CPU)
    time_limit_ms: int = 2000           # 2000 ms (2 seconds)
    pids_limit: int = 64                # max processes/threads


@dataclass
class ExecutionMetrics:
    cpu_time_ms: int = 0
    wall_time_ms: int = 0
    peak_memory_bytes: int = 0
    exit_code: int = 0


@dataclass
class ExecutionResult:
    verdict: ExecutionVerdict
    stdout: str = ""
    stderr: str = ""
    metrics: ExecutionMetrics = field(default_factory=ExecutionMetrics)
    error_message: Optional[str] = None
