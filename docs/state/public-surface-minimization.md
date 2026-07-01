# Public-surface minimization

**What:** how to MINIMIZE what Caisson gives away publicly while keeping open-core adoption intact —
the current leak (commercial modules served free by the registry Worker), the locked Q1 fix, and the
principled boundary of what stays open vs gated.

**Why:** the open-core premise (ADR-0094) is _give away the substrate, sell the differentiated
modules_. Today the registry Worker over-gives: it keys "free" off edition-membership, not off
license/price, so 8 commercial (`LicenseRef-Caisson-Commercial`, `tier: paid`) modules are pullable
free and unauthenticated. That is revenue walking out the door and a mismatch with the standards-gate,
which correctly marks those same modules commercial.

Ground truth for this doc is disk, not memory: the built `registry/index.json`, every
`packages/*/package.json` + `services/*/package.json` `license` field, every `packages/*/manifest.ts`,
`registry/worker/*`, `packages/registry-schema/src/entitlements.ts`, and `tooling/standards-gate/src/checks.ts`.
Cross-links: [`../packages.md`](../packages.md) (package catalog), [`../build-state.md`](../build-state.md)
(per-package build status), [`./refactor-split-opportunities.md`](./refactor-split-opportunities.md),
[`../adr-index.md`](../adr-index.md), and ADR-0094 / ADR-0097 / ADR-0047.

