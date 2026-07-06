# ADR-0255 — Per-entitlement updates windows: the signed claim becomes a map, filtered per module at the edge

**Status:** accepted · 2026-07-06 (Kickoff-E SHIP-audit picker — the security audit's
single-scalar-coarsening finding, operator-locked above the accept-and-record recommendation).
**Supersedes ADR-0251 Decision 1 IN PART:** the claim SHAPE (one scalar `updatesUntil` per
account) is replaced; everything else in ADR-0251 stands — claim + edge filter as the mechanism,
absent claim = unbounded, the re-mint rule (Decision 3), renewal SKUs (4), per-pair DB extension
(5), and copy posture (6). Extends ADR-0244 (the 12-month window), ADR-0010 (offline Ed25519 —
still ONE token, no second artifact). Append-only; supersede with a later ADR, never edit.
**Tags:** none at lock; the build inherits `billing`.

## Decision

1. **The signed claim is `updatesWindows`: a map `purchasedEntitlementId → ISO instant`,**
   replacing the scalar `updatesUntil`. Claims already carry purchased ids (not expanded member
   slugs) — the map keys match `entitlement_grant.entitlement_id` exactly. An absent map, or an
   absent key for an entitlement, = unbounded (the same pre-launch grandfather posture; the
   pre-window golden tokens keep pinning absent-field back-compat). Subscription-sourced
   entitlements carry NO window entry — their own `expiry` claim governs, untouched.
2. **The issuer computes each entry per `(account_id, entitlement_id)` pair** over that pair's
   active `one_time` grant rows: `COALESCE(max(updates_expires_at), min(granted_at) + 12 months)`
   — the same formula ADR-0251 used account-wide, now scoped to the pair. No cross-entitlement
   min/max coupling: renewing one module extends exactly that module; a new purchase starts its
   own fresh 12 months.
3. **The edge filters per module.** A member module's effective window is the MOST FAVORABLE
   among the purchased ids that grant it (unbounded wins; else the max instant) — owning a module
   à-la-carte and via an edition means the better window applies. All five read surfaces filter
   with the per-module window: `/`, `/index.json`, `/modules/:id`, the npm packument, and the
   tarball route.
4. **The re-mint comparison (ADR-0251 Decision 3) compares canonical maps** (sorted keys), not
   scalars; byte-identical reuse when unchanged.

Rejected: **accept + record** — the coarsening carried both a revenue over-grant (the cheapest
renewal extended every entitled module) and a buyer under-grant (a fresh purchase inherited the
account's older window); fixing it pre-launch is cheap, post-launch it is a token-migration.
**Tighten-to-MIN** — kills the over-grant by making every lapsed module drag the whole account
down; buyer-hostile. **A second edge artifact** — still rejected per ADR-0251/0010.

## Consequences

- `extendUpdatesWindow` (ADR-0251 Decision 5) is already per-pair — the DB layer is unchanged;
  only the claim computation, the claim schema, and the edge filter move from scalar to map.
- Claim size grows O(#purchases) — bounded by the catalog (≤ ~20 keys), negligible.
- The renewal refund un-extend follow-up (ADR-0251 §Consequences) is unaffected and stays open.
