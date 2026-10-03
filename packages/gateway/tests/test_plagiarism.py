import unittest
from fastapi.testclient import TestClient

from packages.gateway.src.api import create_app
from packages.gateway.src.contests.store import InMemoryContestStore
from packages.gateway.src.plagiarism.ast_parser import ASTNormalizer
from packages.gateway.src.plagiarism.detector import PlagiarismDetector
from packages.gateway.src.plagiarism.winnowing import WinnowingEngine
from packages.gateway.src.queue import InMemoryQueueBroker
from packages.gateway.src.ratelimit import InMemoryTokenBucketStorage, TokenBucketLimiter
from packages.gateway.src.subscriptions import InMemorySubscriptionStore


class TestPlagiarismEngine(unittest.TestCase):
    def setUp(self):
        self.broker = InMemoryQueueBroker()
        self.sub_store = InMemorySubscriptionStore()
        self.contest_store = InMemoryContestStore()
        self.rate_limiter = TokenBucketLimiter(InMemoryTokenBucketStorage())
        self.detector = PlagiarismDetector(k=5, w=4, default_threshold=0.75)
        self.app = create_app(
            broker=self.broker,
            subscription_store=self.sub_store,
            rate_limiter=self.rate_limiter,
            contest_store=self.contest_store,
            plagiarism_detector=self.detector,
        )
        self.client = TestClient(self.app)

    # ----------------------------------------------------
    # 1. AST Extraction & Normalization Tests (PLAG-01)
    # ----------------------------------------------------
    def test_python_ast_variable_renaming(self):
        """Variable/parameter renaming should produce identical normalized tokens."""
        code1 = """
def two_sum(nums, target):
    \"\"\"Find two numbers that sum up to target.\"\"\"
    # Use hash map lookup
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []
"""
        code2 = """
def solve(arr, k):
    # Completely different variable names and comments
    table = {}
    for idx, val in enumerate(arr):
        remainder = k - val
        if remainder in table:
            return [table[remainder], idx]
        table[val] = idx
    return []
"""
        tokens1 = ASTNormalizer.normalize(code1, "python")
        tokens2 = ASTNormalizer.normalize(code2, "python")
        self.assertEqual(tokens1, tokens2)

    def test_python_ast_structural_dissimilarity(self):
        """Structurally distinct algorithms must produce different normalized tokens."""
        hash_solution = """
def solve(arr, target):
    seen = {}
    for i, x in enumerate(arr):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i
    return []
"""
        nested_loop_solution = """
def solve(arr, target):
    n = len(arr)
    for i in range(n):
        for j in range(i + 1, n):
            if arr[i] + arr[j] == target:
                return [i, j]
    return []
"""
        tokens1 = ASTNormalizer.normalize(hash_solution, "python")
        tokens2 = ASTNormalizer.normalize(nested_loop_solution, "python")
        self.assertNotEqual(tokens1, tokens2)

    def test_cpp_lexical_normalization(self):
        """C++ normalizer strips comments and normalizes user identifiers."""
        cpp_code1 = """
#include <vector>
#include <unordered_map>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    // Hash map to record seen numbers
    unordered_map<int, int> seen;
    for (int i = 0; i < nums.size(); ++i) {
        int complement = target - nums[i];
        if (seen.find(complement) != seen.end()) {
            return {seen[complement], i};
        }
        seen[nums[i]] = i;
    }
    return {};
}
"""
        cpp_code2 = """
#include <vector>
#include <unordered_map>
using namespace std;

/* Alternative solution with renamed identifiers */
vector<int> solve(vector<int>& arr, int k) {
    unordered_map<int, int> mp;
    for (int idx = 0; idx < arr.size(); ++idx) {
        int diff = k - arr[idx];
        if (mp.find(diff) != mp.end()) {
            return {mp[diff], idx};
        }
        mp[arr[idx]] = idx;
    }
    return {};
}
"""
        tokens1 = ASTNormalizer.normalize(cpp_code1, "cpp")
        tokens2 = ASTNormalizer.normalize(cpp_code2, "cpp")
        self.assertEqual(tokens1, tokens2)

    def test_java_normalization(self):
        """Java normalization strips comments and standardizes variables."""
        java1 = """
public class Solution {
    // Solves 2-sum
    public int[] twoSum(int[] nums, int target) {
        HashMap<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int comp = target - nums[i];
            if (map.containsKey(comp)) {
                return new int[]{map.get(comp), i};
            }
            map.put(nums[i], i);
        }
        return new int[]{};
    }
}
"""
        java2 = """
public class Solution {
    /* Different comments and variable names */
    public int[] solve(int[] arr, int k) {
        HashMap<Integer, Integer> dict = new HashMap<>();
        for (int idx = 0; idx < arr.length; idx++) {
            int diff = k - arr[idx];
            if (dict.containsKey(diff)) {
                return new int[]{dict.get(diff), idx};
            }
            dict.put(arr[idx], idx);
        }
        return new int[]{};
    }
}
"""
        tokens1 = ASTNormalizer.normalize(java1, "java")
        tokens2 = ASTNormalizer.normalize(java2, "java")
        self.assertEqual(tokens1, tokens2)

    # ----------------------------------------------------
    # 2. Winnowing / MOSS Algorithm Tests (PLAG-02)
    # ----------------------------------------------------
    def test_winnowing_bounds_guarantee(self):
        """
        Winnowing theorem: Any substring of length >= w + k - 1
        guarantees that at least one fingerprint is selected from it.
        """
        engine = WinnowingEngine(k=5, w=4)
        # Sequence of length w + k - 1 = 8 tokens
        tokens = ["T0", "T1", "T2", "T3", "T4", "T5", "T6", "T7"]
        fps = engine.generate_fingerprints(tokens)
        self.assertGreaterEqual(len(fps), 1)

    def test_winnowing_similarity_metrics(self):
        """Identical code yields 1.0 similarity, dissimilar yields low."""
        engine = WinnowingEngine(k=5, w=4)
        tokens_a = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
        tokens_b = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
        tokens_c = ["Z", "Y", "X", "W", "V", "U", "T", "S", "R", "Q"]

        fps_a = engine.get_hash_set(tokens_a)
        fps_b = engine.get_hash_set(tokens_b)
        fps_c = engine.get_hash_set(tokens_c)

        self.assertEqual(engine.calculate_similarity(fps_a, fps_b), 1.0)
        self.assertLess(engine.calculate_similarity(fps_a, fps_c), 0.20)

    # ----------------------------------------------------
    # 3. Plagiarism Detector & Matrix Tests
    # ----------------------------------------------------
    def test_plagiarism_pairwise_matrix(self):
        """Evaluates pairwise N x N similarity matrix and flags collusion."""
        code_alice = """
def two_sum(nums, target):
    seen = {}
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i
    return []
"""
        # Bob copied Alice with renamed variables
        code_bob = """
def solve(arr, k):
    table = {}
    for idx, val in enumerate(arr):
        if k - val in table:
            return [table[k - val], idx]
        table[val] = idx
    return []
"""
        # Charlie wrote an independent O(N^2) solution
        code_charlie = """
def solve(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
"""
        submissions = [
            {"user_id": "alice", "source_code": code_alice, "language": "python"},
            {"user_id": "bob", "source_code": code_bob, "language": "python"},
            {"user_id": "charlie", "source_code": code_charlie, "language": "python"},
        ]

        matrix = self.detector.analyze_submissions(
            submissions, contest_id="contest-101", problem_id="two-sum", threshold=0.75
        )

        self.assertEqual(matrix.total_analyzed, 3)
        self.assertEqual(len(matrix.matrix), 3)
        # Diagonal elements are 1.0
        for i in range(3):
            self.assertEqual(matrix.matrix[i][i], 1.0)

        # Alice and Bob should be flagged
        flagged_users = [(m.user_a, m.user_b) for m in matrix.flagged_pairs]
        self.assertIn(("alice", "bob"), flagged_users)
        self.assertGreaterEqual(matrix.flagged_pairs[0].similarity, 0.95)

    # ----------------------------------------------------
    # 4. REST API Endpoint Tests
    # ----------------------------------------------------
    def test_compare_endpoint(self):
        """POST /api/v1/plagiarism/compare returns similarity and flag status."""
        code1 = "def f(a, b): return a + b"
        code2 = "def g(x, y): return x + y"
        resp = self.client.post(
            "/api/v1/plagiarism/compare",
            json={"code_a": code1, "code_b": code2, "lang_a": "python", "lang_b": "python"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("similarity", data)
        self.assertGreaterEqual(data["similarity"], 0.75)
        self.assertTrue(data["is_flagged"])

    def test_contest_plagiarism_workflow(self):
        """Test full contest submission flow followed by post-contest plagiarism run."""
        contest_id = "weekly-contest-1"

        # Submit Alice's solution
        sub_a = self.client.post(
            f"/api/v1/contests/{contest_id}/submit",
            json={
                "user_id": "user-alice",
                "problem_id": "two-sum",
                "language": "python",
                "source_code": "def two_sum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        if target - x in seen: return [seen[target - x], i]\n        seen[x] = i\n    return []\n",
            },
        )
        self.assertEqual(sub_a.status_code, 200)

        # Submit Bob's copied solution
        sub_b = self.client.post(
            f"/api/v1/contests/{contest_id}/submit",
            json={
                "user_id": "user-bob",
                "problem_id": "two-sum",
                "language": "python",
                "source_code": "def solve(arr, k):\n    dict_map = {}\n    for idx, val in enumerate(arr):\n        if k - val in dict_map: return [dict_map[k - val], idx]\n        dict_map[val] = idx\n    return []\n",
            },
        )
        self.assertEqual(sub_b.status_code, 200)

        # Run plagiarism audit
        audit_resp = self.client.post(
            f"/api/v1/contests/{contest_id}/plagiarism/run",
            json={"problem_id": "two-sum", "threshold": 0.70},
        )
        self.assertEqual(audit_resp.status_code, 200)
        audit_data = audit_resp.json()
        self.assertEqual(audit_data["contest_id"], contest_id)
        self.assertEqual(audit_data["total_analyzed"], 2)
        self.assertGreaterEqual(len(audit_data["flagged_pairs"]), 1)
        self.assertEqual(audit_data["flagged_pairs"][0]["user_a"], "user-alice")
        self.assertEqual(audit_data["flagged_pairs"][0]["user_b"], "user-bob")

        # Retrieve cached matrix
        matrix_resp = self.client.get(f"/api/v1/contests/{contest_id}/plagiarism/matrix?problem_id=two-sum")
        self.assertEqual(matrix_resp.status_code, 200)
        matrix_data = matrix_resp.json()
        self.assertEqual(len(matrix_data["flagged_pairs"]), 1)


if __name__ == "__main__":
    unittest.main()
