# Decisions & Forks — live board

The single live board (CLAUDE.md source-of-truth #1). Locked → an ADR; open → waits for the
operator. Never auto-decide a fork.

## Locked (→ ADRs / specs)

| #                                   | Decision                                                                                             | Where                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------- |
| Architecture                        | Monorepo, **Option C** (composable packages + generator/registry)                                    | ADR-0003, ADR-0004           |
| v1 scope                            | Base + **all 4 editions** (Compliance · AI Kit · Local-first · Agentic-Dev)                          | specs/00                     |
| Lead edition                        | **Compliance** — broad base + SOC2/HIPAA evidence kit                                                | specs/00, ADR-0006           |
| Generic boilerplate                 | Included as table-stakes base, framed under differentiators                                          | specs/00                     |
| Tooling                             | Bun + Turborepo + changesets; one `tooling/` standards gate                                          | ADR-0001, ADR-0002           |
| Tenancy                             | Fail-closed multi-tenant RLS (FORCE + test)                                                          | ADR-0005                     |
| Compliance data layer               | WORM + append-only audit chain + field-crypto                                                        | ADR-0006                     |
| Credits                             | Integer wallet + append-only ledger + debit-before-spend (402)                                       | ADR-0007                     |
| Buyer MCP                           | Auth-gated, entitlement-scoped                                                                       | ADR-0008                     |
| Support                             | Custom: Discord + Python RAG + hosted inference + cloud runners                                      | ADR-0009                     |
| Licensing                           | Ed25519 offline + AGPL local-first flank + pro-private firewall                                      | ADR-0010                     |
| AI config                           | Provider-agnostic + agent-assisted setup                                                             | ADR-0011                     |
| Commerce                            | One-time editions + bundle + per-module + subscription/credits                                       | ADR-0012                     |
| Working name                        | `stack` / `@stack/*` (provisional)                                                                   | —                            |
| Reference-app stack                 | Framework-agnostic core; app framework deferred per edition                                          | —                            |
| **Module production pipeline (D9)** | manifest + authoring · publish flow (one ingress) · lint gates — **authored, pending operator lock** | ADR-0020, ADR-0021, ADR-0022 |

**ADR numbering allocation (parallel tracks — append-only, avoid collision):** foundations owns
**ADR-0013–0018** (testing/golden, DB/ORM, auth, CI, billing, jobs+email) + the error-model ADR
(0019 or extend 0002) + amend-0007. Module-standards (D9) owns **ADR-0020–0022**.

## Open (waiting on operator — DO NOT auto-decide)

| Fork                                            | Options / notes                                                                                                                                                                                                                                                                          | Owner    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **Positioning / hero / voice / brand**          | dedicated session — research best hero across ALL differentiators (not AI-only) + refine voice                                                                                                                                                                                           | operator |
| **Real product name**                           | placeholder `stack`; decided with positioning                                                                                                                                                                                                                                            | operator |
| **Module production-standards + item pipeline** | ~~dedicated session~~ → **authored** (ADR-0020–0022), pending operator lock                                                                                                                                                                                                              | operator |
| **OSS-core SPDX + per-package paid/oss split**  | ADR-0010 locks: local-ai=AGPL-3.0-only; Compliance/AI-Kit/Agentic-Dev=commercial. **Open:** the OSS-core license for base packages (MIT vs Apache-2.0 vs source-available) + which base modules are paid pro vs free. _Rec: MIT base core; per-module `tier` set at first publish._ (D9) | operator |
| **Private registry host**                       | where versioned module packages publish (GitHub Packages vs npmjs private vs self-host Verdaccio). _Rec: GitHub Packages — same auth surface as the repo + ADR-0008 token model._ (D9)                                                                                                   | operator |
| **Pricing numbers**                             | working anchors in ADR-0012; refine pre-launch                                                                                                                                                                                                                                           | operator |
| **Docs tooling**                                | Mintlify vs self-host Starlight + RAG                                                                                                                                                                                                                                                    | operator |
| **App framework per edition**                   | Next.js / TanStack Start / Hono — decided when each edition's app is built                                                                                                                                                                                                               | operator |