> Scope note: this is an analysis, not a decision. The gate itself must land as a formal, numbered ADR
> (§5). Prices below are the operator-locked matrix (this session's pricing SOT), which supersedes the
> stale placeholder `priceCents` baked in the manifests (uniform `4900` for every paid non-edition
> module — see §2).

---

## 1. Current public surface — what's pullable free right now

### The free-view rule (the one that leaks)

A module is "free/base" iff its manifest declares **no edition membership**. From
`packages/registry-schema/src/entitlements.ts`:

```ts
// entitlements.ts:73-77 — baseMembers
function baseMembers(index: RegistryIndex): string[] {
  return index.modules
    .filter((m) => latestManifest(m).editions.length === 0) // ← the rule
    .map((m) => m.id);
}
// entitlements.ts:87-89 — exported as the always-served set
export function baseModuleIds(index: RegistryIndex): readonly string[] {
  return baseMembers(index);
}
```

The Worker unions that set into **every** served view, unconditionally:

```ts
// registry/worker/handler.ts:61 — entitledModuleSet
const entitled = new Set<string>(baseModuleIds(index)); // base is ALWAYS in the answer
// ...then base ∪ expandEntitlements(caller's purchased ids)
```

**The rule keys off `editions.length === 0` — NOT off `license`, `tier`, or `priceCents`.** So any
commercial module scoped to no edition (a `kind: base` or `kind: primitive` with `editions: []`) is
classified as free base and served to anonymous callers. That is the leak.

### Current LIVE state: fully unfiltered

The ADR-0047 entitlement filter IS built and wired in `registry/worker/deploy-entry.ts` (it injects
`licenseEntitlementResolver`), but it is **not yet deployed**:

```
registry/worker/deploy-entry.ts:14  "...Until redeployed, the running Worker keeps its current
                                      unfiltered behavior."
registry/worker/handler.ts:150      "This entry serves UNFILTERED — the live deploy uses deploy-entry.ts"
```

So **right now the live Worker serves the entire 27-module `index.json` unfiltered and
unauthenticated** — including all four paid editions (`compliance`, `ai-kit`, `local-ai`, `agent-dev`).
That is the worst-case current surface. The pending ADR-0047 DEPLOY closes the _edition_ half; the
Q1 fix (§2) closes the _base-kind_ half that ADR-0047 alone does not.

### The public surface, from disk (built `registry/index.json`, 27 modules)

**A. Legitimately open — Apache-2.0 / `tier: oss` / `editions: []` (11 modules, keep free):**

`kernel` · `auth` · `tenancy-rls` · `ui` · `billing` · `credits` · `jobs` · `email` · `ai-config` ·
`mcp-server` · `registry-schema`

(These are the ADR-0094 open Base. A 12th Apache-2.0 package, `@caisson/observability` (ADR-0117), is
open but **not yet published to the index**. `@caisson/platform-reads` and `@caisson/license-issue` are
commercial and also absent from the index — server-side surfaces, never distributed.)

**B. The LEAK — `LicenseRef-Caisson-Commercial` / `tier: paid` but `editions: []`, so served in the
free base view (12 modules).** Split by the Q1 lock into gate-these-8 vs keep-tooling-free-4:

| Module            | kind      | manifest `tier` / `license` | Locked price | Q1 disposition      |
| ----------------- | --------- | --------------------------- | ------------ | ------------------- |
| `field-crypto`    | primitive | paid / Commercial           | $199         | **GATE**            |
| `audit-worm`      | primitive | paid / Commercial           | $149         | **GATE**            |
| `ai-meter`        | primitive | paid / Commercial           | $199         | **GATE**            |
| `ai-evals`        | primitive | paid / Commercial           | $199         | **GATE**            |
| `guardrails`      | primitive | paid / Commercial           | $149         | **GATE**            |
| `prompt-registry` | primitive | paid / Commercial           | $99          | **GATE**            |
| `local-store`     | base      | paid / Commercial           | $99          | **GATE**            |
| `agent-kernel`    | base      | paid / Commercial           | $199         | **GATE**            |
| `cli`             | base      | paid / Commercial           | —            | keep free (tooling) |
| `migrate`         | base      | paid / Commercial           | —            | keep free (tooling) |
| `license-verify`  | primitive | paid / Commercial           | —            | keep free (tooling) |
| `pricebook`       | base      | paid / Commercial           | —            | keep free (tooling) |

The 8 gated modules are the differentiated compliance/AI/local/agent primitives — the code buyers pay
for. The 4 kept-free are the entry-point/tooling surface: you cannot gate `create-caisson` behind a
license (it is the installer), you cannot gate `license-verify` behind a license (it is the verifier),
and `migrate`/`pricebook` are consumed by the free base at compose time.

**C. Edition roots — `editions: [<name>]`, gated by ADR-0047 once deployed (4 modules):**
`compliance` · `ai-kit` · `local-ai` · `agent-dev`. These already fail the free-view rule
(`editions.length !== 0`), so they are correctly excluded by ADR-0047 filtering — no Q1 change needed.

---

## 2. The leak + the Q1 fix (locked)

**Root cause:** two enforcement points disagree on "what is paid." The **standards-gate**
(`checkOpenCoreLicensing`, §4) is SPDX-license-keyed and correctly marks the 8 modules commercial. The
**registry Worker** free-set is edition-membership-keyed and treats them as free. Edition membership is
a leaky proxy for "free" — a commercial primitive that happens to belong to no single edition slips
through.

**The fix (Q1 lock): gate on a paid signal, not on edition membership.**

1. **Add a `paid` flag to the index, derived at build time from the PURCHASE_BOOK** (the pricing SOT,
   `packages/pricebook/src/purchases.ts` — `PURCHASE_BOOK` / `PURCHASE_BOOK_VERSION`; cross-checked
   against the manifest `tier === "paid"`, since the manifest `priceCents` are stale placeholders —
   every paid non-edition module carries a uniform `4900`, which the locked matrix supersedes). A
   module is `paid: true` iff it is sold (has a PURCHASE_BOOK-reachable SKU / `tier: "paid"`), MINUS an
   explicit `FREE_TOOLING` allowlist (`cli`, `migrate`, `license-verify`, `pricebook`). Bake the flag
   into `registry/index.json` at build so the Worker never re-derives pricing at the edge.

2. **Redefine the Worker free-set.** `baseModuleIds` becomes: `Apache-2.0 base (tier: oss)` ∪
   `FREE_TOOLING` — **always served**. The 8 paid base-kind modules move OUT of the always-served set
   and require a valid Ed25519 license/entitlement, exactly like editions. Concretely: the free-view
   filter changes from `editions.length === 0` to `editions.length === 0 && !manifest.paid` (plus the
   tooling allowlist). This is a strict extension of ADR-0047 — same offline-verify path
   (`registry/worker/entitlement-filter.ts` → `@caisson/license-verify`), one more class of gated id.

3. **Fail-safe stays biased to base-open, never to serving-paid.** The existing guard in
   `entitledModuleSet` (`handler.ts:56-70`) already degrades a throwing/forged/stale resolver to
   base-only. Under Q1, "base-only" must mean _open + tooling_, so a resolver failure can never serve a
   paid module. Non-entitled paid module = **404** (invisible, indistinguishable from unknown —
   `handler.ts:137`), response `cache-control: private, no-store` + `vary: Authorization`
   (`handler.ts:31-40`) so a filtered answer is never shared-cached to a different buyer.

**Touched surfaces (enumerate before implementing):**

| Surface                                          | Change                                                                                                                                                                                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/registry-schema/src/registry-index.ts` | add optional `paid: boolean` to `RegistryModuleEntry` (default `false`, back-compat)                                                                                                                                                                                        |
| `packages/registry-schema/src/entitlements.ts`   | `baseModuleIds` = open base ∪ FREE_TOOLING; exclude `paid` modules from the always-served set                                                                                                                                                                               |
| `registry/scripts/build-index.ts`                | at build, set `paid` per module from PURCHASE_BOOK ∖ FREE_TOOLING; re-emit `index.json` + rebuild the ledger-derived index (append-only ledger unchanged)                                                                                                                   |
| `registry/worker/handler.ts`                     | free-set uses the baked `paid` flag; unchanged 404 + `private/no-store` posture                                                                                                                                                                                             |
| `registry/worker/deploy-entry.ts`                | no code change — same resolver wiring; behavior change rides the baked flag                                                                                                                                                                                                 |
| tests                                            | `entitlement-filter.test.ts` / `handler-filter.test.ts` / `deploy-entry.test.ts`: assert an anon caller gets open base + tooling ONLY (the 8 paid base-kind = 404); a licensed caller gets base ∪ tooling ∪ entitled; fail-safe degrades to open+tooling, never serves paid |

Grandfather-forward per ADR-0106 / ADR-0129 (§ pricing): buyers holding a valid license before the
gate flips keep access; the gate only changes the _anonymous_ surface.

---

## 3. The principled OPEN vs GATED line

Open-core is a wedge, not a giveaway: the open Base must be **complete enough to build a real app on**
(drives adoption + trust), and the premium modules must be **the differentiated value** (drives
revenue). Draw the line on _license_, not on edition-membership.

**Keep OPEN (the adoption substrate — Apache-2.0, always served, no license):**
`kernel`, `auth`, `tenancy-rls`, `ui`, `credits`, `billing`, `jobs`, `email`, `ai-config`,
`mcp-server`, `registry-schema` (+ `observability` once published). _Why:_ these are the tenancy /
auth / billing-seam / MCP-server scaffolding a buyer needs to stand up the shell before they hit a
paywall. Gating them kills the funnel. Plus the FREE_TOOLING four (`cli`, `migrate`, `license-verify`,
`pricebook`) — the installer/verifier/compose-time plumbing that _cannot_ sit behind a license without
a chicken-and-egg break.

**GATE (the premium module logic — commercial, license-required):** the 8 paid base-kind primitives
(field-crypto, audit-worm, ai-meter, ai-evals, guardrails, prompt-registry, local-store, agent-kernel)

- the 4 edition roots (compliance, ai-kit, local-ai, agent-dev) + their edition-member expansions.
  _Why:_ this is the field-crypto / WORM-audit / spend-metering / eval-gate / on-device-store IP that the
  editions monetize. Serving it free both forfeits the sale and lets a buyer reconstruct an edition from
  its à-la-carte parts without paying the edition price.

**Recommendations to shrink the public surface further (without killing adoption):**

1. **Publish only what buyers install.** Keep server-only surfaces (`license-issue`, `platform-reads`,
   `services/*`) OUT of `index.json` — they already are; keep it that way as a rule, not an accident.
2. **Serve manifest projections, not full manifests, in the anon view.** The `GET /` listing already
   trims to `{id, latest}` (`handler.ts:104-106`); ensure `/index.json` and `/modules/:id` for
   non-entitled callers never leak commercial modules' `members` pin-maps, `dependencies`, or
   `entry`/`agents` paths (recon surface for a would-be reimplementer).
3. **Don't ship compiled premium `dist/` to any public read path.** The Worker serves _metadata_; the
   actual tarballs must sit behind the same license gate, not a public CDN.
4. **Rate-limit the anon catalog** (reuse the ADR-0112 token-bucket shape) to blunt scraping/enumeration.
5. **Treat the `paid` flag as the single gating axis going forward** — new modules inherit gating from
   being sold, so a future commercial primitive can never re-leak by forgetting to add it to a hand-list.

---

## 4. Enforcement (the boundary is already gated in CI — extend it, don't reinvent it)

**Standards-gate is the SPDX authority** (`tooling/standards-gate/src/checks.ts`, ADR-0022/0094/0097):

- `checkOpenCoreLicensing` (`checks.ts:335`, rule `open-core-license`, severity `error`): every
  `packages/*` module ships the license its tier mandates — `OPEN_BASE_NAMES` (`checks.ts:36-51`) ships
  `Apache-2.0`; every other module ships `LicenseRef-Caisson-Commercial`. This is why the 8 leaked
  modules are _correctly_ marked commercial on disk — the leak is purely the Worker ignoring that fact.
- `checkOpenCommercialBoundary` (`checks.ts:361`, rule `open-core-boundary`, severity `error`): an
  `Apache-2.0` package may depend only on other `Apache-2.0` packages (fail-closed — an unresolvable or
  non-open `@caisson/*` dep is a violation). The open Base must resolve against open deps alone, so
  giving away the base can't drag a commercial module in behind it.
- The manifest schema pins the same split (`packages/registry-schema/src/module-manifest.ts:121-128`):
  `license === "Apache-2.0" ⟺ tier === "oss"`, `Commercial ⟺ paid`, and `oss ⇒ priceCents null` /
  `paid ⇒ priceCents > 0`. `defineModule` rejects a drifted manifest at build.
- dependency-cruiser owns the graph-direction half (down-only `base/primitive ↛ edition`,
  `checks.ts:141-160` + `.dependency-cruiser.cjs`), per ADR-0022.

**Add to the gate under Q1:** a check that every `paid` (commercial, non-tooling) module is NOT in the
Worker's always-served set — i.e., assert `index.json`'s baked `paid` flag agrees with
`OPEN_BASE_NAMES` ∪ `FREE_TOOLING`, so the SPDX authority and the read-path free-set can never drift
apart again.

**Pro-private firewall (`CLAUDE.md`, binding):** nothing from `media-pipeline` (pro-private) may seed
any package — patterns/ideas only, never implementation; the harvestable license kit is taken from the
PUBLIC `tessera`. This is an _inbound_ firewall (what may enter the open tree); the Q1 gate is the
_outbound_ firewall (what may leave it). Both must hold.

**Append-only license invariant (ADR-0006 / CLAUDE.md):** locked artifacts are immutable; a license
flip is a forward supersede (ADR), never an in-place edit. The Apache-2.0 re-licensing itself was a
one-way ADR-0094/0097 supersede of the ADR-0050 uniform-commercial stance — the Q1 gate follows the
same discipline: a new ADR, not an edit to an old one.

---

## 5. ADR pointer (this decision needs a formal gating ADR — do NOT write it here)

`knowledge/decisions/` is append-only and numbered; this analysis is not an ADR. The Q1 gating lock —
"gate the 8 paid base-kind modules behind a valid Ed25519 license/entitlement; keep the Apache-2.0
base + the 4 tooling modules always-free; derive the `paid` flag from the PURCHASE_BOOK at index-build;
extend ADR-0047; fail-safe to open+tooling; grandfather-forward per ADR-0106/0129" — must be recorded
as its own ADR at the next docs wave.

**Pending number:** the catalog ceiling on disk is **ADR-0135**; the Q1 registry-gating ADR takes the
**next free number (≥ ADR-0136)**. Register it in [`../adr-index.md`](../adr-index.md) and flip the
open sub-flag in [`decisions-and-forks.md`](./decisions-and-forks.md) on lock.
</content>
</invoke>
