"""Runtime configuration (ADR-0105).

All secrets come from the environment only — never hardcoded, never logged (the gridwork security
floor). ``Settings`` fails closed: the required secrets have no defaults, so constructing it without
them raises, and the entrypoint refuses to start. Optional surfaces (the listener channel, the human
role, the Postgres DSN) degrade gracefully when unset.
"""

from __future__ import annotations

from pydantic import Field, HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-bound configuration. Required fields raise at construction if unset."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", frozen=True)

    # --- required secrets (fail-closed) ---
    discord_token: str = Field(min_length=1, description="Discord bot token.")
    openrouter_api_key: str = Field(min_length=1, description="OpenRouter generation key.")
    docs_service_url: HttpUrl = Field(
        description="services/docs base URL (POST /query lives here)."
    )
    docs_service_token: str = Field(
        min_length=1, description="Bearer for services/docs POST /query."
    )

    # --- generation knobs ---
    openrouter_model: str = Field(
        default="anthropic/claude-3.5-sonnet",
        description="OpenRouter model slug; swappable without code change (ADR-0105 provider-agnostic).",
    )
    openrouter_referer: str = Field(
        default="https://caisson.sh",
        description="OpenRouter HTTP-Referer attribution header.",
    )
    request_timeout_s: float = Field(default=20.0, gt=0, le=120)
    retrieval_k: int = Field(default=6, ge=1, le=20)
    max_question_chars: int = Field(default=2000, ge=1, le=2000)

    # --- optional Discord surfaces ---
    support_channel_id: int | None = Field(
        default=None, description="The #ask-ai channel id; the listener is disabled when unset."
    )
    support_human_role_id: int | None = Field(
        default=None,
        description="Role id tagged on escalation; a plain mention is skipped when unset.",
    )

    # --- optional persistence ---
    database_url: str | None = Field(
        default=None,
        description="Postgres DSN for support_ticket persistence; escalation is thread-only when unset.",
    )

    # --- liveness ---
    health_port: int = Field(default=8080, ge=1, le=65535)

    @field_validator("docs_service_url")
    @classmethod
    def _https_only(cls, v: HttpUrl) -> HttpUrl:
        # The docs URL is an egress sink; reject non-https per the security floor (no plaintext token).
        # Loopback http is allowed for local dev only.
        if v.scheme != "https" and v.host not in ("127.0.0.1", "localhost"):
            raise ValueError("docs_service_url must be https (or loopback for local dev)")
        return v

    @property
    def docs_query_url(self) -> str:
        return str(self.docs_service_url).rstrip("/") + "/query"
