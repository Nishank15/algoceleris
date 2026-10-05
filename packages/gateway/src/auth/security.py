from datetime import datetime, timedelta, timezone
import logging
import os
from typing import Any, Dict, Optional, Set, Tuple
import uuid

import argon2
from argon2 import PasswordHasher, Type, exceptions as argon2_exceptions
import jwt

logger = logging.getLogger("cloudjudge.auth.security")

# --- Configuration ---
JWT_SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY",
    "algo-celeris-super-secret-dev-key-change-in-prod-32bytes!",
)
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "14"))

# Argon2id password hasher with production parameters
_hasher = PasswordHasher(
    time_cost=2,
    memory_cost=65536,
    parallelism=1,
    hash_len=32,
    type=Type.ID,
)


class SecurityException(Exception):
    """Base security exception."""
    pass


class InvalidTokenException(SecurityException):
    """Raised when a JWT token is expired, corrupted, or missing."""
    pass


class ReplayAttackException(SecurityException):
    """Raised when an already-cycled refresh token is reused, indicating compromise."""
    pass


# --- Password Hashing ---

def hash_password(plain_password: str) -> str:
    """Hash plaintext password using Argon2id."""
    return _hasher.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plaintext password against Argon2id hash."""
    try:
        return _hasher.verify(hashed_password, plain_password)
    except (
        argon2_exceptions.VerifyMismatchError,
        argon2_exceptions.VerificationError,
        argon2_exceptions.InvalidHashError,
    ):
        return False


# --- JWT Token Generation ---

def create_access_token(
    user_id: str,
    username: str,
    email: str,
    account_type: str = "free",
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Generate a short-lived in-memory JWT Access Token (default 15 minutes)."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload: Dict[str, Any] = {
        "sub": str(user_id),
        "username": username,
        "email": email,
        "role": account_type,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(
    user_id: str,
    family_id: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> Tuple[str, str, str]:
    """Generate a long-lived rotating Refresh Token.

    Returns:
        (token_str, token_id, family_id)
    """
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    token_id = str(uuid.uuid4())
    fam_id = family_id or str(uuid.uuid4())

    payload: Dict[str, Any] = {
        "sub": str(user_id),
        "jti": token_id,
        "family": fam_id,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    token_str = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token_str, token_id, fam_id


def decode_token(token_str: str) -> Dict[str, Any]:
    """Decode and validate a JWT access or refresh token."""
    try:
        payload = jwt.decode(
            token_str,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise InvalidTokenException("Token has expired")
    except jwt.PyJWTError as e:
        raise InvalidTokenException(f"Invalid token signature or payload: {e}")


# --- In-Memory Fallback for Refresh Token Storage ---
_mem_refresh_tokens: Dict[str, Dict[str, Any]] = {}
_mem_token_families: Dict[str, Set[str]] = {}


def register_refresh_token(
    redis_client: Optional[Any],
    token_id: str,
    family_id: str,
    user_id: str,
    ttl_seconds: Optional[int] = None,
) -> None:
    """Store active refresh token in Redis and record in token family set."""
    ttl = ttl_seconds or (REFRESH_TOKEN_EXPIRE_DAYS * 86400)
    data = {"user_id": str(user_id), "family_id": family_id}

    if redis_client is not None:
        try:
            token_key = f"auth:refresh:{token_id}"
            family_key = f"auth:family:{family_id}"
            redis_client.hset(token_key, mapping=data)
            redis_client.expire(token_key, ttl)
            redis_client.sadd(family_key, token_id)
            redis_client.expire(family_key, ttl)
            return
        except Exception as e:
            logger.warning(
                f"Redis refresh token store failed ({e}), using in-memory store"
            )

    # In-memory fallback
    _mem_refresh_tokens[token_id] = data
    if family_id not in _mem_token_families:
        _mem_token_families[family_id] = set()
    _mem_token_families[family_id].add(token_id)


def consume_refresh_token(
    redis_client: Optional[Any],
    token_id: str,
) -> None:
    """Consume/deactivate a refresh token so it cannot be used again, preserving family membership."""
    if redis_client is not None:
        try:
            token_key = f"auth:refresh:{token_id}"
            redis_client.delete(token_key)
            return
        except Exception as e:
            logger.warning(f"Redis consume failed: {e}")

    _mem_refresh_tokens.pop(token_id, None)


def revoke_refresh_token(
    redis_client: Optional[Any],
    token_id: str,
    family_id: Optional[str] = None,
) -> None:
    """Revoke a single refresh token and remove from family."""
    consume_refresh_token(redis_client, token_id)
    if redis_client is not None and family_id:
        try:
            redis_client.srem(f"auth:family:{family_id}", token_id)
            return
        except Exception as e:
            logger.warning(f"Redis srem failed: {e}")

    if family_id and family_id in _mem_token_families:
        _mem_token_families[family_id].discard(token_id)


def revoke_family(
    redis_client: Optional[Any],
    family_id: str,
) -> None:
    """Revoke an entire token family due to suspected reuse / replay attack."""
    if redis_client is not None:
        try:
            family_key = f"auth:family:{family_id}"
            tokens = redis_client.smembers(family_key)
            for t in tokens:
                t_str = t.decode("utf-8") if isinstance(t, bytes) else str(t)
                redis_client.delete(f"auth:refresh:{t_str}")
            redis_client.delete(family_key)
            return
        except Exception as e:
            logger.warning(f"Redis revoke family failed: {e}")

    tokens = _mem_token_families.pop(family_id, set())
    for t in tokens:
        _mem_refresh_tokens.pop(t, None)


def validate_and_cycle_refresh_token(
    redis_client: Optional[Any],
    token_id: str,
    family_id: str,
    user_id: str,
) -> Tuple[str, str]:
    """Validate refresh token and cycle with token family replay protection.

    Returns:
        (new_refresh_token_str, new_token_id)
    """
    token_key = f"auth:refresh:{token_id}"
    family_key = f"auth:family:{family_id}"

    token_exists = False
    in_family = False

    if redis_client is not None:
        try:
            token_exists = bool(redis_client.exists(token_key))
            in_family = bool(redis_client.sismember(family_key, token_id))
        except Exception as e:
            logger.warning(f"Redis token check failed ({e}), using in-memory store")
            token_exists = token_id in _mem_refresh_tokens
            in_family = (
                family_id in _mem_token_families
                and token_id in _mem_token_families[family_id]
            )
    else:
        token_exists = token_id in _mem_refresh_tokens
        in_family = (
            family_id in _mem_token_families
            and token_id in _mem_token_families[family_id]
        )

    # Replay detection: If token is missing from active set but still recorded in the family set,
    # it means it was previously used and someone is replaying it!
    if not token_exists and in_family:
        logger.critical(
            f"REPLAY ATTACK DETECTED for user {user_id}, family {family_id}, token {token_id}! Revoking family."
        )
        revoke_family(redis_client, family_id)
        raise ReplayAttackException(
            "Refresh token reuse detected. Your session has been revoked for security."
        )

    if not token_exists:
        raise InvalidTokenException("Refresh token is invalid or expired")

    # Cycle token: Deactivate old token (keep in family for replay detection) and issue fresh one
    consume_refresh_token(redis_client, token_id)

    new_token_str, new_token_id, _ = create_refresh_token(
        user_id=user_id,
        family_id=family_id,
    )
    register_refresh_token(
        redis_client=redis_client,
        token_id=new_token_id,
        family_id=family_id,
        user_id=user_id,
    )

    return new_token_str, new_token_id
