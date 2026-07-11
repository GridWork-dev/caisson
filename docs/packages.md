# Package catalog

> **STALE STATUS COLUMN — read this first.** This file catalogs the **original 24** workspaces
> under `packages/` as scoped at `ADR-0082` §3 (2026-06-28 snapshot); `packages/*` has since grown
> to **54 dirs**. Its **Status** column (BUILT/STUB) and edition framing predate
> editions-go-live (`ADR-0201`, all live transports proven), the Stage-2/harvest builds, and the
> 2026-07-06 six-bundle catalog rework (`ADR-0257`/`0258`) that **dissolved editions into
> bundles** and carved 5+ new commercial packages out of several rows this file still marks
> `STUB`. **For current build status, read [`docs/build-state.md`](build-state.md); for current
> license/sold-as/price, read [`docs/state/package-catalog.md`](state/package-catalog.md)** — both
> are machine-checked or dated 2026-07-06+ and supersede this file on those two views. What
> remains live here: the purpose/dependency-direction mapping for the 24 original packages.

Internal source-of-truth index for the **original 24** workspaces under `packages/` (kernel +
base substrate + edition + shared packages, as scoped at ADR-0082 §3). `packages/*` has since
grown to **54 dirs** — the 30 later additions (Stage-2/harvest waves, the W1/W7 catalog-rework
carves, `ui-pro`, `agent-runner`, etc.) are not catalogued in the tables below; see
[`docs/build-state.md`](build-state.md) for their per-package status and
[`docs/state/package-catalog.md`](state/package-catalog.md) for their license/sold-as/price. This
file OWNS the synthesized catalog view (purpose + edition membership + build status + evidence +
ADR routing) for the 24 packages it covers; it does NOT restate canonical prose. Canonical sources
stay authoritative:

