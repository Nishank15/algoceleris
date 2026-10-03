from .ast_parser import ASTNormalizer
from .detector import CompareResult, PlagiarismDetector, PlagiarismMatch, SimilarityMatrix
from .router import create_plagiarism_router
from .winnowing import WinnowingEngine

__all__ = [
    "ASTNormalizer",
    "WinnowingEngine",
    "PlagiarismDetector",
    "PlagiarismMatch",
    "SimilarityMatrix",
    "CompareResult",
    "create_plagiarism_router",
]
