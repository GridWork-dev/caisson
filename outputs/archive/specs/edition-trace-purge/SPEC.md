---
status: draft
date: 2026-07-07
adr: [ADR-0270]
tags: [security, billing, data-migration]
program: edition-trace-purge (pre-launch cleanup)
linear: CAISSON-26
supersedes-in-part: [ADR-0257, ADR-0258]
---

# Edition-trace purge SPEC

**Goal:** delete every trace of the four dissolved editions and the stale legacy purchase
vocabulary while **zero real buyers exist** — the one window where this churn is free — WITHOUT
touching the alias _mechanism_ that module renames and the W1 carve extractions depend on forever.
The purge narrows the alias spine to nothing-but-the-mechanism and repoints every site that still
_mints_ a legacy id; it never drops a key an offline perpetual token could still read.

**Evidence / ground truth:**

- Operator lock: `docs/state/decisions-and-forks.md` → "2026-07-06 research-kickoff picker" item 1
  ("delete all trace of the editions + stale legacy code now"; supersedes-in-part the alias-forever
  posture of ADR-0257/0258; ADR lands with the purge PR; the spec must separate removable edition
  aliases from load-bearing module-rename/carve aliases — fable-audit class).
- Work row: `docs/state/outstanding-work.md` §2 "Edition-trace purge (pre-launch, operator-locked)"
  — "Delete archived-edition SKUs, stale legacy code paths, and **narrow** the alias spine while
  zero buyers exist (churn free ONLY pre-launch)." (Linear CAISSON-26.)
- The alias spine: `knowledge/decisions/ADR-0257-catalog-rework-spec-locks.md` §1 (single
  resolve-time alias point) + `ADR-0258-catalog-pricing-consequence-locks.md` (the carve numbers).
- The code: `packages/registry-schema/src/bundle-vocabulary.ts`,
  `packages/registry-schema/src/entitlements.ts`, `packages/registry-schema/src/module-manifest.ts`,
  `packages/pricebook/src/purchases.ts` + `renewals.ts`, `services/license/src/entitlement-store.ts`,
  `registry/ledger.jsonl`.

**This is a SPEC. No purge code lands in this stage.** The PLAN sequences the edits; EXECUTE writes
them behind the ordered gate in §5.

---

## 1. Why now, and why the split is the whole job

`expandEntitlements` (`registry-schema/entitlements.ts`) is **fail-closed** (threat TM-E): an
unknown purchased id THROWS and rejects the buyer's ENTIRE id set. So "delete the aliases" is not a
one-line map edit — dropping an alias entry that any live grant row or offline token still carries
turns a paying buyer's whole expansion into a 500. The purge is safe **only** because two facts
hold, and the SPEC's job is to make the purge honor both:

1. **Zero real buyers** hold the legacy edition ids (operator lock; §4 proves it against the live DB
   rather than assuming it).
2. The alias _point_ (`normalizeEntitlementId`) is the **same** mechanism that carries module
   renames and carve extractions forward forever — so the purge must narrow the DATA it holds
   (edition entries) while preserving the FUNCTION and its single-point discipline.

Everything below hangs on separating **(a) removable edition aliases** from **(b) load-bearing
module-rename/carve aliases**.

---

## 2. (a) EDITION aliases — REMOVABLE (zero real buyers)

The four dissolved edition SKU ids and the legacy 1499 "buy-everything" `bundle` sentinel. These
exist only because the editions were sold before ADR-0257 dissolved them into the six bundles; with
zero real buyers, nothing but sandbox/test grants (§4) can hold them, so the DATA is removable.

