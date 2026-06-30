# ADR-0109 — Support-bot member management (server ops on the existing bot)

Status: accepted · 2026-06-30 (P6 go-live session, operator directive "add functionality to bot to
manage members … create all the channels and permissions") · **extends ADR-0105** (support-bot impl)
**inside the ADR-0009 envelope** — does not supersede either · Phase P6 Bucket C. Append-only;
supersede with a later ADR, never edit.

> **ADR numbering:** ADR-0108 reserved **0109+** for the code track; this is that next code-track ADR.
> No collision — 0109 exists on no ref as of this lock. Next free: **0110**.

## Context

ADR-0105 locked `services/support-bot` as a **support-RAG** surface: a `/ask` slash command + an
`#ask-ai` listener routed through one pipeline, with thread+Postgres escalation. The operator stood up
the live Discord server this session and needs the bot to also run **server operations** — auto-onboard
joiners, expose self-assign roles, give moderators slash tools, and map a purchase to its edition role.
That is new capability beyond ADR-0105's read-only support envelope, so it gets its own lock.

A fork sits underneath: **extend the existing bot, or run a second "admin" bot?** One bot is chosen —
a solo operator at single-server scale pays nothing for the extra process and gains a single deploy,
token, and health surface. The member-management code is an isolated module (`member_mgmt.py`) layered
onto the same `commands.Bot`, so the support path is untouched.

## Decisions

1. **One bot, new module.** Member management lands in `services/support-bot/.../member_mgmt.py` and is
   wired into the existing `make_bot`/`setup_hook`. No second process; the RAG support path is unchanged.

2. **Surfaces shipped.**
   - **Join auto-role + welcome** — `on_member_join` assigns the default `Member` role and posts a
     welcome (channel + best-effort DM).
   - **Self-assign roles** — a **persistent** `discord.ui.View` (`timeout=None`, fixed per-button
     `custom_id`) re-registered via `bot.add_view` in `setup_hook`; posted once by `/post-roles`.
   - **Moderation slash commands** — `/kick` `/ban` `/timeout` `/role-add` `/role-remove`.
   - **Purchase → edition role** — `/grant-role <member> <edition>` (admin) grants the edition role +
     the `Customer` umbrella.

3. **Privileged-intent gating (the safety lock).** The `members` privileged intent is enabled **only
   when `member_role_id` is configured**. Setting the env requires the operator to first flip "Server
   Members Intent" in the Developer Portal — otherwise the gateway refuses to connect. Mod commands,
   `/grant-role`, and the self-assign buttons need **no** privileged intent (interactions carry the
   member), so they ship regardless. Every new surface degrades gracefully when its config is unset.

4. **Moderation authorization is double-gated.** Each mod command carries
   `@app_commands.default_permissions(...)` (hides it in the client UI for non-mods) **and**
   `@app_commands.checks.has_permissions(...)` (the runtime guarantee). A central `tree.error` handler
   answers a denied check ephemerally; unknown errors surface to logging. A role-hierarchy guard
   (`role_outranks_bot`) returns a clean message instead of a raw `Forbidden` when the bot's role sits
   below the target role.

5. **Edition-role mapping.** `/grant-role` choices are the public edition slugs
   (`compliance` · `ai-kit` · `local-first` · `agentic-dev`), each mapped to a configured role id, plus
   an optional `Customer` umbrella. No per-edition self-select (paid access is never self-granted).

## Deferred (not in this lock)

- **Billing-webhook HTTP grant endpoint.** An authenticated inbound `POST /grant-role` for the
  payment provider to call (Discord-id → edition role) is **deferred to the Paddle phase (ADR-0108)** —
  no new authenticated inbound surface before a caller exists. When built it MUST use a constant-time
  shared-secret check (`hmac.compare_digest`, the `identity/security.md` timing-safe analogue) and
  bound/validate its inputs; it will land its own surfaces-ledger row + ADR.
- **License-entitlement → role bridge (Linked Roles / OAuth).** Auto-granting edition roles from the
  Ed25519 license entitlements (ADR-0047/0071) instead of the manual `/grant-role`. Tracked as a
  fast-follow once checkout is live.
- **Pending-aware onboarding** (grant `Member` on the `GUILD_MEMBER_UPDATE` `pending→false` Rules-
  Screening flip rather than on raw join) — a refinement, not required for go-live.

## Security

No new authenticated inbound surface (the only inbound remains the unauthenticated `/health`, so the
timing-safe-compare floor stays vacuous for now — the deferred webhook is where it un-vacuums). Mod
authorization is Discord's own permission system, double-gated. The bot's elevated guild permissions
(Manage Roles / Kick / Ban / Moderate Members) are constrained by the role hierarchy — its role must
sit above only what it manages — and the operator scopes the bot from Administrator down to a
least-privilege role before go-live (tracked in the go-live runbook, ADR-0107).

## Consequences

- The support bot is now also the server-ops bot; one deploy covers both. 12 new unit tests over the
  pure helpers (`assign_default_role`/`toggle_role`/`grant_edition`/`welcome_member`/`edition_role_id`/
  `role_outranks_bot`/`build_role_view`); 44/44 bot tests green, ruff + pyright clean.
- Going live requires three operator actions: enable Server Members Intent in the Portal, set the
  channel/role ids in the Railway env, and scope the bot's role down from Administrator.
