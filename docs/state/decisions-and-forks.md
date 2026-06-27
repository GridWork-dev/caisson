# Decisions & Forks — live board

The single live board (CLAUDE.md source-of-truth #1). Locked → an ADR; open → waits for the
operator. Never auto-decide a fork.

## Locked (→ ADRs / specs)

| #                                  | Decision                                                                                                                   | Where                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Architecture                       | Monorepo, **Option C** (composable packages + generator/registry)                                                          | ADR-0003, ADR-0004                      |
| v1 scope                           | Base + **all 4 editions** (Compliance · AI Kit · Local-first · Agentic-Dev)                                                | specs/00                                |
| Lead edition                       | **Compliance** — broad base + SOC2/HIPAA evidence kit                                                                      | specs/00, ADR-0006                      |
| Generic boilerplate                | Included as table-stakes base, framed under differentiators                                                                | specs/00                                |
| Tooling                            | Bun + Turborepo + changesets; one `tooling/` standards gate                                                                | ADR-0001, ADR-0002                      |
| Tenancy                            | Fail-closed multi-tenant RLS (FORCE + test)                                                                                | ADR-0005                                |
| Compliance data layer              | WORM + append-only audit chain + field-crypto                                                                              | ADR-0006                                |
| Credits                            | Integer wallet + append-only ledger + debit-before-spend (402)                                                             | ADR-0007                                |
| Buyer MCP                          | Auth-gated, entitlement-scoped                                                                                             | ADR-0008                                |
| Support                            | Custom: Discord + Python RAG + hosted inference + cloud runners                                                            | ADR-0009                                |
| Licensing                          | Ed25519 offline + AGPL local-first flank + pro-private firewall                                                            | ADR-0010                                |
| AI config                          | Provider-agnostic + agent-assisted setup                                                                                   | ADR-0011                                |
| Commerce                           | One-time editions + bundle + per-module + subscription/credits                                                             | ADR-0012                                |
| **Name**                           | **Caisson** · `@caisson/*` · `caisson.sh` (was working name `stack`)                                                       | ADR-0014                                |
| **Hero positioning**               | **Compliance wedge** under a **production-rigor umbrella**; sequenced launch + P2-exit Wave-2 gate                         | ADR-0013                                |
| **ICP / buyer firewall**           | Hero = regulated-SaaS builder; generic buyer refused at paid tier → free AGPL flank only                                   | ADR-0013                                |
| **Compliance-update subscription** | Own SKU $149–299/mo, split from $49–199/mo dev credits                                                                     | ADR-0013 (supersedes ADR-0012 sub line) |
| **EU AI Act Annex IV**             | Gated paid add-on module (à-la-carte + sub); empty registry slot scaffolded in P2; US frameworks lead core; sell worldwide | ADR-0013                                |
| **Voice & brand**                  | Evidence-forward pro-tool; tagline "Compliance-grade infrastructure for regulated SaaS"; banned-word list                  | specs/04, ADR-0013                      |
| Reference-app stack                | Framework-agnostic core; app framework deferred per edition                                                                | —                                       |

## Open (waiting on operator — DO NOT auto-decide)

| Fork                                            | Options / notes                                                                                                | Owner    |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| **Module production-standards + item pipeline** | dedicated session; `tooling/`+`registry/` is the seam (ADR-0004)                                               | operator |
| **Pricing numbers**                             | working anchors in ADR-0012; subscription **structure** now locked (ADR-0013 split), numbers refine pre-launch | operator |
| **Docs tooling**                                | Mintlify vs self-host Starlight + RAG                                                                          | operator |
| **App framework per edition**                   | Next.js / TanStack Start / Hono — decided when each edition's app is built                                     | operator |
| **Domain purchase**                             | `caisson.sh` (~$45/yr) + claim `@caisson` npm org — operator action (external side-effect)                     | operator |

> **ADR numbering:** the positioning session claimed **ADR-0013 / ADR-0014**. The foundations
> track's technical ADRs (testing, db/orm, auth, CI, billing/MoR — review-findings completeness
> gaps) continue at **ADR-0015+** to avoid a number collision at merge.
