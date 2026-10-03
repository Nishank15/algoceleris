---
phase: 07-plagiarism-engine-3d-isometric-analytics-haproxy-ingress
plan: "01"
subsystem: plagiarism
tags: [plagiarism, ast-normalization, winnowing, moss, similarity-matrix]
key_files:
  - packages/gateway/src/plagiarism/__init__.py
  - packages/gateway/src/plagiarism/ast_parser.py
  - packages/gateway/src/plagiarism/winnowing.py
  - packages/gateway/src/plagiarism/detector.py
  - packages/gateway/src/plagiarism/router.py
  - packages/gateway/src/contests/store.py
  - packages/gateway/src/contests/router.py
  - packages/gateway/src/api.py
  - packages/gateway/tests/test_plagiarism.py
verification:
  - python3 -m unittest packages/gateway/tests/test_plagiarism.py
  - python3 -m unittest discover -s packages/gateway/tests
  - python3 -m unittest discover -s packages/engine/tests && python3 -m unittest discover -s packages/worker/tests
---

# Plan 07-01 Summary: AST Normalization & Winnowing Plagiarism Engine

## Objective
Implemented Abstract Syntax Tree (AST) normalization, Winnowing / MOSS local fingerprinting, pairwise similarity matrix generation, and contest collusion REST endpoints (`PLAG-01`, `PLAG-02`).

## Key Implementations

### 1. AST Extraction & Canonical Normalization (`packages/gateway/src/plagiarism/ast_parser.py`)
- **`PythonASTNormalizer`**: Traverses Python AST using `ast.NodeVisitor`. Strips docstrings, comments, type annotations, and superficial whitespace. Sequentially renames user identifiers (variables, arguments, function names) to canonical indexed tokens (`$V0`, `$V1`, ...) while preserving language built-ins. Converts numeric and string literals into `$NUM` and `$STR`.
- **`LexicalNormalizer`**: Provides token-level normalization for C++ and Java. Strips single-line (`//`) and multi-line (`/* */`) comments, preserves standard keywords/operators, and canonicalizes identifiers and literals.
- **`ASTNormalizer`**: Unified facade providing `normalize` and `normalize_to_string` across Python, C++, and Java with graceful fallbacks.

### 2. Winnowing / MOSS Fingerprinting Algorithm (`packages/gateway/src/plagiarism/winnowing.py`)
- **`WinnowingEngine`**: Implements Schleimer, Wilkerson, Aiken (SIGMOD 2003) algorithm:
  - Generates $k$-grams ($k=5$) and hashes them with deterministic 64-bit integer SHA-256 digests.
  - Applies sliding window of size $w=4$ to select window minimums (breaking ties by picking the rightmost minimum).
  - Guarantees that any shared substring of length $\ge w + k - 1 = 8$ tokens will reliably yield at least one shared fingerprint.
  - Computes Sørensen-Dice similarity score: $\frac{2 \times |F_A \cap F_B|}{|F_A| + |F_B|}$ and containment coefficient $\frac{|F_A \cap F_B|}{\min(|F_A|, |F_B|)}$.

### 3. Plagiarism Detector & Pairwise Similarity Matrix (`packages/gateway/src/plagiarism/detector.py`)
- **`PlagiarismDetector`**: Evaluates pairwise code comparisons and generates full $N \times N$ symmetric similarity matrices with diagonal $1.0$.
- Automatically flags submission pairs exceeding threshold ($\ge 0.75$ default) with detailed metrics: matched fingerprints, total fingerprints, and similarity percentages.

### 4. REST Endpoints & Contest Integration (`packages/gateway/src/plagiarism/router.py`, `contests/store.py`, `api.py`)
- **Endpoints**:
  - `POST /api/v1/plagiarism/compare`: Ad-hoc pairwise comparison of two code snippets with similarity and token metrics.
  - `POST /api/v1/contests/{contest_id}/plagiarism/run`: Post-contest batch plagiarism audit across all participant submissions, caching results into contest store.
  - `GET /api/v1/contests/{contest_id}/plagiarism/matrix`: Returns previously computed similarity matrix and flagged collusion pairs.
- Updated `ContestStore` and `InMemoryContestStore`/`RedisContestStore` with `record_submission`, `get_submissions`, `save_similarity_matrix`, and `get_similarity_matrix`.
- Integrated `record_submission` into `submit_contest_solution` and mounted `plagiarism_router` into gateway app.

## Verification
- `test_plagiarism.py`: 9/9 tests passed (Python AST renaming, C++/Java normalization, Winnowing bounds guarantee, similarity metrics, pairwise matrix, compare endpoint, and full contest submission audit workflow).
- Gateway test suite: 59/59 tests passed.
- Full repository regression suite: 95/95 tests passed across gateway, engine, and worker with zero regressions.

## Self-Check: PASSED
All artifacts exist on disk, 95 repository tests passing cleanly.
