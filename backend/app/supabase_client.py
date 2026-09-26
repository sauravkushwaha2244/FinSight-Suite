import logging
from functools import lru_cache
from app.config import get_settings

logger = logging.getLogger(__name__)

_client = None
_service_client = None

def get_client():
    global _client
    if _client is not None:
        return _client
    settings = get_settings()
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        logger.warning("Supabase credentials not configured. Running in demo mode.")
        return None
    from supabase import create_client
    _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    return _client

def get_service_client():
    global _service_client
    if _service_client is not None:
        return _service_client
    settings = get_settings()
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        logger.warning("Supabase service credentials not configured. Running in demo mode.")
        return None
    from supabase import create_client
    _service_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _service_client
