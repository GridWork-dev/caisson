"""Runtime configuration.

All secrets come from the environment only — never hardcoded, never logged, per this
repo's security floor. ``Settings`` fails closed: the required secrets have no defaults, so constructing it without
them raises, and the entrypoint refuses to start. Optional surfaces (the listener channel, the human
role, the Postgres DSN) degrade gracefully when unset.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator
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
        default="anthropic/claude-sonnet-4.6",
        description="OpenRouter model slug; swappable without code change (ADR-0105 provider-agnostic). "
        "Default is the ADR-0234 premium lane (bumped from the stale anthropic/claude-3.5-sonnet).",
    )
    openrouter_referer: str = Field(
        default="https://caisson.sh",
        description="OpenRouter HTTP-Referer attribution header.",
    )
    request_timeout_s: float = Field(default=20.0, gt=0, le=120)
    retrieval_k: int = Field(default=6, ge=1, le=20)
    max_question_chars: int = Field(default=2000, ge=1, le=2000)

    # --- 3-tier confidence gate (2026-07-10 picker) ---
    support_confidence_high: float = Field(
        default=0.85,
        ge=0.0,
        le=1.0,
        description="Self-assessed confidence (0-1, from the model's own trailing `CONFIDENCE:` "
        "line — rag.py) at or above which a resolved answer is returned plain (HIGH tier).",
    )
    support_confidence_low: float = Field(
        default=0.55,
        ge=0.0,
        le=1.0,
        description="Self-assessed confidence at or above which a resolved answer is returned "
        "hedged with an escalation hint (MEDIUM tier) instead of plain; below this — or a "
        "missing/unparseable signal — it escalates instead of answering (LOW tier, fail-closed). "
        "Conservative defaults ship until real traffic lets the operator tune these without a code "
        "change (the whole reason the gate was parked until now).",
    )

    # --- optional Discord surfaces ---
    support_channel_id: int | None = Field(
        default=None, description="The #ask-ai channel id; the listener is disabled when unset."
    )
    support_human_role_id: int | None = Field(
        default=None,
        description="Role id tagged on escalation; a plain mention is skipped when unset.",
    )

    # --- escalation ChatPlatform selection (ADR-0287) ---
    chat_platform: Literal["discord", "slack"] = Field(
        default="discord",
        description="Which ChatPlatform drives Escalator's human-notify thread. The bot's own "
        "surface (/ask, #ask-ai) stays Discord regardless — this only selects where the escalation "
        "brief posts. 'slack' requires slack_bot_token and slack_escalation_channel_id.",
    )
    slack_bot_token: str | None = Field(
        default=None,
        description="Slack bot token (chat:write scope). Required when chat_platform='slack'.",
    )
    slack_escalation_channel_id: str | None = Field(
        default=None,
        description="The Slack channel id (e.g. 'C0123456789') escalations post to. Required when "
        "chat_platform='slack'.",
    )
    slack_escalation_mention: str | None = Field(
        default=None,
        description="Mention string prepended to a Slack escalation post, in SLACK's own syntax — "
        "a user-group (`<!subteam^ID>`) or a user (`<@U…>`). NOT Discord's `<@&roleId>` role-mention "
        "syntax, which renders as dead text in Slack and pings nobody. Unset skips the ping and "
        "posts to the channel only, matching support_human_role_id's own unset behavior.",
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
    role_priority_support_id: int | None = Field(
        default=None,
        description="Priority-support subscription role id (ADR-0278 Track K, price-agnostic "
        "plumbing). Deliberately NOT in the edition role map — a bundle purchase must never grant "
        "it. Grant/revoke it with the existing /role-add and /role-remove commands; escalation "
        "priority routing reads it fail-closed (unset, or the member lacks the role, → normal "
        "lane). Wiring a live billing signal is deferred until the operator sets a price.",
    )
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

    # --- optional site escalation inbound (parity with the Discord bot's own escalation sink) ---
    site_escalate_token: str | None = Field(
        default=None,
        description="Bearer expected on POST /escalate (pushed by apps/site when its Ask-AI widget "
        "cannot answer a question). Files the same Linear Triage issue + support_ticket row the "
        "Discord bot's own escalations do. The route is NOT served when unset (fail-closed) — the "
        "bot runs unaffected. Must match SUPPORT_BOT_ESCALATE_TOKEN on caisson-site.",
    )

    # --- optional persistence ---
    database_url: str | None = Field(
        default=None,
        description="Postgres DSN for support_ticket persistence; escalation is thread-only when unset.",
    )

    # --- optional per-answer product telemetry (2026-07-10; analytics.py) ---
    posthog_capture_key: str | None = Field(
        default=None,
        description="PostHog project capture key (phc_…); per-answer telemetry never runs when "
        "unset. Same env convention as services/license's server-side purchase capture.",
    )
    posthog_capture_host: str = Field(
        default="https://us.i.posthog.com",
        description="PostHog ingestion host, no trailing slash needed.",
    )

    # --- optional Linear triage sink (ADR-0206; all three must be set together or the sink stays off) ---
    linear_api_key: str | None = Field(
        default=None,
        description="Linear personal API key; the Linear escalation sink never runs when unset.",
    )
    linear_team_id: str | None = Field(
        default=None, description="The Linear team id issueCreate files the Triage issue under."
    )
    linear_triage_state_id: str | None = Field(
        default=None, description="Explicit Triage workflow state id passed on every issueCreate."
    )

    # --- liveness ---
    health_port: int = Field(default=8080, ge=1, le=65535)
    shutdown_grace_s: float = Field(
        default=20.0,
        gt=0,
        le=60,
        description="Maximum seconds for each bounded Gateway/work/resource shutdown stage.",
    )

    # --- external dead-man heartbeat (T25; T41 owns the GCP alert policy) ---
    heartbeat_enabled: bool = Field(
        default=False,
        description="Emit the Google custom heartbeat metric while Discord is ready.",
    )
    heartbeat_interval_s: float = Field(default=60.0, ge=10, le=300)
    google_cloud_project: str | None = Field(
        default=None,
        min_length=6,
        max_length=30,
        pattern=r"^[a-z][a-z0-9-]{4,28}[a-z0-9]$",
        description="Metric destination project; required only when heartbeat_enabled is true.",
    )

    @field_validator("docs_service_url")
    @classmethod
    def _https_only(cls, v: HttpUrl) -> HttpUrl:
        # The docs URL is an egress sink; reject non-https per the security floor (no plaintext token).
        # Loopback http is allowed for local dev only.
        if v.scheme != "https" and v.host not in ("127.0.0.1", "localhost"):
            raise ValueError("docs_service_url must be https (or loopback for local dev)")
        return v

    @model_validator(mode="after")
    def _confidence_thresholds_ordered(self) -> Settings:
        # Fail-closed sanity: an inverted pair would make MEDIUM unreachable (or worse, make LOW's
        # floor sit above HIGH's ceiling) — refuse to start with a nonsensical gate.
        if self.support_confidence_low > self.support_confidence_high:
            raise ValueError("support_confidence_low must be <= support_confidence_high")
        return self

    @model_validator(mode="after")
    def _chat_platform_slack_requires_its_settings(self) -> Settings:
        # Fail closed at construction (matching every other config-gated surface here): choosing
        # chat_platform='slack' without its two settings would silently build a Slack driver that
        # can never post, dropping every escalation notify. Refuse to start instead.
        if self.chat_platform == "slack" and (
            not self.slack_bot_token or not self.slack_escalation_channel_id
        ):
            raise ValueError(
                "chat_platform='slack' requires both slack_bot_token and slack_escalation_channel_id"
            )
        return self

    @model_validator(mode="after")
    def _heartbeat_requires_project(self) -> Settings:
        if self.heartbeat_enabled and self.google_cloud_project is None:
            raise ValueError("heartbeat_enabled requires google_cloud_project")
        return self

    @property
    def docs_query_url(self) -> str:
        return str(self.docs_service_url).rstrip("/") + "/query"
