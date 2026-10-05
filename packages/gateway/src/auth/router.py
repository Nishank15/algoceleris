import logging
from typing import Any, Optional
import uuid

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Header,
    Request,
    Response,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.entities import User
from .bloom import BloomUniquenessChecker
from .models import (
    AvailabilityResponse,
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from .security import (
    InvalidTokenException,
    ReplayAttackException,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    register_refresh_token,
    revoke_refresh_token,
    validate_and_cycle_refresh_token,
    verify_password,
)

logger = logging.getLogger("cloudjudge.auth.router")


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Set secure HttpOnly cookie for rotating refresh token."""
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=False,  # localhost friendly; Set to True in production HTTPS
        path="/api/v1/auth",
        max_age=14 * 86400,
    )


def _clear_refresh_cookie(response: Response) -> None:
    """Clear HttpOnly refresh token cookie on logout or revocation."""
    response.delete_cookie(
        key="refresh_token",
        path="/api/v1/auth",
    )


def create_auth_router(
    bloom_checker: Optional[BloomUniquenessChecker] = None,
    redis_client: Optional[Any] = None,
) -> APIRouter:
    """Instantiate and configure FastAPI authentication router."""
    router = APIRouter(prefix="/auth", tags=["authentication"])

    active_bloom = bloom_checker or BloomUniquenessChecker(
        redis_client=redis_client
    )
    active_redis = redis_client

    @router.get(
        "/check-availability",
        response_model=AvailabilityResponse,
        summary="Check username or email availability using RedisBloom and DB fallback",
    )
    async def check_availability(
        username: Optional[str] = None,
        email: Optional[str] = None,
        db: AsyncSession = Depends(get_db),
    ) -> AvailabilityResponse:
        if username:
            clean_u = username.strip()
            is_avail = await active_bloom.is_username_available(
                clean_u, db_session=db
            )
            return AvailabilityResponse(
                available=is_avail,
                field="username",
                value=clean_u,
                message="Username is available"
                if is_avail
                else "Username is already taken",
            )
        elif email:
            clean_e = email.strip().lower()
            is_avail = await active_bloom.is_email_available(
                clean_e, db_session=db
            )
            return AvailabilityResponse(
                available=is_avail,
                field="email",
                value=clean_e,
                message="Email is available"
                if is_avail
                else "Email is already registered",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either 'username' or 'email' query parameter",
        )

    @router.post(
        "/signup",
        response_model=TokenResponse,
        status_code=status.HTTP_201_CREATED,
        summary="Register a new user account with uniqueness check and dual-token issuance",
    )
    async def signup(
        req: SignupRequest,
        response: Response,
        db: AsyncSession = Depends(get_db),
    ) -> TokenResponse:
        clean_username = req.username.strip()
        clean_email = req.email.strip().lower()

        # 1. Dual-layer availability pre-check
        u_avail = await active_bloom.is_username_available(
            clean_username, db_session=db
        )
        if not u_avail:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username is already taken",
            )

        e_avail = await active_bloom.is_email_available(
            clean_email, db_session=db
        )
        if not e_avail:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email is already registered",
            )

        # 2. Hash password with Argon2id
        pw_hash = hash_password(req.password)

        # 3. Create User in PostgreSQL
        new_user = User(
            id=uuid.uuid4(),
            username=clean_username,
            email=clean_email,
            password_hash=pw_hash,
            account_type="free",
            college_name=req.college_name,
        )
        db.add(new_user)
        try:
            await db.commit()
            await db.refresh(new_user)
        except Exception as exc:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Registration failed: {exc}",
            )

        # 4. Record in Bloom filter
        await active_bloom.add_user(clean_username, clean_email)

        # 5. Dual-token issuance
        user_id_str = str(new_user.id)
        access_token = create_access_token(
            user_id=user_id_str,
            username=new_user.username,
            email=new_user.email,
            account_type=new_user.account_type,
        )
        refresh_str, token_id, family_id = create_refresh_token(
            user_id=user_id_str
        )
        register_refresh_token(
            redis_client=active_redis,
            token_id=token_id,
            family_id=family_id,
            user_id=user_id_str,
        )

        _set_refresh_cookie(response, refresh_str)

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=900,
            user=UserResponse.model_validate(new_user),
        )

    @router.post(
        "/login",
        response_model=TokenResponse,
        summary="Authenticate credentials and issue dual tokens",
    )
    async def login(
        req: LoginRequest,
        response: Response,
        db: AsyncSession = Depends(get_db),
    ) -> TokenResponse:
        ident = req.get_identifier().lower()

        stmt = select(User).where(
            (func.lower(User.username) == ident)
            | (func.lower(User.email) == ident)
        ).limit(1)
        res = await db.execute(stmt)
        user = res.scalars().first()

        if not user or not verify_password(req.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username/email or password",
            )

        user_id_str = str(user.id)
        access_token = create_access_token(
            user_id=user_id_str,
            username=user.username,
            email=user.email,
            account_type=user.account_type,
        )
        refresh_str, token_id, family_id = create_refresh_token(
            user_id=user_id_str
        )
        register_refresh_token(
            redis_client=active_redis,
            token_id=token_id,
            family_id=family_id,
            user_id=user_id_str,
        )

        _set_refresh_cookie(response, refresh_str)

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=900,
            user=UserResponse.model_validate(user),
        )

    @router.post(
        "/refresh",
        response_model=TokenResponse,
        summary="Rotate refresh token and issue new 15-minute access token",
    )
    async def refresh_session(
        request: Request,
        response: Response,
        x_refresh_token: Optional[str] = Header(None),
        db: AsyncSession = Depends(get_db),
    ) -> TokenResponse:
        raw_refresh = request.cookies.get("refresh_token") or x_refresh_token
        if not raw_refresh:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token required",
            )

        try:
            payload = decode_token(raw_refresh)
            if payload.get("type") != "refresh":
                raise InvalidTokenException("Not a refresh token")
            user_id_str = payload["sub"]
            token_id = payload["jti"]
            family_id = payload["family"]
        except Exception as e:
            _clear_refresh_cookie(response)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid refresh token: {e}",
            )

        try:
            new_refresh_str, new_token_id = validate_and_cycle_refresh_token(
                redis_client=active_redis,
                token_id=token_id,
                family_id=family_id,
                user_id=user_id_str,
            )
        except ReplayAttackException as e:
            _clear_refresh_cookie(response)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
            )
        except Exception as e:
            _clear_refresh_cookie(response)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token rotation failed: {e}",
            )

        # Verify user exists in PostgreSQL
        try:
            u_uuid = uuid.UUID(user_id_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user ID format in token",
            )

        stmt = select(User).where(User.id == u_uuid).limit(1)
        res = await db.execute(stmt)
        user = res.scalars().first()
        if not user:
            _clear_refresh_cookie(response)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found",
            )

        access_token = create_access_token(
            user_id=user_id_str,
            username=user.username,
            email=user.email,
            account_type=user.account_type,
        )

        _set_refresh_cookie(response, new_refresh_str)

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=900,
            user=UserResponse.model_validate(user),
        )

    @router.post(
        "/logout",
        summary="Revoke current session and clear HttpOnly cookie",
    )
    async def logout(
        request: Request,
        response: Response,
        x_refresh_token: Optional[str] = Header(None),
    ) -> dict:
        raw_refresh = request.cookies.get("refresh_token") or x_refresh_token
        if raw_refresh:
            try:
                payload = decode_token(raw_refresh)
                token_id = payload.get("jti")
                family_id = payload.get("family")
                if token_id:
                    revoke_refresh_token(
                        active_redis, token_id, family_id=family_id
                    )
            except Exception:
                pass

        _clear_refresh_cookie(response)
        return {"message": "Logged out successfully"}

    @router.get(
        "/me",
        response_model=UserResponse,
        summary="Get currently authenticated user from Bearer access token",
    )
    async def get_current_user_profile(
        authorization: Optional[str] = Header(None),
        db: AsyncSession = Depends(get_db),
    ) -> UserResponse:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Bearer authentication token required",
            )

        token_str = authorization[7:].strip()
        try:
            payload = decode_token(token_str)
            if payload.get("type") != "access":
                raise InvalidTokenException("Not an access token")
            user_id_str = payload["sub"]
            u_uuid = uuid.UUID(user_id_str)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid access token: {e}",
            )

        stmt = select(User).where(User.id == u_uuid).limit(1)
        res = await db.execute(stmt)
        user = res.scalars().first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        return UserResponse.model_validate(user)

    return router
