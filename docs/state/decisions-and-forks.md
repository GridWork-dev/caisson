# Decisions & Forks — live board

The single live board (CLAUDE.md source-of-truth #1). Locked → an ADR; open → waits for the
operator. Never auto-decide a fork.

> **Reconciliation in progress** (`integration/caisson-reconcile`): ADR numbers below are
> pre-renumber and will be deduped in the same integration pass (cross-track collisions on
> 0013/0014/0023). This board is rewritten to its final state at the end of that pass.

## Locked (→ ADRs / specs)

| #                               | Decision                                                                                                                                                                                       | Where                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Architecture                    | Monorepo, **Option C** (composable packages + generator/registry)                                                                                                                              | ADR-0003, ADR-0004                                    |
| v1 scope                        | Base + **all 4 editions** (Compliance · AI Kit · Local-first · Agentic-Dev)                                                                                                                    | specs/00                                              |
| Lead edition                    | **Compliance** — broad base + SOC2/HIPAA evidence kit                                                                                                                                          | specs/00, ADR-0006                                    |
| Generic boilerplate             | Included as table-stakes base, framed under differentiators                                                                                                                                    | specs/00                                              |
| Tooling                         | Bun + Turborepo + changesets; one `tooling/` standards gate                                                                                                                                    | ADR-0001, ADR-0002                                    |
| Tenancy                         | Fail-closed multi-tenant RLS (FORCE + test)                                                                                                                                                    | ADR-0005                                              |
| Compliance data layer           | WORM + append-only audit chain + field-crypto                                                                                                                                                  | ADR-0006                                              |
| Credits                         | Integer wallet + append-only ledger + debit-before-spend (402)                                                                                                                                 | ADR-0007                                              |
| Buyer MCP                       | Auth-gated, entitlement-scoped                                                                                                                                                                 | ADR-0008                                              |
| Support                         | Custom: Discord + Python RAG + hosted inference + cloud runners                                                                                                                                | ADR-0009                                              |
| Licensing (offline)             | Ed25519 offline license + pro-private firewall (licensing _model_ now fully-commercial, see below)                                                                                             | ADR-0010 (super. 0023)                                |
| AI config                       | Provider-agnostic + agent-assisted setup                                                                                                                                                       | ADR-0011                                              |
| Commerce                        | One-time editions + bundle + per-module + subscription/credits                                                                                                                                 | ADR-0012                                              |
| Testing                         | `bun test` + PGlite integration + golden-file harness (`BLESS=1`)                                                                                                                              | ADR-0013                                              |
| Database / ORM                  | **Drizzle**; host **Neon** (swappable); numbered+idempotent migrations + `schema_version` checksum ledger                                                                                      | ADR-0014                                              |
| Auth                            | **better-auth** (self-hosted, owns Drizzle tables); EdDSA-JWT+JWKS cross-plane seam; `withTenant` = sole RLS entry                                                                             | ADR-0015                                              |
| CI/CD                           | GitHub Actions; 6 required jobs (build·lint·unit·integration·standards-gate·golden-file); gate = sole registry ingress                                                                         | ADR-0016                                              |
| Billing / payments              | **Stripe + Stripe Tax** (PSP, operator=MoR); `BillingProvider` port; HMAC-raw-body webhook verify; P1 seam / P6 orchestration                                                                  | ADR-0017                                              |
| Jobs / email                    | **Trigger.dev** (self-hostable) + **Resend**; ports w/ test drivers; billing/credit side-effects enqueued not inline                                                                           | ADR-0018                                              |
| Error model                     | Typed `CaissonError` hierarchy in `kernel`; 402 credit-gate shape; tenancy denial = 404 (no existence leak)                                                                                    | ADR-0019                                              |
| Module production pipeline (D9) | manifest · publish flow (one ingress) · lint gates — **LOCKED** (operator sign-off after 2 adversarial passes)                                                                                 | ADR-0020–0022                                         |
| **Licensing model**             | **Fully commercial** — every module `LicenseRef-Caisson-Commercial` (proprietary EULA: use in products, no resale); AGPL Local-first the sole open flank. Supersedes ADR-0010's open-core base | ADR-0023 (D9)                                         |
| Private registry host           | **GitHub Packages** — same auth surface as the repo + ADR-0008 token model                                                                                                                     | ADR-0021 (D9)                                         |
| Boundary enforcement            | **Both**: ESLint `no-restricted-imports` + Bun standards-gate + dependency-cruiser                                                                                                             | ADR-0022 (D9)                                         |
| Credit idempotency              | partial-unique `(source_event_id, event_type)` + `(account_id, idempotency_key)` + one-of-two CHECK                                                                                            | ADR-0023 (found., amends 0007) — **renumber pending** |
| Reference-app stack             | Framework-agnostic core; app framework deferred per edition                                                                                                                                    | —                                                     |

## Open (waiting on operator — DO NOT auto-decide)

| Fork                          | Options / notes                                                            | Owner    |
| ----------------------------- | -------------------------------------------------------------------------- | -------- |
| **Pricing numbers**           | working anchors in ADR-0012; refine pre-launch                             | operator |
| **App framework per edition** | Next.js / TanStack Start / Hono — decided when each edition's app is built | operator |

## Flagged for the Compliance session (P2 pre-work — do NOT build in the foundations track)

| Item                                        | Why                                                                                                                                                                                                                                                                | Owner              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| **Amend ADR-0006 — field-crypto base tier** | base tier must use **per-tenant key derivation** `HKDF(master_env_key, tenant_id)`, NOT a single shared env key (a shared key = cross-tenant breach). Docs-review rated **HIGH**. Author an ADR-0006 amendment (append-only) before any `field-crypto` code in P2. | compliance session |
