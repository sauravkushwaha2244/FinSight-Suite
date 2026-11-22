import logging
from fastapi import Depends, HTTPException, Request, status

logger = logging.getLogger(__name__)


DEFAULT_DEMO_USER = {
    "user_id": "usr-admin-1",
    "email": "admin@finsight.com",
    "full_name": "FinSight Administrator",
    "org_id": "org-abc-tech",
    "role": "admin",
}


def get_current_user(request: Request) -> dict:
    """Return the shared demo administrator; authentication is disabled."""
    return DEFAULT_DEMO_USER.copy()


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required for this action.",
        )
    return user
