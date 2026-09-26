import logging
from fastapi import Depends, HTTPException, Request, status
import jwt
from jwt.exceptions import PyJWTError

from app.supabase_client import get_client
from app.config import get_settings
from app.db import get_user_by_id

logger = logging.getLogger(__name__)


DEFAULT_DEMO_USER = {
    "user_id": "usr-admin-1",
    "email": "admin@finsight.com",
    "full_name": "FinSight Administrator",
    "org_id": "org-abc-tech",
    "role": "admin",
}


def get_current_user(request: Request) -> dict:
    """
    Validates JWT token from Authorization: Bearer <token>.
    Supports both local backend-issued JWT tokens and Supabase JWT tokens.
    Defaults to demo organization (ABC Technologies) if unauthenticated.
    """
    settings = get_settings()
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        return DEFAULT_DEMO_USER.copy()

    parts = auth_header.split(" ", 1)
    token = parts[1].strip() if len(parts) > 1 else ""

    if not token or token == "null" or token == "undefined":
        return DEFAULT_DEMO_USER.copy()

    # 1. Try decoding as local Backend JWT
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = payload.get("sub")
        email = payload.get("email")
        role = payload.get("role", "admin")
        org_id = payload.get("org_id", "org-default")
        full_name = payload.get("full_name", "")

        if user_id:
            # Optionally enrich from DB if user exists
            db_user = get_user_by_id(user_id)
            if db_user:
                return {
                    "user_id": db_user["id"],
                    "email": db_user["email"],
                    "full_name": db_user["full_name"],
                    "org_id": db_user["org_id"],
                    "role": db_user["role"],
                }

            return {
                "user_id": user_id,
                "email": email,
                "full_name": full_name,
                "org_id": org_id,
                "role": role,
            }
    except PyJWTError as jwt_err:
        logger.debug(f"Local JWT decode failed, attempting external validation: {jwt_err}")

    # 2. Try Supabase Auth client if configured
    supabase = get_client()
    if supabase:
        try:
            user_response = supabase.auth.get_user(token)
            if user_response and user_response.user:
                user = user_response.user
                meta = user.user_metadata or {}
                return {
                    "user_id": user.id,
                    "email": user.email,
                    "full_name": meta.get("full_name", user.email),
                    "org_id": meta.get("org_id") or "org-default",
                    "role": meta.get("role", "admin"),
                }
        except Exception as e:
            logger.warning(f"Supabase auth validation failed: {e}")

    # If token cannot be decoded or is expired, fall back to demo user gracefully
    logger.info("Unrecognized or expired token provided; falling back to demo organization.")
    return DEFAULT_DEMO_USER.copy()


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required for this action.",
        )
    return user
