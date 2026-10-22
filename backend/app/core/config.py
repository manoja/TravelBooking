from decimal import Decimal
from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

AppEnv = Literal["development", "test", "production"]
ASYMMETRIC_ALGORITHMS = {"RS256", "RS384", "RS512", "ES256", "ES384", "ES512", "PS256"}


def _split_csv(value):
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.startswith("["):
            return value
        return [item.strip() for item in stripped.split(",") if item.strip()]
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: AppEnv = "development"
    log_level: str = "INFO"

    # Supabase PostgreSQL, e.g. postgresql+psycopg://USER:PASSWORD@HOST:5432/postgres?sslmode=require
    database_url: str = ""
    db_pool_size: int = Field(5, ge=1, le=50)
    db_max_overflow: int = Field(5, ge=0, le=50)
    db_pool_timeout: int = Field(30, ge=1)
    db_pool_recycle: int = Field(1800, ge=30)
    # Set true when connecting through Supabase's transaction pooler (port 6543).
    db_pgbouncer: bool = False

    auth0_domain: str = ""
    auth0_audience: str = ""
    auth0_issuer: str = ""
    auth0_algorithms: Annotated[list[str], NoDecode] = ["RS256"]

    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:4200"]

    pending_hold_minutes: int = Field(15, ge=1, le=1440)
    max_stay_nights: int = Field(30, ge=1, le=365)
    tax_rate_percent: Decimal = Field(Decimal("0"), ge=0, le=100)
    flat_fee: Decimal = Field(Decimal("0"), ge=0)
    cancellation_cutoff_days: int = Field(1, ge=0, le=60)

    # Dummy payments are a development tool and are off in production unless forced on.
    enable_dummy_payments: bool | None = None

    _csv = field_validator("cors_origins", "auth0_algorithms", mode="before")(_split_csv)

    @property
    def issuer(self) -> str:
        return self.auth0_issuer or f"https://{self.auth0_domain}/"

    @property
    def dummy_payments_enabled(self) -> bool:
        if self.enable_dummy_payments is not None:
            return self.enable_dummy_payments
        return self.app_env != "production"

    def validate_for_runtime(self) -> None:
        if self.app_env == "test":
            return
        missing = [
            name
            for name, value in (
                ("DATABASE_URL", self.database_url),
                ("AUTH0_DOMAIN", self.auth0_domain),
                ("AUTH0_AUDIENCE", self.auth0_audience),
            )
            if not value
        ]
        if missing:
            raise RuntimeError(f"Missing required configuration: {', '.join(missing)}")
        if not set(self.auth0_algorithms) <= ASYMMETRIC_ALGORITHMS:
            raise RuntimeError("AUTH0_ALGORITHMS must contain only asymmetric algorithms")
        if self.app_env == "production" and "*" in self.cors_origins:
            raise RuntimeError("CORS_ORIGINS must not contain '*' in production")


@lru_cache
def get_settings() -> Settings:
    return Settings()
