from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    REDIS_URL: str = "redis://localhost:6379/0"

    MODEL_BUCKET: str = "ml-models"
    ACTIVE_MODEL_VERSION: str = "1.0.0"

    BACKEND_URL: str = "http://localhost:8000"
    # Comma-separated list of allowed origins
    CORS_ORIGINS: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "https://finsight-frontend.onrender.com,"
        "https://*.vercel.app"
    )

    # Feature flags / runtime
    DEMO_MODE_FALLBACK: bool = False
    REQUEST_TIMEOUT: int = 30

    # Local Auth & JWT
    JWT_SECRET: str = "finsight-super-secret-jwt-key-2026-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # LLM Settings (Anthropic)
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings():
    return Settings()
