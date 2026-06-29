# ADR-0096 — `services/docs` is a standalone AI-native docs service

Status: accepted · 2026-06-29 (operator lock, picker round) · resolves the open `services/docs`
scoping fork (no prior ADR pinned it). Composes on ADR-0009 (support stack), ADR-0084 (the `apps/site`
Fumadocs marketing+docs site), specs/00 (P6 services).

## Context

`plan.md` P6 lists `services/docs` (AI-native docs + `llms.txt`) as an empty scaffold, but **no ADR
pinned the boundary** between (a) a separate AI-native docs _service_ and (b) extending the already-
shipped `apps/site` Fumadocs static docs + an `llms.txt` + a buyer-agent endpoint. The 2026-06-29
state investigation flagged this as a possible operator scoping fork
(`docs/state/readiness-and-backlog.md` §4). The operator chose **standalone service** (picker,
2026-06-29).

## Decision

**Build `services/docs` as a standalone AI-native docs service** — a separate P6 service feeding both
the `support-bot` RAG (ADR-0009) and buyer agents, plus an `llms.txt`. It is **distinct from
`apps/site`'s Fumadocs static docs** (ADR-0084): `apps/site` owns the human-facing marketing + static
reference docs; `services/docs` owns the **AI-native corpus** (machine-readable docs, embeddings/RAG
source, `llms.txt`, agent-queryable endpoints) that grounds the support-bot and buyer-agent answers.

- The two are complementary, not redundant: `apps/site` = read-by-humans; `services/docs` = read-by-
  agents (+ the support-bot's retrieval corpus).
- Build at P6 alongside `services/{license,support-bot}` (work item **W6**). The support-bot's RAG
  grounding quality depends on this corpus, so it is sequenced with the bot.

## Rejected

- **Extend `apps/site` Fumadocs + `llms.txt` + a buyer-agent endpoint** (fold docs into the marketing
  site) — lighter and one deploy target, but couples the AI-native corpus to a static-export marketing
  app and gives the support-bot/buyer-agents no first-class service to query. The operator chose the
  cleaner separation.
- **Defer scoping until the support-bot needs it** — leaves the P6 docs boundary undefined while the
  bot is being built.

## Binding

- `services/docs` is a standalone AI-native docs service (separate from `apps/site` Fumadocs), built at
  P6, feeding the support-bot RAG + buyer agents + an `llms.txt`.
- `apps/site` retains the human-facing marketing + static Fumadocs reference docs (ADR-0084 unchanged).

Evidence: `docs/state/readiness-and-backlog.md` §4 (the scoping fork); `plan.md` P6; the operator
picker (2026-06-29).
