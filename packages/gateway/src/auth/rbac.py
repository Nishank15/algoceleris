import logging
from typing import Optional
import uuid

from fastapi import Depends, HTTPException, Header, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.entities import User
from .security import InvalidTokenException, decode_token

logger = logging.getLogger("cloudjudge.auth.rbac")


async def get_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency extracting and validating Bearer access JWT, loading User from PostgreSQL."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1]
    try:
        payload = decode_token(token)
    except InvalidTokenException as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token decode failure",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_type = payload.get("type")
    if token_type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type: Access token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: missing subject claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_uuid = uuid.UUID(str(user_id_str))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format in token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    stmt = select(User).where(User.id == user_uuid).limit(1)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_optional_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """FastAPI dependency returning authenticated User or None if unauthenticated."""
    if not authorization:
        return None

    try:
        return await get_current_user(authorization=authorization, db=db)
    except HTTPException:
        return None


async def require_pro(
    current_user: User = Depends(get_current_user),
) -> User:
    """Route guard requiring Pro or Admin account type.
    
    Rejects Free tier accounts with HTTP 403 Forbidden.
    """
    account_type = current_user.account_type.lower()
    if account_type in {"pro", "admin"}:
        return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "error": "pro_tier_required",
            "message": "Pro subscription required to access this feature",
            "upgrade_url": "/pricing",
            "current_tier": current_user.account_type,
        },
    )


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Route guard requiring Admin account type.
    
    Rejects Free and Pro tier accounts with HTTP 403 Forbidden.
    """
    if current_user.account_type.lower() == "admin":
        return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "error": "admin_privileges_required",
            "message": "Administrative privileges required to access this endpoint",
        },
    )
