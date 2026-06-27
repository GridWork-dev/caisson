# Decisions & Forks — live board

The single live board (CLAUDE.md source-of-truth #1). Locked → an ADR; open → waits for the
operator. Never auto-decide a fork.

## Locked (→ ADRs / specs)

| #                                   | Decision                                                                                                                                                                                                                    | Where              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Architecture                        | Monorepo, **Option C** (composable packages + generator/registry)                                                                                                                                                           | ADR-0003, ADR-0004 |
| v1 scope                            | Base + **all 4 editions** (Compliance · AI Kit · Local-first · Agentic-Dev)                                                                                                                                                 | specs/00           |
| Lead edition                        | **Compliance** — broad base + SOC2/HIPAA evidence kit                                                                                                                                                                       | specs/00, ADR-0006 |
| Generic boilerplate                 | Included as table-stakes base, framed under differentiators                                                                                                                                                                 | specs/00           |
| Tooling                             | Bun + Turborepo + changesets; one `tooling/` standards gate                                                                                                                                                                 | ADR-0001, ADR-0002 |
| Tenancy                             | Fail-closed multi-tenant RLS (FORCE + test)                                                                                                                                                                                 | ADR-0005           |
| Compliance data layer               | WORM + append-only audit chain + field-crypto                                                                                                                                                                               | ADR-0006           |
| Credits                             | Integer wallet + append-only ledger + debit-before-spend (402)                                                                                                                                                              | ADR-0007           |
| Buyer MCP                           | Auth-gated, entitlement-scoped                                                                                                                                                                                              | ADR-0008           |
| Support                             | Custom: Discord + Python RAG + hosted inference + cloud runners                                                                                                                                                             | ADR-0009           |
| Licensing                           | Ed25519 offline + AGPL local-first flank + pro-private firewall                                                                                                                                                             | ADR-0010           |
| AI config                           | Provider-agnostic + agent-assisted setup                                                                                                                                                                                    | ADR-0011           |
| Commerce                            | One-time editions + bundle + per-module + subscription/credits                                                                                                                                                              | ADR-0012           |
| Working name                        | `stack` / `@stack/*` (provisional)                                                                                                                                                                                          | —                  |
| Reference-app stack                 | Framework-agnostic core; app framework deferred per edition                                                                                                                                                                 | —                  |
| **Module production pipeline (D9)** | manifest · publish flow (one ingress) · lint gates · fully-commercial licensing — **authored + hardened across 2 adversarial passes; verdict lock-with-fixes (applied); pending operator lock**                             | ADR-0020–0023      |
| **Licensing model**                 | **Fully commercial** — every module `LicenseRef-Stack-Commercial` (proprietary EULA: use in products, no resale); AGPL Local-first the sole open flank. Supersedes ADR-0010's open-core base; reverses the Apache base pick | ADR-0023 (D9)      |
| **Private registry host**           | **GitHub Packages** — same auth surface as the repo + ADR-0008 token model                                                                                                                                                  | ADR-0021 (D9)      |
| **Boundary enforcement mechanism**  | **Both**: ESLint `no-restricted-imports` + Bun standards-gate + dependency-cruiser (belt-and-suspenders)                                                                                                                    | ADR-0022 (D9)      |

**ADR numbering allocation (parallel tracks — append-only, avoid collision):** foundations owns
**ADR-0013–0018** (testing/golden, DB/ORM, auth, CI, billing, jobs+email) + the error-model ADR
(0019 or extend 0002) + amend-0007. Module-standards (D9) owns **ADR-0020–0023**.

## Open (waiting on operator — DO NOT auto-decide)

| Fork                                            | Options / notes                                                                                                                            | Owner    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| **Positioning / hero / voice / brand**          | dedicated session — research best hero across ALL differentiators (not AI-only) + refine voice                                             | operator |
| **Real product name**                           | placeholder `stack`; decided with positioning                                                                                              | operator |
| **Module production-standards + item pipeline** | ~~dedicated session~~ → **authored + hardened (2 adversarial passes, fixes applied)** (ADR-0020–0023); awaiting operator **lock** sign-off | operator |
| **Pricing numbers**                             | working anchors in ADR-0012; refine pre-launch                                                                                             | operator |
| **Docs tooling**                                | Mintlify vs self-host Starlight + RAG                                                                                                      | operator |
| **App framework per edition**                   | Next.js / TanStack Start / Hono — decided when each edition's app is built                                                                 | operator |
