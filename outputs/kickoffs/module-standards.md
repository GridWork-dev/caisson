# KICKOFF — Track 3: Module production-standards + pipeline (D9)

Paste this as the first message of a fresh Claude session in the `track/module-standards` worktree.

---

You are running the **module production-standards + pipeline** session for the `stack` monorepo —
the deferred D9 work: define **how a registry module is authored, validated, versioned, and
published**, and the standards/lint gates that enforce it. **Read first:** `CLAUDE.md`,
`knowledge/decisions/ADR-0002` (engineering invariants), `ADR-0003` (composable packages),
`ADR-0004` (generator/registry + codegen-credits), `specs/01-architecture.md` §1, §4, §5 (the
seam), `plan.md` (tooling/ + registry/ tasks), the `tooling/` and `registry/` dirs.

**Locked:** the `tooling/` standards layer is the ONE gate; a module enters the registry ONLY
through it; editions are compositions (ADR-0003); generation is credit-metered (ADR-0004). Your job
is to DEFINE that gate + pipeline — not to relitigate the architecture.

## Goal

Specify and scaffold the **module production pipeline**: the module manifest schema, the authoring
conventions, the golden-file validation, the version/publish flow, and the CI lint gates that make
"ships only through the standards gate" real. Output: ADRs + the `tooling/` + `registry/` scaffolding
(definitions/configs, not edition code).

## Do

1. **Module manifest + authoring spec** — what every registry module declares (name, semver,
   edition membership, OSS|paid license, price, dependencies, entry points, AGENTS.md), and the
   authoring conventions every module follows (per ADR-0002).
2. **Golden-file validation** — coordinate with the foundations track's ADR-0013 (testing/golden-file
   harness); define what a _module's_ golden fixture is and how the publish flow runs it.
3. **Version + publish flow** — changesets policy per module; the publish path that is the ONLY
   registry ingress; backfill plan ("publish P2–P4 packages as the initial registry module set").
4. **Resolve the standards/lint review gaps** (from `outputs/research/review-findings.json`,
   technical-soundness + completeness dimensions) — these are this track's enforcement work:
   - **AGPL-import CI lint (ADR-0010 enforcement)** — a dependency-cruiser / ESLint import-boundary
     rule that FAILS BUILD if a commercial package imports the AGPL `local-ai` package (review rated
     HIGH — currently review-gated only; legal liability).
   - **Provider-SDK import-boundary lint (ADR-0011 enforcement)** — only `ai-config`/`ai-kit` may
     import provider SDKs; everything else routes through `ai-config`.
   - **Generator input-validation (ADR-0004/0008)** — module/edition names from MCP/CLI callers
     validated against the registry allowlist before any path construction / subprocess.
   - The standards-gate-enforces-registry-write invariant (ADR-0004) made executable in CI.
5. **Write:** ADRs for the module manifest, the publish pipeline, and the lint gates; scaffold
   `tooling/eslint-config` (incl. the import-boundary rules), `tooling/testing` (golden harness),
   and a `registry/` manifest schema + README.

## Rules

Never auto-decide a fork (board it). This is mostly spec + tooling config — no edition feature code.
Coordinate the golden-file harness definition with the foundations track (shared artifact — don't
double-define; reference ADR-0013). Atomic conventional commits (`feat(tooling): …`, `docs(adr): …`).
