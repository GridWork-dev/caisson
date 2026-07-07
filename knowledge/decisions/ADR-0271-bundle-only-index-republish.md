# ADR-0271 — Registry index goes bundle-only: delist the 3 edition meta-package entries

**Status:** accepted · 2026-07-07 (operator-locked, second picker round — "Republish
bundle-only now"). Extends ADR-0270 (edition-trace purge) to the registry index surface;
reaffirms the ADR-0006 append-only ledger. Append-only; supersede with a later ADR, never
edit. **Tags:** `billing`.

## Context

ADR-0270 purged the four dissolved edition purchase ids from the alias spine, gated on the
zero-real-buyers proof. That proof is now formal: the 2026-07-07 drain EXECUTED with
`drain complete: zero legacy edition grant rows remain` (0 migrated, 0 duplicates —
`docs/deploy/STATE.md`). The registry index still carries the 3 edition meta-packages
(`ai-kit` / `local-ai` / `agent-dev`) as served entries, visible on the public surface as
dead SKUs nothing can purchase or reference.

## Decision

Delist the 3 edition meta-package entries from `registry/index.json` at a dedicated
republish now — not folded into a later natural rebuild. The ledger stays append-only:
their published versions remain in `registry/ledger.jsonl` and their pinned tarballs stay
servable forever; delisting removes only the index entries (discovery + membership
surface). The `EDITION_BUNDLE_ID` fold and the alias mechanism are untouched. The Worker
is redeployed against the rebuilt index in the same act.

Safety rests on the ADR-0270 chain: zero live grants (drain-proven), zero offline tokens
in the wild, and the fail-closed `expandEntitlements` boundary already rejects the purged
ids — no consumer can name the delisted entries.

## Consequences

- The public index surface shows only real SKUs: 6 bundles + sellable modules + base.
- The ui-pro first-publish (separately HELD for the hardening + gallery wave) will be a
  later, independent rebuild — two rebuilds total, by explicit operator choice.
- A delisting mechanism (ledger delist marker or rebuild exclusion) must keep the
  `registry-index` CI check's byte-identical-rebuild property; the implementation ships
  with this ADR's work item.
