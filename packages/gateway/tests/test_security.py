from datetime import timedelta
import unittest

from packages.gateway.src.auth.security import (
    InvalidTokenException,
    ReplayAttackException,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    register_refresh_token,
    validate_and_cycle_refresh_token,
    verify_password,
)


class TestArgon2idHashing(unittest.TestCase):
    def test_hash_and_verify_valid_password(self):
        password = "SuperSecurePassword123!"
        hashed = hash_password(password)
        self.assertNotEqual(password, hashed)
        self.assertTrue(hashed.startswith("$argon2id$"))
        self.assertTrue(verify_password(password, hashed))

    def test_verify_invalid_password(self):
        password = "CorrectHorseBatteryStaple"
        hashed = hash_password(password)
        self.assertFalse(verify_password("WrongPassword", hashed))

    def test_verify_malformed_hash(self):
        self.assertFalse(verify_password("password", "not-a-valid-argon2-hash"))


class TestJWTTokens(unittest.TestCase):
    def test_access_token_creation_and_decoding(self):
        token = create_access_token(
            user_id="user-1234",
            username="alice",
            email="alice@cloudjudge.dev",
            account_type="pro",
        )
        self.assertIsInstance(token, str)

        payload = decode_token(token)
        self.assertEqual(payload["sub"], "user-1234")
        self.assertEqual(payload["username"], "alice")
        self.assertEqual(payload["email"], "alice@cloudjudge.dev")
        self.assertEqual(payload["role"], "pro")
        self.assertEqual(payload["type"], "access")
        self.assertIn("exp", payload)

    def test_expired_token(self):
        token = create_access_token(
            user_id="user-1234",
            username="alice",
            email="alice@cloudjudge.dev",
            expires_delta=timedelta(seconds=-10),  # expired
        )
        with self.assertRaises(InvalidTokenException):
            decode_token(token)

    def test_tampered_token(self):
        token = create_access_token(
            user_id="user-1234",
            username="alice",
            email="alice@cloudjudge.dev",
        )
        tampered = token[:-5] + "XXXXX"
        with self.assertRaises(InvalidTokenException):
            decode_token(tampered)


class TestRefreshTokenLifecycle(unittest.TestCase):
    def test_refresh_token_generation(self):
        token_str, token_id, family_id = create_refresh_token(user_id="usr-999")
        self.assertIsInstance(token_str, str)
        self.assertIsInstance(token_id, str)
        self.assertIsInstance(family_id, str)

        payload = decode_token(token_str)
        self.assertEqual(payload["sub"], "usr-999")
        self.assertEqual(payload["jti"], token_id)
        self.assertEqual(payload["family"], family_id)
        self.assertEqual(payload["type"], "refresh")

    def test_token_cycling_and_replay_protection(self):
        user_id = "usr-audit-42"
        # 1. Register initial refresh token
        token1_str, token1_id, family_id = create_refresh_token(user_id=user_id)
        register_refresh_token(
            redis_client=None,
            token_id=token1_id,
            family_id=family_id,
            user_id=user_id,
        )

        # 2. Cycle token 1 -> token 2
        token2_str, token2_id = validate_and_cycle_refresh_token(
            redis_client=None,
            token_id=token1_id,
            family_id=family_id,
            user_id=user_id,
        )
        self.assertNotEqual(token1_id, token2_id)
        self.assertNotEqual(token1_str, token2_str)

        # 3. Cycle token 2 -> token 3
        token3_str, token3_id = validate_and_cycle_refresh_token(
            redis_client=None,
            token_id=token2_id,
            family_id=family_id,
            user_id=user_id,
        )
        self.assertNotEqual(token2_id, token3_id)

        # 4. REPLAY ATTACK: Attacker presents already-consumed token 1!
        with self.assertRaises(ReplayAttackException):
            validate_and_cycle_refresh_token(
                redis_client=None,
                token_id=token1_id,
                family_id=family_id,
                user_id=user_id,
            )

        # 5. Token family was revoked! Even legitimate token 3 is now revoked!
        with self.assertRaises(InvalidTokenException):
            validate_and_cycle_refresh_token(
                redis_client=None,
                token_id=token3_id,
                family_id=family_id,
                user_id=user_id,
            )


if __name__ == "__main__":
    unittest.main()
