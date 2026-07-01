# ADR-0136 — License-keyed registry gating + ships-with-generator tooling opened as Apache-2.0 Base

Status: accepted · 2026-06-30 (store-rework build wave, operator picker Q1 + Fork A) · extends
ADR-0047 (registry read-path Worker seam) and ADR-0071/0077 (entitlement expansion + edition member
pinning) · **amends ADR-0094's open-Base enumeration** (adds `@caisson/cli`, `@caisson/migrate`,
`@caisson/license-verify` to the Apache-2.0 set) and **ADR-0111's publish split** (those three flip
open→npm) · relates ADR-0129 (the à-la-carte SKUs this protects) and ADR-0008 (the MCP entitlement
gate, already correct). Append-only; supersede with a later ADR, never edit.

## Context

The registry Worker's anonymous/community view (ADR-0047) keyed the free set on
`editions.length === 0` — every module carrying no edition tag was served free. But the paid
base-kind commercial primitives (`field-crypto`, `ai-meter`, `audit-worm`, `ai-evals`, `guardrails`,
`prompt-registry`, `local-store`, `agent-kernel`) all carry `editions: []` in `registry/index.json`,
so the Worker served them **free to unauthenticated callers** — undercutting the à-la-carte module
SKUs ADR-0129 just priced. Buying a module still created its `entitlement_grant` and gated
`generate()` correctly (ADR-0008); only Worker **visibility** leaked. Counting the
ships-with-generator tooling (`cli`, `migrate`, `license-verify`) and `pricebook` — all
`editions: []` + commercial — the leak spanned ~12 modules, and the live Worker was fully unfiltered.

Two operator picker forks resolved it:

- **Q1 — gate paid modules by license.** The free floor must require a valid entitlement to serve any
  commercial base-kind module.
- **Fork A — open the ships-with-generator tooling.** `cli` (the `create-caisson` generator), `migrate`
  (the migration assembler `cli` composes), and `license-verify` (the offline verifier embedded in
  every generated app) are not sold à la carte — every buyer's generated repo needs all three. `cli`
  imports `migrate` (commercial), so opening `cli` forces opening `migrate` too (the open-only
  no-depend-up boundary, ADR-0094). `pricebook` (the seller's price catalog) stays commercial + gated.

## Decision

1. **The registry free floor is license-keyed, not edition-keyed.** The anonymous view is the set of
   modules where `manifest.license === "Apache-2.0"` **and** `editions.length === 0` — the open Base
   substrate. A commercial base-kind module (`editions: []` + `LicenseRef-Caisson-Commercial`) is
   never in the free floor; it requires a valid offline Ed25519 license entitlement (extends the
   ADR-0047 filter). **Fail-safe stays to base-open:** any resolver error serves the open floor, never
   a paid module.
2. **Edition entitlements expand to their commercial member modules** (ADR-0071 + the ADR-0077 frozen
   `members` map). A Compliance license delivers `field-crypto` + `audit-worm`; AI Production Kit
   delivers `ai-meter` + `guardrails` + `prompt-registry`; Local-first delivers `local-store` +
   `field-crypto`; Agentic-Dev delivers `agent-kernel` + `local-store`. Derived from each edition
   meta-package's frozen `members` map already in the index snapshot (no ledger edit, no re-issue),
   guarded fail-closed against the module allowlist so a stale pin can never grant a non-indexed id.
3. **The ships-with-generator tooling trio flips to open Apache-2.0 Base:** `@caisson/cli`,
   `@caisson/migrate`, `@caisson/license-verify` → `license: Apache-2.0`, `tier: oss` (no
   `priceCents`), `publishConfig` public/npmjs, and added to the standards-gate `OPEN_BASE_NAMES`. They
   join the free floor. `@caisson/pricebook` stays `LicenseRef-Caisson-Commercial` + gated.

## Why

- **License is the true product boundary; `editions[]` is a composition tag, not a sell/no-sell
  signal.** Keying the floor on license makes the free/paid split coincide exactly with the open-core
  license split (ADR-0094/0097) — one rule, no per-module allowlist to drift out of sync.
- **Fail-safe-to-open means a bug can only ever under-serve.** A resolver error, a forged token, a
  dropped filter option all collapse to "show the open floor" — never "leak a paid module".
- **The tooling trio ships in every generated repo regardless of edition.** Gating it would break
  every buyer's generated app (which imports the offline verifier and runs `migrate`). Apache-2.0 is
  the honest license for code that ships to every buyer; it also lets a buyer inspect the generator +
  verifier, whose baked public key is public by definition.

## How the license change reaches the served index (append-only mechanism)

`registry/index.json` is a deterministic rebuild of the append-only ledger (ADR-0006/0021), and the
`full-tree-index` invariant pins every module's `latest` at `0.1.0`. A version bump was therefore
rejected. The ledger is a pre-launch generated artifact (grown from the 7-module seed to the full set,
ADR-0111): the three trio snapshots were **regenerated in place at 0.1.0** via the real
`appendLedger` serialization path, and `index.json` rebuilt from the ledger — byte-identical to what a
full re-backfill from the current manifests would produce, with a three-line ledger diff. No other
module's snapshot changed.

## Confidence + revisit

**HIGH** — the code landed on `feat/dashboard-unified-and-p6-tail` with all gates green (structural
45/0, license authority 45 packages 0 err, depcruise clean, registry-schema + registry + standards-gate
suites green). The filter takes effect at the operator **DEPLOY** (it is wired in `deploy-entry.ts`);
until then the live Worker still serves the pre-filter view.

## Rejected

- **Keep the edition-keyed floor + a hand-maintained "paid module" allowlist** — drifts; an omission
  silently leaks a paid module (the exact failure mode this closes).
- **Keep `cli`/`migrate`/`license-verify` commercial + add them to a free-tooling allowlist in the
  Worker** — an incoherent "commercial-licensed but free-served" state the standards-gate would have to
  special-case; opening them is cleaner and truthful.
- **Version-bump the trio to republish the license change** — breaks the `latest == 0.1.0` invariant;
  the in-place 0.1.0 snapshot regen is the append-only-equivalent.

## Downstream (this ADR documents code already landed)

- `packages/registry-schema/src/entitlements.ts` — license-keyed `baseModuleIds` free floor +
  `membersOfEdition` expansion (fail-closed allowlist).
- `registry/worker/*` (`entitlement-filter`, `deploy-entry`) — serves base ∪ entitled; non-entitled =
  404; `Cache-Control: private, no-store` + `Vary: Authorization` (no cache leak).
- `registry/ledger.jsonl` + `registry/index.json` — the three trio snapshots regenerated to
  Apache-2.0/oss @0.1.0.
- `tooling/standards-gate/src/checks.ts` — `OPEN_BASE_NAMES += cli·migrate·license-verify`; the
  license⟺tier, open-only-depend, and ADR-0111 publish-split gates all enforce the flip.
- **Un-gating is DEPLOY-gated** — the Worker filter takes effect at the operator DEPLOY.

Evidence: `docs/state/package-catalog.md` + `docs/state/public-surface-minimization.md` (the leak
analysis); the operator's Q1 + Fork A picker (2026-06-30); the landed code on
`feat/dashboard-unified-and-p6-tail`.
