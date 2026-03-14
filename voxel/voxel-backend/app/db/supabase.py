from supabase import create_client, Client
from functools import lru_cache
from app.config import get_settings

settings = get_settings()


@lru_cache
def get_supabase() -> Client:
    """Return a cached Supabase service-role client."""
    return create_client(
        settings.supabase_url,
        settings.supabase_service_key,
    )