| Trace                                                                                                                         | Site                                                | Disposition                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alias map entries `ai-kit`→`ai-production`, `local-ai`→`local-first`, `agent-dev`→`agentic-dev`, `bundle`→`everything`        | `bundle-vocabulary.ts` `LEGACY_ENTITLEMENT_ALIASES` | **DELETE (4 entries)** — after §5 gate                                                                                                                                                               |
| Identity entry `compliance`→`compliance`                                                                                      | same map                                            | Cosmetic: the `?? id` pass-through already returns `compliance` unchanged. Drop or keep; **`compliance` the id is NOT edition-trace** — it is the live compliance bundle id.                         |
| `BUNDLE_ID = "bundle"` sentinel + its `@deprecated` doc                                                                       | `entitlements.ts`                                   | **DELETE** once no mint site emits `"bundle"` (repointed in §5.1)                                                                                                                                    |
| `EDITIONS = [compliance, ai-kit, local-ai, agent-dev]` as a **purchase vocabulary** + `kind:"edition"` as a sold tier         | `module-manifest.ts`                                | **Narrow, do not delete blindly** — see §3 caveat: enum + `kind:"edition"` are still index-resolution machinery for the append-only ledger. Remove only paths treating an edition id as purchasable. |
| PURCHASE_BOOK rows emitting `entitlements` of `ai-kit` / `local-ai` / `agent-dev` / `bundle` on current sandbox prices        | `pricebook/src/purchases.ts` (~L95–L124)            | **REPOINT** to canonical bundle ids (`ai-production` / `local-first` / `agentic-dev` / `everything`) — this stops NEW purchases minting legacy ids. Do FIRST (§5.1).                                 |
| RENEWAL_BOOK rows `renewsEntitlement` of `ai-kit` / `local-ai` / `agent-dev` / `bundle` + the `normalizeEntitlementId` bridge | `pricebook/src/renewals.ts` (L36–L39, L114)         | **REPOINT** row values to canonical ids; the `normalizeEntitlementId(renewsEntitlement)` bridge becomes a no-op and is dropped in the same change.                                                   |
| Archived edition products in the Paddle SANDBOX catalog (4 prices retired at the W7 big-bang)                                 | Paddle sandbox (external)                           | **Out of code scope** — verify archived; do not delete the historical price objects (Paddle keeps them for past transactions). Runbook note only.                                                    |

**Removable ≠ remove-first.** Every DELETE row is gated on §5. Repoint the mint sites (pricebook)
and drain the grant rows (§4) BEFORE the map entries come out, or the fail-closed cascade fires.

---

## 3. (b) MODULE-RENAME / CARVE aliases — LOAD-BEARING FOREVER

The alias **mechanism**, not any specific edition datum. Module renames and the ADR-0258 W1 carve
extractions (local-first 3-way carve → `local-sync` / `local-inference` / `local-privacy`; the
`ai-kit` / `agent-dev` metas) resolve through the **same** `normalizeEntitlementId` point the
edition ids used. An offline perpetual Ed25519 license token signed with an old module slug MUST
verify forever (`@caisson/license-verify`; the kernel signs `canonicalize(parse(claims))`, so a
dropped alias silently changes the resolved member set for a token that is otherwise
cryptographically valid). **NEVER drop a key an offline token still reads — extend to a paid
horizon, never drop** (the standing license-seam rule; the hygiene-session BLOCKING gotcha).

| Load-bearing surface                                                                                            | Site                                                                                  | Rule                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `normalizeEntitlementId` — the single resolve-time alias point                                                  | `bundle-vocabulary.ts` / called in `expandEntitlements`                               | **KEEP the function and its single-point discipline.** After the purge its map may be empty; it stays because the NEXT module rename adds an entry here, and no caller pre-normalizes. |
| `entitlementIdAliasGroup` — read-side reverse (grant-row matching across old + new spellings)                   | `bundle-vocabulary.ts`; consumed by `services/license/src/entitlement-store.ts` (L20) | **KEEP.** Grant lookups must still match every stored spelling of a still-aliased id. Empty group (`[canonical]`) is the correct degenerate result once edition entries are gone.      |
| The single-alias-point invariant in `expandEntitlements` (one `normalizeEntitlementId` call, no caller re-keys) | `entitlements.ts` L334                                                                | **KEEP.** The purge must not scatter or inline normalization — that is the exact regression ADR-0257 forbade.                                                                          |

**The discriminator (state it in the ADR):** an alias entry is removable iff **no live grant row
and no issuable/issued perpetual token can carry its key** (edition ids: provably true pre-launch,
§4). An alias entry is load-bearing iff a signed token or a sold module could reference the old key
— the permanent condition for module renames/carves, so those entries (whenever they exist) are
never dropped; they are extended, never removed.

---

## 4. Sandbox / test grant rows carrying legacy ids

