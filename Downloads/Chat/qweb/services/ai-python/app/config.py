from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', case_sensitive=False)

    app_name: str = 'qweb-ai-service'
    database_url: str = 'sqlite:///./hybrid_chat.db'
    redis_url: str = 'redis://localhost:6379'
    internal_api_key: str = 'change-me-internal-api-key'
    default_stun_url: str = 'stun:stun.l.google.com:19302'
    turn_urls: str | None = None
    turn_username: str | None = None
    turn_credential: str | None = None


settings = Settings()
