# ADR-0270 — Edition-trace purge: delete the dissolved-edition purchase ids and narrow the alias spine to nothing-but-the-mechanism, while zero real buyers exist

**Status:** accepted · 2026-07-07 (edition-trace-purge program, operator-locked
2026-07-06 research-kickoff picker item 1 — "delete all trace of the editions + stale legacy
code now"; SPEC `outputs/specs/edition-trace-purge/SPEC.md`, Linear CAISSON-26).
**Supersedes-in-part** ADR-0257 (catalog rework — the six-bundle vocabulary) and ADR-0258
(catalog pricing) **for the four edition purchase ids ONLY**: their "legacy ids resolve
forever through the single alias point" posture is retired now that zero real buyers hold
them. The module-rename / carve alias MECHANISM those ADRs established is reaffirmed, not
superseded. **Numbering note:** filed at the `main` ceiling (0269) from the
`feature/license-seam-wave` branch; a cross-branch collision renumbers at merge per ADR-0088.
Append-only; supersede with a later ADR, never edit. **Tags:** `security`, `billing`,
`data-migration`.

## Context

ADR-0257/0258 dissolved the four editions (`compliance` / `ai-kit` / `local-ai` /
`agent-dev`) into the six persona bundles and kept every legacy purchased id resolving
forever through one resolve-time alias point (`normalizeEntitlementId`,
`packages/registry-schema/src/bundle-vocabulary.ts`). That "alias forever" posture was the
correct default WHILE buyers might hold a legacy id. Pre-launch, the operator chose the
opposite: with **zero real buyers**, this is the one free-churn window to delete every trace
of the editions and the stale legacy purchase vocabulary — before the first real token is
signed and grandfathering becomes mandatory.

The obstacle is `expandEntitlements` (`entitlements.ts`), the fail-closed authorization
boundary (threat TM-E, over-expansion): an unknown purchased id THROWS and rejects the
buyer's ENTIRE id set. Dropping an alias entry a live grant row or offline token still
carries would turn a paying buyer's whole expansion into a lockout. So "delete the aliases"
is safe only because two facts hold, and this ADR makes the purge honor both.

## Decision

Purge the **edition purchase ids** and the stale legacy purchase vocabulary; keep the alias
**mechanism** and the append-only ledger/index machinery intact.

### 1. The removable-vs-load-bearing discriminator (the whole job)

An alias entry is **removable** iff **no live grant row and no issuable/issued perpetual
token can carry its key**. An entry is **load-bearing forever** iff a signed offline token or
a sold module could reference the old key — the permanent condition for module renames and
the ADR-0258 W1 carve extractions, so those entries (whenever they exist) are extended, never
dropped. The edition ids are provably removable pre-launch (§3 below proves it against the
live DB, not by assumption); the module-rename mechanism is load-bearing.

### 2. Narrow the purchase-alias spine to empty

`LEGACY_ENTITLEMENT_ALIASES` loses its four edition entries (`ai-kit`→`ai-production`,
`local-ai`→`local-first`, `agent-dev`→`agentic-dev`, `bundle`→`everything`) and the redundant
`compliance`→`compliance` identity entry. The map is now **empty**; it stays because the next
module rename plugs one entry in here (value type widened to `string` so a rename maps an old
bare slug to a new one, not only an edition→bundle). `normalizeEntitlementId` and the
read-side `entitlementIdAliasGroup` are **kept** — every read-back that folds stored grant ids
(`extendUpdatesWindow`, `reconcileCoverageGrants`, `subscriptionCoverageHorizons`,
`reverseRenewalExtensions`) keeps calling `entitlementIdAliasGroup` so it picks the next rename
up for free. The `BUNDLE_ID = "bundle"` sentinel export is deleted.

### 3. Keep the edition→bundle INDEX relation, decoupled from the purchase spine

The historical `kind:"edition"` ledger/index entries (`@caisson/ai-kit`, `@caisson/local-ai`,
`@caisson/agent-dev`; `registry/ledger.jsonl` 0.1.0–0.2.2) stay served forever (ADR-0006
append-only; ADR-0257 "no ledger rewrite"), so a bundle purchase must still fold the members
its legacy edition meta-package contributes. That edition→bundle relation moves OUT of the
purchase spine into a decoupled `EDITION_BUNDLE_ID` map in `entitlements.ts`, read only by
`legacyEditionNamesFor` + `fullCatalogMembers`. Result: every live-index expansion and every
offline-token member set is **byte-identical** to pre-purge (the resolver golden changed only
its `purchased` labels, never a member). A dissolved edition id, if any grant still carried it,
resolves ONLY to its still-served meta package via the ordinary indexed-module branch — a
fail-safe UNDER-grant, never the whole former edition, and never a widen (proven in the
resolver + real-index tests).

### 4. Grant-row disposition (data-migration, the prove-empty gate)

The live `entitlement_grant` table may carry sandbox/test grants under the old vocabulary.
The purge PROVES the zero-real-buyers premise rather than trusting it:

1. **Enumerate** (read-only): `SELECT … FROM entitlement_grant WHERE entitlement_id IN
('ai-kit','local-ai','agent-dev','bundle')`, run against the live license DB before any
   code change.
2. **Classify** each row real-vs-test. If any row is a genuine real buyer, **STOP** — the
   free-churn premise is false, grandfathering is back on the table, re-open the fork.
3. **Resolve** the test rows via the idempotent, logged cleanup script
   (`services/license/scripts/drain-legacy-edition-grants.sql`): migrate each legacy id to its
   canonical bundle id (`ai-kit`→`ai-production`, …; a colliding canonical twin deletes the
   legacy dup instead), or the operator deletes a disposable fixture. Checksum-blessed like the
   CAISSON-16 drift procedure; **run manually at DEPLOY, never from CI or a worktree** (it is
   NOT wired into the auto-applied numbered-migrate path).
4. **Prove empty**: re-run the enumerate query → zero rows is the goal-backward proof that the
   emptied aliases cannot lock anyone out.

### 5. Repoint every mint site

`packages/pricebook/src/purchases.ts` + `renewals.ts`: the four archived-edition + bundle-
sentinel rows now emit canonical bundle ids, so no new purchase/renewal mints a legacy id and a
replay of a historical sandbox event grants the canonical id. `resolveRenewal` drops its now-dead
normalization. Version stamps bumped (append-only). No production site surface minted a legacy id
(the W7 catalog `apps/site/lib/catalog.ts` already grants canonical bundle ids); the legacy
`/ai-kit` marketing URL renders the AI-Production bundle for SEO continuity and grants the
canonical id — it is not edition-trace.

## Boundary (out of scope — the append-only ledger)

The index-side resolution machinery (`EDITIONS`, `legacyEditionNamesFor`, `membersOfBundle`'s
`kind:"edition"` branch, the `fullCatalogMembers` fallback) is **load-bearing for the served
index**, not edition-trace — dropping it silently downgrades a served artifact. It STAYS. A
bundle-only index republish (retiring the edition meta-packages so that machinery becomes truly
dead code) is a **separate, operator-gated decision**, and if taken appends a superseding
ledger/index state — it never edits the immutable ledger (ADR-0006). Paddle **production**
catalog recreation stays the operator-gated commerce flip (ADR-0258 §5); sandbox archival is
verify-only. No credential/env/key change (not `secrets`): the Ed25519 issuer/verifier keys are
untouched — the concern is only which ids a valid signature resolves to.

## Consequences

- The purchase-alias spine is empty and honest: an edition id is no longer purchasable or
  normalizable, and the fail-closed boundary never over-grants from a dropped alias.
- The mechanism survives, tested independently (a fake `old-widget`→`new-widget` rename resolves
  through the single point + the read-side group), so the next module rename is a one-entry map
  edit with no scattering.
- The prove-empty gate is a hard precondition: if the enumerate query is non-empty with a real
  buyer, the purge does not proceed.