The operator lock asserts zero **real** buyers; the live `entitlement_grant` table
(`services/license/src/entitlement-store.ts`: one row per `(account_id, entitlement_id text,
source_kind)`) may still carry sandbox/test grants written under the old vocabulary. The purge must
**prove** the assertion, not trust it, because the fail-closed cascade (§1) makes a single missed
row a lockout.

Ordered handling (the PLAN turns this into a migration + a runbook step, `data-migration` tag):

1. **Enumerate.** `SELECT account_id, entitlement_id, source_kind, status, subscription_id,
purchase_id, granted_at FROM entitlement_grant WHERE entitlement_id IN
('ai-kit','local-ai','agent-dev','bundle')` (read-only; run against the live license DB before
   any code change).
2. **Classify** each row real-vs-test against the account (test tenants / seeded fixtures / the
   admin-comp source). The operator confirms the real-count is 0 (the lock's premise); if any row is
   genuinely a real buyer, **STOP** — the free-churn premise is false and grandfathering is back on
   the table (re-open the fork; do not proceed).
3. **Resolve the test rows** (a genuine data-migration; choose per row, recorded in the ADR):
   - **Migrate** to the canonical id via `entitlementIdAliasGroup` (`ai-kit`→`ai-production`, etc.)
     if the row must survive as a working test grant; OR
   - **Delete** the row if it is a disposable fixture.
     Idempotent, reversible, checksum-blessed like the CAISSON-16 migration-drift procedure;
     WORM / dual-log the admin mutations per the existing grant-mutation path.
4. **Prove empty.** Re-run the enumerate query → **zero rows** is the gate that unlocks §5's
   map-entry deletion. This is the goal-backward proof that dropping the aliases cannot lock anyone
   out.

In-repo fixtures (test suites that grant `ai-kit` / `bundle` / etc.) are migrated to canonical ids
in the same PR so the suites still exercise the alias-group read path against a _surviving_ alias (a
module-rename stand-in), not a dropped one.

---

## 5. Ordered removal sequence (the fail-closed dependency chain)

Strict order — each step's gate is the prior step's proof. Reordering re-introduces the cascade.

1. **Repoint mint sites.** `pricebook/src/purchases.ts` + `renewals.ts` emit canonical bundle ids;
   drop the now-dead `normalizeEntitlementId(renewsEntitlement)` bridge. **After this, no new
   purchase or renewal can mint a legacy id.** (packages/\* → changeset for `@caisson/pricebook`.)
2. **Drain grant rows** (§4 steps 1–4) → prove-empty gate.
3. **Delete the 4 edition alias entries** from `LEGACY_ENTITLEMENT_ALIASES`; drop the redundant
   `compliance` identity entry (cosmetic). Keep `normalizeEntitlementId` / `entitlementIdAliasGroup`.
   (changeset for `@caisson/registry-schema`.)
4. **Delete the stale legacy code paths** only edition-trace kept alive: the `BUNDLE_ID` sentinel,
   the `fullCatalogMembers` deprecated derivation (once the `everything` bundle entry is guaranteed
   indexed — verify `hasBundleEntry` is always true in the shipped index first), and any
   `membersOfEdition`-era naming. Keep `membersOfBundle`'s index-resolution machinery (§3 caveat).
5. **Retire the edition purchase-vocabulary** treatment: stop treating `EDITIONS` / `kind:"edition"`
   as a sellable tier in commerce paths. See the §3-caveat boundary below.

**§3 caveat — the append-only registry ledger.** `registry/ledger.jsonl` carries immutable
`kind:"edition"` entries for `@caisson/ai-kit`, `@caisson/local-ai`, `@caisson/agent-dev`,
`@caisson/compliance` across versions 0.1.0–0.2.2 (ADR-0006 append-only; ADR-0257 explicitly kept
them: "no ledger rewrite"). The index-side resolution machinery (`EDITIONS`, `legacyEditionNamesFor`,
`membersOfBundle`'s `kind:"edition"` branch) is **load-bearing for the published index**, not
edition-trace — dropping it silently downgrades resolution of a served artifact. Therefore:

- The purge scopes to the **purchase-id / alias / mint** layer (steps 1–5 above).
- A bundle-only **index republish** (retiring the edition meta-packages from the served index so the
  edition-membership machinery becomes genuinely dead code) is a **separate, operator-gated decision
  the PLAN surfaces, not the SPEC decides** — and if taken, it appends a superseding ledger/index
  state, never edits the immutable ledger. Until then the machinery stays.

This is the "**narrow** the alias spine" the outstanding-work row asked for: shrink the data and the
mint surface to zero, keep the mechanism and the append-only history intact.

---

## 6. Non-goals

- No new grandfathering machinery (the whole point — the operator chose purge over grandfathering).
- No edit to any existing `knowledge/decisions/ADR-*.md` (append-only); the purge decision lands as
  **ADR-0270** (§8).
- No rewrite of `registry/ledger.jsonl` or any locked artifact (ADR-0006).
- No Paddle **production** catalog change (production recreation stays the operator-gated commerce
  flip, ADR-0258 §5); sandbox archival is verify-only here.
- No purge code in this SPEC stage.

---

## 7. Tags + audit routing

- **`security`** — the entitlement/license seam. `expandEntitlements` is the fail-closed
  authorization boundary (TM-E over-expansion); a mis-ordered purge is an authorization regression
  (lockout of paying buyers, or — the worse direction — over-grant if a dropped alias silently widens
  a fallback). Runs the security audit at SHIP.
- **`billing`** — entitlement / pricebook / renewal money mappings change (mint-site repoint).
- **`data-migration`** — live `entitlement_grant` rows are enumerated and migrated/deleted (§4);
  fires the migration-safety + rollback check.
- **NOT `secrets`.** No credential, env var, key, or `~/.gridwork` change — the task explicitly
  rejects the `secrets` tag. The Ed25519 issuer/verifier keys are untouched; the concern is _which
  ids a valid signature resolves to_, not the keys themselves.
- **Fable-audit class.** Per the caisson binding (CLAUDE.md §Subagent model routing), the license /
  money / entitlement seam gets the security auditor on the **fable** lane — the fail-closed cascade,
  the offline-token key-drop rule, and the order-of-operations gate are exactly its remit. Reviewer =
  `gw-code-reviewer` (opus); security = `gw-security-auditor` (fable).

---

## 8. ADR

Drafts as **ADR-0270** (main ceiling is 0269; renumber-at-merge per ADR-0088 if a collision
appears). It records: the purge decision, the removable-vs-load-bearing discriminator (§3), the
grant-row disposition (§4, per-row migrate/delete), the append-only-ledger boundary (§5 caveat), and
that it **supersedes-in-part** ADR-0257/0258's alias-forever posture _for the edition ids only_ (the
module-rename/carve alias mechanism from those ADRs is reaffirmed, not superseded). Append-only;
lands with the purge PR.

---

## 9. Verification (goal-backward, run at VERIFY)

The purge achieved its goal iff:

1. **No mint site emits a legacy id.** grep `packages/pricebook/src` for
   `ai-kit`/`agent-dev`/`local-ai`/`"bundle"` in `entitlements` / `renewsEntitlement` values → zero.
   New purchase/renewal fixtures resolve to canonical bundle members.
2. **The grant table is clean.** The §4.4 enumerate query returns zero rows on the live DB.
3. **The alias mechanism survives.** `normalizeEntitlementId` + `entitlementIdAliasGroup` still
   exported; a unit test adds a _fake_ module-rename entry and asserts it resolves through the single
   point + the read-side group — proving the mechanism is intact for the next rename (the
   load-bearing guarantee, tested independently of the now-empty edition data).
4. **No over-grant, no lockout.** `expandEntitlements` still throws (TM-E) on a genuinely unknown id;
   a canonical bundle id expands to exactly its member set; a dropped edition id (`ai-kit`) now
   **throws** (correct: no one holds it) rather than silently resolving — and §4.4 proves no one
   holds it. The `everything` fallback path is unchanged or removed-with-proof (`hasBundleEntry`
   always true).
5. **Gates green** from the worktree root: `bun run check`; `bunx turbo run test
--filter=@caisson/registry-schema --filter=@caisson/pricebook`; PGlite license suites with
   `--concurrency=1`; `bun run sot` advisory-clean; changesets present for both packages.