- Architecture + package taxonomy: [`specs/01-architecture.md`](../specs/01-architecture.md), [`specs/00-product-spec.md`](../specs/00-product-spec.md)
- The decision record: [`knowledge/decisions/`](../knowledge/decisions/) (ADR-NNNN, append-only)
- Live decision board: [`docs/state/decisions-and-forks.md`](state/decisions-and-forks.md) (CLAUDE.md SoT #1)
- Build plan P0-P7: [`docs/archive/plan.md`](archive/plan.md)

On any conflict, the canonical source wins over this catalog.

## How to read this

**Status** is verified against the actual filesystem (each package's `package.json`, `src/`, and
`*.test.ts`) AND reconciled against the authoritative build-honesty call in
[`ADR-0082` section 3](../knowledge/decisions/ADR-0082-go-live-site-posture.md):

| Status      | Meaning                                                                                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BUILT**   | Genuinely built + tested substrate. ADR-0082 sec.3 names exactly these as built: `kernel`, `tenancy-rls`, `field-crypto`, `auth`, `billing`, `credits` + `create-caisson` (`cli`).                   |
| **STUB**    | "Structure only" per ADR-0082 sec.3. Merged scaffolding exists (LOC shown in `src` col is REAL code), but the package is NOT a production-complete edition primitive. Do not represent as shippable. |
| **ROADMAP** | Retired class — ADR-0237 rider 2 retired the ADR-0082 sec.4 roadmap exception; the former ROADMAP row (`agent-dev`) is tracked as STUB.                                                              |

**Evidence** = `src` files (`.ts`, excluding tests) / `test` files (`*.test.ts`), as found on disk
2026-06-28. High LOC inside a STUB row means scaffolding was merged, not that the edition works
end-to-end. Several BUILT substrate packages are also still thin seams (see Candor notes per group).

All 24 catalogued here are `@caisson/*`. At the 2026-06-28 snapshot date all were `"private":
true`, `version 0.0.0` (unpublished; publish flow = ADR-0069) — that is no longer true repo-wide:
several packages (base-substrate + generator + a growing set of commercial modules) have since
published real versions. Verify a given package's current `private`/`version` field on disk, or
read [`docs/state/package-catalog.md`](state/package-catalog.md) for the current sold-as/license view.

---

## Layer: kernel + base substrate (the Base edition core)

The proven floor. Per ADR-0082 sec.3 these (minus the thin seams noted) are the only genuinely
built product packages. Base-split rationale: [`ADR-0003`](../knowledge/decisions/ADR-0003-composable-package-base-split.md).

| Package        | Purpose                                                                                                                                                             | Edition                 | Status           | Evidence src/test | Key ADRs                                                                                                                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kernel`       | Governance kernel: typed config/agent/skill/rule schema + validator + lint-gate; typed `CaissonError` hierarchy.                                                    | base                    | **BUILT**        | 12 / 9            | 0019 (error model), 0003                                                                                                                                                                                                                                                                                   |
| `tenancy-rls`  | Fail-closed multi-tenant Postgres RLS (FORCE policies + schema test); `withTenant` sole entry.                                                                      | base                    | **BUILT**        | 2 / 1             | [0005](../knowledge/decisions/ADR-0005-fail-closed-rls-tenancy.md), 0073                                                                                                                                                                                                                                   |
| `field-crypto` | Per-tenant authenticated field encryption (AES-256-GCM, HKDF per-tenant keys, self-describing envelope, crypto-shred). The encrypted-column floor under Compliance. | base (Compliance floor) | **BUILT**        | 13 / 9            | [0043](../knowledge/decisions/ADR-0043-field-crypto-per-tenant-keys.md), [0045](../knowledge/decisions/ADR-0045-field-crypto-aead-cipher.md), [0046](../knowledge/decisions/ADR-0046-ciphertext-envelope-format.md), [0055](../knowledge/decisions/ADR-0055-field-crypto-cryptoshred-and-row-aad.md), 0006 |
| `auth`         | Authentication (sessions/JWT), provider-agnostic; better-auth + EdDSA-JWT/JWKS cross-plane seam.                                                                    | base                    | **BUILT** (thin) | 3 / 1             | [0015](../knowledge/decisions/ADR-0015-auth-session-rls-seam.md)                                                                                                                                                                                                                                           |
| `billing`      | `BillingProvider` port; Paddle is the sole mounted buyer-purchase webhook (5s sig tolerance, txn-id idempotency), Stripe/LemonSqueezy/Polar stay dormant drivers.   | base                    | **BUILT** (thin) | 4 / 1             | [0017](../knowledge/decisions/ADR-0017-billing-stripe-mor.md), 0116, [0200](../knowledge/decisions/ADR-0200-paddle-sole-buyer-webhook-mount.md)                                                                                                                                                            |
| `credits`      | Integer credit wallet + append-only ledger + debit-before-spend (402); partial-unique idempotency.                                                                  | base                    | **BUILT**        | 3 / 2             | [0007](../knowledge/decisions/ADR-0007-credit-metering-model.md), 0024, 0074                                                                                                                                                                                                                               |

**Candor:** `auth` (143 LOC) and `billing` (249 LOC) are BUILT per ADR-0082 but are seam-level, not
feature-complete (e.g. the billing-cycle -> `grant()` mapping + USD<->credit price-book is the open
X-2 gap tracked on the board). `tenancy-rls` is low-LOC by design (SQL FORCE policies + a schema test
carry the substance).

## Layer: Compliance edition (HERO)

Hero positioning: [`ADR-0040`](../knowledge/decisions/ADR-0040-positioning-hero.md).
WORM/audit-chain data layer: [`ADR-0006`](../knowledge/decisions/ADR-0006-worm-audit-chain-field-crypto.md).

| Package      | Purpose                                                                                                                                  | Edition    | Status                    | Evidence src/test | Key ADRs                                                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audit-worm` | WORM artifact store + SHA-256 append-only audit chain + per-append anchor; `ArtifactStore` port (S3 Object-Lock prod).                   | compliance | **STUB** (ADR-0082 sec.3) | 7 / 6             | [0052](../knowledge/decisions/ADR-0052-audit-chain-anchor-persistence.md), [0054](../knowledge/decisions/ADR-0054-worm-artifactstore-port.md), 0051, 0006 |
| `compliance` | The hero edition: tenant seeds, encrypted SEC/HIPAA evidence, deterministic evidence-pack + Ed25519 signing; clean-room control catalog. | compliance | **STUB** (ADR-0082 sec.3) | 16 / 11           | [0057](../knowledge/decisions/ADR-0057-compliance-control-model.md), [0058](../knowledge/decisions/ADR-0058-evidence-pack-format-determinism.md), 0056    |

**Candor:** `compliance` (2871 LOC) + `audit-worm` (1302 LOC) carry the most merged scaffolding of any
STUB, but ADR-0082 sec.3 explicitly names both as "structure only" / empty stubs. Do not demo
`caisson compliance evidence-pack` as working (ADR-0082 sec.3 bars unbuilt-edition CLI demos).

## Layer: AI Production Kit edition

Single metered-inference gateway as the enforced chokepoint: [`ADR-0059`](../knowledge/decisions/ADR-0059-ai-kit-inference-gateway.md).

| Package           | Purpose                                                                                                                            | Edition         | Status                    | Evidence src/test | Key ADRs                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------- | ----------------- | ---------------------------------------------------------------------- |
| `ai-kit`          | The AI Production Kit edition: one metered `infer(lane, input, ...)` gateway; provider-SDK calls confined here (Gate-2 carve-out). | ai-kit          | **STUB** (ADR-0082 sec.3) | 3 / 2             | [0059](../knowledge/decisions/ADR-0059-ai-kit-inference-gateway.md)    |
| `ai-meter`        | Token/credit metering: estimate -> reserve -> reconcile vs append-only credit_event; soft/hard caps + circuit breaker; price-book. | ai-kit          | **STUB**                  | 6 / 3             | [0060](../knowledge/decisions/ADR-0060-ai-kit-metering-spendcap.md)    |
| `prompt-registry` | Append-only versioned prompts; `name@version` / `name@alias` addressing + injection-safe templating.                               | ai-kit          | **STUB**                  | 4 / 2             | [0061](../knowledge/decisions/ADR-0061-ai-kit-prompt-registry.md)      |
| `ai-evals`        | Eval harness: grader taxonomy + datasets bound to prompt versions; regression-vs-committed-baseline gate.                          | ai-kit          | **STUB**                  | 6 / 1             | [0062](../knowledge/decisions/ADR-0062-ai-kit-eval-harness-ci-gate.md) |
| `guardrails`      | Pluggable in/out moderation + PII redaction (reuses field-crypto) at the gateway; fail-closed; `GuardrailError`.                   | ai-kit          | **STUB**                  | 4 / 2             | [0063](../knowledge/decisions/ADR-0063-ai-kit-guardrails.md)           |
| `ai-config`       | Provider-agnostic AI config (all providers) + buyer settings file. Shared: also consumed by `mcp-server` + `agent-dev`.            | ai-kit / shared | **STUB**                  | 2 / 1             | 0011                                                                   |

**Candor:** `ai-kit` itself is a 358-LOC shell composing five STUB sub-packages; the metering/eval/
prompt primitives have more code but none is wired to a built, shippable gateway. ADR-0082 sec.3
names `ai-kit` an empty stub.

## Layer: Local-first AI edition

Commercial edition, AGPL flank removed: [`ADR-0050`](../knowledge/decisions/ADR-0050-local-ai-fully-commercial.md) /
[`ADR-0083`](../knowledge/decisions/ADR-0083-local-first-fully-commercial.md). (The **Base substrate** went
**open-core Apache-2.0** per [`ADR-0094`](../knowledge/decisions/ADR-0094-open-core-base-apache2.md), 2026-06-29;
editions like Local-first AI stay commercial. Re-licensing impl scheduled — work item W1.)

| Package       | Purpose                                                                                                                     | Edition             | Status                    | Evidence src/test | Key ADRs                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------- | ----------------- | --------------------------------------------------------------------------------------------- |
| `local-ai`    | Local-first AI edition: offline, two-way sync (CRDT/LWW + tombstones on SQLite), InferenceBackend port, DB-file-per-tenant. | local-ai            | **STUB** (ADR-0082 sec.3) | 14 / 9            | [0064](../knowledge/decisions/ADR-0064-local-first-edition-architecture.md), 0050, 0083, 0073 |
| `local-store` | Shared local hybrid-retrieval base: sqlite-vec (`vec0`) + FTS5 + RRF; composed by `local-ai` and `agent-dev`.               | shared (local base) | **STUB**                  | 8 / 7             | [0067](../knowledge/decisions/ADR-0067-base-local-store-package.md)                           |

**Candor:** `local-ai` (2209 LOC) + `local-store` (1043 LOC) are the most-developed STUBs after
compliance, but ADR-0082 sec.3 lists `local-ai` as "structure only." Treat the privacy-gate config
demo as illustrative, not built.

## Layer: Agentic-Dev edition

The thinnest edition surface (the ADR-0082 sec.4 roadmap label was retired by ADR-0237
rider 2). Governed TS kernel + engine-neutral
multi-harness emitter: [`ADR-0066`](../knowledge/decisions/ADR-0066-agentic-dev-governed-kernel-emitter.md).

| Package        | Purpose                                                                                                                                          | Edition             | Status                      | Evidence src/test | Key ADRs                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | --------------------------- | ----------------- | ------------------------------------------------------------------------------ |
| `agent-kernel` | Engine-neutral agent kernel: schema + lifecycle FSM + hooks dispatcher. Shared base, also consumed by `cli` + `mcp-server`.                      | shared (agent base) | **STUB**                    | 8 / 7             | [0065](../knowledge/decisions/ADR-0065-base-agent-kernel-package.md)           |
| `agent-dev`    | Agentic-Dev edition: typed agent/skill/rule schema + lifecycle FSM + local hybrid memory + multi-harness (.claude / AGENTS.md / Cursor) emitter. | agent-dev           | **STUB** (thinnest edition) | 7 / 3             | [0066](../knowledge/decisions/ADR-0066-agentic-dev-governed-kernel-emitter.md) |

**Candor:** ADR-0237 rider 2 retired the ADR-0082 sec.4 roadmap exception (FULL V1-live posture
on the site). `agent-kernel` (1101 LOC) is scaffolded as a base but the edition surface
(`agent-dev`) is the thinnest of the four.

## Layer: shared / cross-edition

Reusable seams composed by multiple editions; never depend "up" on an edition (ADR-0003).

| Package          | Purpose                                                                                                                                                   | Edition | Status    | Evidence src/test | Key ADRs                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cli`            | `create-caisson`: the generator that composes a tailored repo from the versioned registry (in-repo template copy + token/JSON-merge, debit-before-spend). | shared  | **BUILT** | 5 / 3             | 0004, [0068](../knowledge/decisions/ADR-0068-generator-engine-fileset-writer.md), 0048, 0049                                                         |
| `mcp-server`     | Auth-gated buyer-facing MCP server, entitlement-scoped; per-tool entitlement gating seam.                                                                 | shared  | **STUB**  | 3 / 2             | [0008](../knowledge/decisions/ADR-0008-buyer-mcp-server-auth.md), 0076                                                                               |
| `license-verify` | Offline, fail-safe-to-community Ed25519 license verification; the floor a paid edition stands on.                                                         | shared  | **STUB**  | 4 / 2             | [0010](../knowledge/decisions/ADR-0010-licensing-open-core-boundary.md), [0023](../knowledge/decisions/ADR-0023-fully-commercial-licensing-model.md) |
| `ui`             | vanilla-extract typed token floor + headless+styled primitives (design system runtime).                                                                   | shared  | **STUB**  | 6 / 1             | 0042, 0078                                                                                                                                           |
| `email`          | Transactional email (Resend port + test driver).                                                                                                          | shared  | **STUB**  | 2 / 1             | 0018                                                                                                                                                 |
| `jobs`           | Background jobs / scheduler spine (Trigger.dev port + test driver).                                                                                       | shared  | **STUB**  | 2 / 1             | 0018                                                                                                                                                 |

**Candor:** `cli` is the only BUILT non-substrate package (ADR-0082 sec.3 names `create-caisson`).
`email` (82 LOC) and `jobs` (73 LOC) are port skeletons. `mcp-server` / `license-verify` / `ui` are
structural.

---

## Not in `packages/` (referenced as `@caisson/*` deps)

These resolve from sibling workspaces (`workspaces: tooling/*, registry, services/*`), not
`packages/`. They appear in every package's `devDependencies`:

| Workspace                                                      | Role                                                                                                                               | Key ADRs                                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `tooling/eslint-config`, `tooling/tsconfig`, `tooling/testing` | The single standards gate (`@caisson/eslint-config` / `@caisson/tsconfig` / `@caisson/testing`); one source of lint/tsconfig/test. | 0002, 0022                                                                           |
| `tooling/standards-gate`                                       | Bun standards-gate runner + dependency-cruiser boundary enforcement.                                                               | 0022, 0016                                                                           |
| `registry/` (`@caisson/registry`)                              | Static CI-built `index.json` source-of-truth + allowlist; thin Cloudflare Worker read seam; publish ledger.                        | 0021, [0047](../knowledge/decisions/ADR-0047-registry-readpath-worker-seam.md), 0071 |

`apps/*` (7: admin, agent-dev, ai-kit, base, compliance, local-ai, site) and `services/*` (5: betterstack-adapter, docs,
intel, license, support-bot) are out of scope for this catalog; see [`specs/01-architecture.md`](../specs/01-architecture.md).

## Build-status rollup (STALE — see banner at top of file)

- **BUILT (7) at the 2026-06-28 snapshot:** `kernel`, `tenancy-rls`, `field-crypto`, `auth`_, `billing`_, `credits`, `cli`. (*thin seams)
- **STUB (17) at the 2026-06-28 snapshot:** `audit-worm`, `compliance`, `ai-kit`, `ai-meter`, `prompt-registry`, `ai-evals`, `guardrails`, `ai-config`, `local-ai`, `local-store`, `agent-kernel`, `agent-dev`, `mcp-server`, `license-verify`, `ui`, `email`, `jobs`.

This rollup is the same 2026-06-28 `ADR-0082` sec.3-4 snapshot as every Status cell above and is
**not current** — `docs/build-state.md`'s per-package table (machine-regenerated, `ADR-0253`) is
the live rollup; every package once listed here as STUB now has real, tested, live-transport-proven
code behind it (`ADR-0201`, the Stage-2 build, the 2026-07-06 catalog rework). Kept for lineage —
do not cite this section for current build status.
