# ADR-0402 — The agent-usage fold executes WITH a registry delist: the package had published

- **Date:** 2026-08-09
- **Status:** Accepted (operator lock at the 2026-08-09 reconcile-session picker: "Delist + fold, this wave")
- **Parent:** ADR-0399 (the fold decision) · ADR-0271/0359 (module/version delist machinery)
- **Supersedes:** ADR-0399 §Decision-3 (registry handling) — its "never published, so no delist
  row is needed" premise was false. §Decision-1 and §Decision-2 (the fold itself) stand and are
  executed by this ADR unchanged.

## Context

ADR-0399 locked the fold on a triage read of `registry/index.json` alone. The ledger is the
machine truth (`registry/ledger.jsonl`, append-only), and it carries **11 rows for
`@caisson/agent-usage` across 0.2.0–0.2.9** — gate-attested publishes with tarball rows in
`registry/tarballs.json` and a live index entry (`latest: 0.2.9`, `sellable: false`). The
package is therefore **published-never-sold**, not never-published: the dissolved-meta delist
pattern (ADR-0271, the ai-kit/local-ai precedent) applies, and silently dropping the index
entry without a ledger row would have broken the ledger→index rebuild invariant.

Lane B correctly stopped at this contradiction instead of executing ADR-0399 §3 as written;
the operator re-locked the disposition at the reconcile picker.

## Decision

1. **Module-level delist row** appended to `registry/ledger.jsonl` (op `delist`, ADR-0271):
   published-never-sold surface folded into `@caisson/agent-trajectory` `./usage`. Publish
   history and tarball provenance are **retained** — the ledger stays append-only and the
   delist is terminal for the id (a later publish line for it is a ledger error).
2. **Index rebuilt from the ledger** (`registry/scripts/build-index.ts`): the id drops from
   every future rebuild (54 → 53 modules). The registry Worker serves the rebuilt index only
   after its own redeploy (the index is baked at Worker build time).
3. **The fold executes as ADR-0399 §1–2 specced:** `priceUsage`, the pricebook alias map, and
   the Codex-rollout parser move to `packages/agent-trajectory/src/usage/` behind a new
   `./usage` export (engine adapters behind the subpath; the `.`/`./browser` barrels stay
   engine-neutral); `packages/agent-usage` is deleted; tests move with the code;
   `@caisson/ai-meter` joins agent-trajectory's dependencies.
4. **Reference sweep:** the worker filter's unbundled-non-sellable allowlist empties, the
   everything manifest and registry-schema entitlement notes state the delist, and the
   package census docs drop to 59 packages (17 Apache-2.0 / 42 commercial), 75 Bun
   workspaces.

## Consequences

- Buyers never see a change: the id was `sellable: false`, in no bundle, with zero grants.
- The folded surface first ships to the index at agent-trajectory's next published version
  (minor bump: it gains the `./usage` entry).
- The July t4-memo KEEP-separate disposition stays superseded (ADR-0399); this ADR only
  corrects how the registry records the retirement.
- Triage rule reinforced for future audits: **read the ledger, not the index**, before
  classifying a package's publish state.
