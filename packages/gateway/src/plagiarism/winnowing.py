from __future__ import annotations

import hashlib
from typing import List, Set, Tuple


class WinnowingEngine:
    """
    Winnowing / MOSS local fingerprinting algorithm for document similarity.
    Schleimer, Wilkerson, Aiken (SIGMOD 2003): 'Winnowing: Local Algorithms for Document Fingerprinting'.

    Guarantees that any shared substring of length >= w + k - 1 tokens
    will reliably share at least one identical fingerprint.
    """

    def __init__(self, k: int = 5, w: int = 4) -> None:
        """
        Args:
            k: k-gram size (number of consecutive tokens per gram)
            w: sliding window size
        """
        if k < 1:
            raise ValueError("k must be >= 1")
        if w < 1:
            raise ValueError("w must be >= 1")
        self.k = k
        self.w = w

    def _hash_gram(self, gram: Tuple[str, ...]) -> int:
        """Deterministically compute 64-bit unsigned integer hash for a k-gram."""
        gram_str = "\x1f".join(gram)
        digest = hashlib.sha256(gram_str.encode("utf-8")).hexdigest()
        return int(digest[:16], 16)

    def extract_kgrams(self, tokens: List[str]) -> List[Tuple[int, Tuple[str, ...]]]:
        """Returns list of (token_index, k-gram)."""
        if len(tokens) < self.k:
            return []
        kgrams = []
        for i in range(len(tokens) - self.k + 1):
            gram = tuple(tokens[i : i + self.k])
            kgrams.append((i, gram))
        return kgrams

    def generate_fingerprints(self, tokens: List[str]) -> Set[Tuple[int, int]]:
        """
        Executes the Winnowing algorithm over tokens.
        Returns a set of (hash_value, position) fingerprints.
        """
        if len(tokens) < self.k:
            if not tokens:
                return set()
            # If fewer tokens than k, produce a single fallback fingerprint of the entire sequence
            single_hash = self._hash_gram(tuple(tokens))
            return {(single_hash, 0)}

        # 1. Compute hash for all k-grams
        gram_hashes: List[Tuple[int, int]] = []  # (hash_value, position)
        for i in range(len(tokens) - self.k + 1):
            h = self._hash_gram(tuple(tokens[i : i + self.k]))
            gram_hashes.append((h, i))

        # 2. Slide window of size w
        fingerprints: Set[Tuple[int, int]] = set()
        n = len(gram_hashes)

        if n <= self.w:
            # If total hashes <= window size, select the minimum hash
            min_entry = min(gram_hashes, key=lambda entry: (entry[0], -entry[1]))
            fingerprints.add(min_entry)
            return fingerprints

        min_selected: Tuple[int, int] | None = None
        for i in range(n - self.w + 1):
            window = gram_hashes[i : i + self.w]
            # Standard Winnowing tie-break: in case of equal minimums, pick the rightmost occurrence
            # We sort by hash ascending, then position descending
            cur_min = min(window, key=lambda entry: (entry[0], -entry[1]))
            if min_selected != cur_min:
                min_selected = cur_min
                fingerprints.add(cur_min)

        return fingerprints

    def get_hash_set(self, tokens: List[str]) -> Set[int]:
        """Returns only the set of hash values (ignoring positions) for pairwise comparison."""
        fps = self.generate_fingerprints(tokens)
        return {h for h, _ in fps}

    @staticmethod
    def calculate_similarity(fingerprints_a: Set[int], fingerprints_b: Set[int]) -> float:
        """
        Calculates Sørensen-Dice similarity score:
        similarity(A, B) = 2 * |A ∩ B| / (|A| + |B|)
        Returns float between 0.0 and 1.0.
        """
        if not fingerprints_a and not fingerprints_b:
            return 1.0
        if not fingerprints_a or not fingerprints_b:
            return 0.0

        intersection = fingerprints_a.intersection(fingerprints_b)
        total = len(fingerprints_a) + len(fingerprints_b)
        if total == 0:
            return 1.0
        return round((2.0 * len(intersection)) / total, 4)

    @staticmethod
    def calculate_containment(fingerprints_a: Set[int], fingerprints_b: Set[int]) -> float:
        """
        Calculates containment coefficient: |A ∩ B| / min(|A|, |B|).
        Useful for detecting when one submission is almost entirely embedded within another.
        """
        if not fingerprints_a or not fingerprints_b:
            return 0.0
        intersection = fingerprints_a.intersection(fingerprints_b)
        min_size = min(len(fingerprints_a), len(fingerprints_b))
        if min_size == 0:
            return 0.0
        return round(len(intersection) / min_size, 4)
