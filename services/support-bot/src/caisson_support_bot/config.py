"""Runtime configuration (ADR-0105).

All secrets come from the environment only — never hardcoded, never logged (the gridwork security
floor). ``Settings`` fails closed: the required secrets have no defaults, so constructing it without
them raises, and the entrypoint refuses to start. Optional surfaces (the listener channel, the human
role, the Postgres DSN) degrade gracefully when unset.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class SelfAssignRole(BaseModel):
    """One self-assignable role surfaced as a button by ``/post-roles`` (ADR-0109)."""

    role_id: int
    label: str = Field(min_length=1, max_length=80)


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

    # --- optional member-management surfaces (ADR-0109; all degrade gracefully when unset) ---
    member_role_id: int | None = Field(
        default=None,
        description="Default role auto-assigned on join. Setting this ENABLES the privileged `members` "
        "intent — enable 'Server Members Intent' in the Developer Portal FIRST, or the gateway refuses "
        "to connect.",
    )
    welcome_channel_id: int | None = Field(
        default=None, description="Channel for the on-join welcome message; skipped when unset."
    )
    customer_role_id: int | None = Field(
        default=None,
        description="Umbrella role granted alongside any edition role by /grant-role.",
    )
    role_compliance_id: int | None = Field(default=None, description="Compliance edition role id.")
    role_ai_kit_id: int | None = Field(
        default=None, description="AI Production Kit edition role id."
    )
    role_local_first_id: int | None = Field(
        default=None, description="Local-first AI edition role id."
    )
    role_agentic_id: int | None = Field(default=None, description="Agentic-Dev edition role id.")
    self_assign_roles: list[SelfAssignRole] = Field(
        default_factory=list,
        description="Self-assignable roles for /post-roles buttons; JSON list of {role_id,label}.",
    )

    # --- optional billing-grant inbound (ADR-0203; closes the ADR-0109 deferral) ---
    billing_grant_token: str | None = Field(
        default=None,
        description="Bearer expected on POST /billing-grant (pushed by services/license after a "
        "purchase grant and by apps/site after a Discord link). The route is NOT served when unset "
        "(fail-closed) — the bot runs unaffected.",
    )
    guild_id: int | None = Field(
        default=None,
        description="The Caisson guild billing grants apply to (same GUILD_ID the provisioner "
        "uses). Unset falls back to the bot's sole guild; with several guilds and no id the grant "
        "refuses rather than guessing a server.",
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
