# ADR-0009 — Custom support-bot service (Discord + Python + codebase RAG + cloud runners)

Status: proposed · 2026-06-27 (Phase 5 spec; pending Gate 4)

Support is a **custom self-built service** (operator decision — not Inkeep/Plain/Pylon).
`services/support-bot`:

- **Discord bot front-end** — the community is the moat (ShipFast's 5,000+ Discord is its durable
  advantage); a `#ask-ai` surface answers grounded in the codebase.
- **Python LLM-dispatching** + a **RAG pipeline over the codebase** (the shipped packages + docs
  `llms.txt` are the knowledge base — one content artifact also feeds buyers' agents).
- **Hosted inference via API** (OpenRouter/Anthropic — not local models), so quality/reliability
  doesn't depend on local hardware.
- **Deployed on cloud runners** for reliability — the operator's home machines reboot / lose
  power; the support surface must not. (This is the one component explicitly NOT on local infra.)
- **Escalation:** on a question the bot can't resolve, it **drafts a brief + opens/tags a human
  ticket** (the operator-requested "AI briefs and is tagged into the ticket" flow), stored as
  `support_ticket.ai_brief`.

It **doubles as a shippable value-add template** — on-brand for "your AI production codebase
starter" (the buyer can ship the same support bot for their product).

Rejected: a vendor (Inkeep/Plain/Pylon) — operator wants to own the system + ship it as a
template. Local-model inference (reliability/quality risk on rebooting hardware). Local hosting
of the bot (the explicit reliability problem this ADR solves).

Binding: the bot is the only support component on cloud infra; it never answers from anything but
the codebase/docs RAG (no hallucinated support); every escalation carries an AI brief.
