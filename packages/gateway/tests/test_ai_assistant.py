import unittest
from fastapi.testclient import TestClient

from packages.gateway.src.ai.assistant import GeminiDebugAssistant, generate_code_diff
from packages.gateway.src.ai.models import AIDebugRequest, AIDebugResponse
from packages.gateway.src.api import create_app
from packages.gateway.src.queue import InMemoryQueueBroker
from packages.gateway.src.ratelimit.bucket import InMemoryTokenBucketStorage, TokenBucketLimiter
from packages.gateway.src.subscriptions.models import PaymentProvider, SubscriptionRecord, SubscriptionTier
from packages.gateway.src.subscriptions.store import InMemorySubscriptionStore


class TestGeminiDebugAssistantDirect(unittest.TestCase):
    def setUp(self):
        self.assistant = GeminiDebugAssistant()

    def test_generate_code_diff_format(self):
        orig = "def solve():\n    return 0\n"
        fixed = "def solve():\n    return 42\n"
        diff = generate_code_diff(orig, fixed, "python")
        self.assertIn("--- a/solution.py", diff)
        self.assertIn("+++ b/solution.py", diff)
        self.assertIn("-    return 0", diff)
        self.assertIn("+    return 42", diff)

    def test_debug_compilation_error_fallback(self):
        req = AIDebugRequest(
            user_id="user-1",
            language="cpp",
            source_code="int main() { cout << 1 }",
            problem_title="Two Sum",
            problem_description="Find two numbers that add up to target.",
            failing_test_cases=[],
            error_diagnostics="error: expected ';' before '}' token",
        )
        res = self.assistant.debug_code(req)
        self.assertIsInstance(res, AIDebugResponse)
        self.assertIn("Compilation error", res.root_cause)
        self.assertTrue(len(res.fixed_code) > 0)
        self.assertTrue(len(res.code_diff) > 0)
        self.assertIn("---", res.code_diff)

    def test_debug_algorithmic_logic_flaw_fallback(self):
        req = AIDebugRequest(
            user_id="user-2",
            language="python",
            source_code="def two_sum(nums, target):\n    return []",
            problem_title="Two Sum",
            problem_description="Find two numbers that add up to target.",
            failing_test_cases=[
                {"input": "[2, 7, 11, 15], 9", "expected": "[0, 1]", "actual": "[]"}
            ],
            error_diagnostics=None,
        )
        res = self.assistant.debug_code(req)
        self.assertIsInstance(res, AIDebugResponse)
        self.assertIn("Algorithmic logic flaw", res.root_cause)
        self.assertIn("Time Complexity", res.complexity_analysis)
        self.assertIn("def two_sum", res.fixed_code)
        self.assertIn("---", res.code_diff)


class TestAIAssistantEndpoint(unittest.TestCase):
    def setUp(self):
        self.broker = InMemoryQueueBroker()
        self.sub_store = InMemorySubscriptionStore()
        self.limiter = TokenBucketLimiter(InMemoryTokenBucketStorage())
        self.assistant = GeminiDebugAssistant()
        self.app = create_app(
            broker=self.broker,
            subscription_store=self.sub_store,
            rate_limiter=self.limiter,
            ai_assistant=self.assistant,
        )
        self.client = TestClient(self.app)

        # Set up a pro user
        self.pro_user = "user-pro-99"
        self.sub_store.set_subscription(
            self.pro_user,
            SubscriptionRecord(
                user_id=self.pro_user,
                tier=SubscriptionTier.PRO,
                provider=PaymentProvider.STRIPE,
                subscription_id="sub_pro_ai_test",
                status="active",
            ),
        )

        self.payload = {
            "user_id": "user-free-1",
            "language": "python",
            "source_code": "def solve(): pass",
            "problem_title": "Two Sum",
            "problem_description": "Find indices of two numbers that add to target",
            "failing_test_cases": [{"id": 1, "input": "2 7", "expected": "0 1", "actual": "None"}],
            "error_diagnostics": None,
        }

    def test_free_tier_user_blocked_with_403(self):
        resp = self.client.post("/api/v1/ai/debug", json=self.payload)
        self.assertEqual(resp.status_code, 403)
        data = resp.json()
        self.assertIn("detail", data)
        self.assertEqual(data["detail"]["error"], "pro_tier_required")
        self.assertEqual(data["detail"]["upgrade_url"], "/pricing")
        self.assertEqual(data["detail"]["current_tier"], "free")

    def test_pro_tier_user_receives_ai_diagnosis(self):
        pro_payload = {**self.payload, "user_id": self.pro_user}
        resp = self.client.post(
            "/api/v1/ai/debug",
            headers={"X-User-ID": self.pro_user},
            json=pro_payload,
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("root_cause", data)
        self.assertIn("complexity_analysis", data)
        self.assertIn("fix_explanation", data)
        self.assertIn("fixed_code", data)
        self.assertIn("code_diff", data)
        self.assertTrue(data["code_diff"].startswith("---"))

    def test_ai_debug_rate_limiting_enforced(self):
        pro_payload = {**self.payload, "user_id": self.pro_user}
        # Pro tier capacity for ai_debug is 10/min
        for i in range(10):
            res = self.client.post(
                "/api/v1/ai/debug",
                headers={"X-User-ID": self.pro_user},
                json=pro_payload,
            )
            self.assertEqual(res.status_code, 200, f"Call {i+1} failed")

        # 11th call should return 429
        throttled = self.client.post(
            "/api/v1/ai/debug",
            headers={"X-User-ID": self.pro_user},
            json=pro_payload,
        )
        self.assertEqual(throttled.status_code, 429)
        self.assertIn("Retry-After", throttled.headers)


if __name__ == "__main__":
    unittest.main()
