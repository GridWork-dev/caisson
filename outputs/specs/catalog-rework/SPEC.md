---
status: locked
date: 2026-07-06
adr: [ADR-0257, ADR-0258]
tags: [billing, external-system, security, ui, frontend]
program: KICKOFF-D-catalog-program (Stage 3)
---

# Catalog-rework SPEC — bundle objects, carves, brand cut, display

**Goal:** dissolve the four editions into the locked Persona+Provenance bundle set as real,
purchasable catalog objects; execute every G-series carve/flip inside the ADR-0248 ratchet
window; extract the brand layer; and rework the marketplace display so every commercial
package is individually priced and displayed (ADR-0246 F1b) — all at the ADR-0252/0258
numbers. Evidence: the Stage-3 research pass (7 lanes + 6 gap fills, workflow
`wf_51c546a1-d3f`, 2026-07-06); forks locked in two operator rounds (ADR-0257/0258).

## 1. Locks this SPEC executes (fork record — see ADR-0257/0258 for full text)

1. **Bundle model = full rename + first-class bundle schema + alias map** (operator override
   of the stable-ids rec). `registry-schema` gains a `bundle` module kind (additive —
   the 20 historical `kind:"edition"` ledger entries stay valid forever); the four persona
   bundles take new bundle ids; a **resolve-time alias map inside `expandEntitlements` is the
   single alias point** mapping legacy ids (`compliance`/`ai-kit`/`local-ai`/`agent-dev`/
   `bundle`) → new bundle ids. Provenance is a first-class bundle entry (members:
   signing-primitive · audit-worm · field-crypto). A **shared vocabulary constant** exports
   the id set; Kickoff E's RENEWAL_BOOK lookup and any consumer normalize through it (E
   consumes, never re-keys — coordination locked with the E session 2026-07-06).
2. **F7/F8 split = data here, enforcement pattern shared with E** (reconciled with Kickoff E):
   this program builds the pricebook member-effective-dates timeline (F7 data), the F8
   item×bundle upgrade-credit map + checkout crediting, **and** the `entitledSince`
   per-purchased-id claims record + per-member join-date fail-soft filter in
   `registry-schema/entitlements.ts` — as a **sibling** of E's ADR-0255 `updatesWindows`
   record, riding E's plumbing precedent, **sequenced after E's PR #128 merges**. Boundary:
   E owns per-version enforcement (`publishedAt ≤ updatesWindows[id]`) in the Worker; D owns
   the per-member join-date filter in registry-schema. Absent key = grandfathered/unrestricted
   on both axes — never fail-closed against an existing token.
3. **Org module = ONE merged commercial package at $249**: `@caisson/org-controls` = WorkOS
   SSO (`workos.ts`) + the **narrow** membership carve (only the owner-gated multi-user
   surface: `listAccountMembers`/`addAccountMember`/`assertCanManageMembers`, ~40 LOC —
   session-resolution `resolveUserAccounts`/`ensurePersonalAccount`/`selectActiveAccount`
   stays open; the brainstorm's "zero blast radius" claim is refuted and superseded) + the
   **full 6-export** tenancy-rls admin-write layer (the ADR-0249 G6 ambiguity resolved: all of
   `buildAdminWritePolicySql`/`withAdminWrite`/`buildAdminSelectPolicySql`/
   `ADMIN_WRITE_ROLE_BOOTSTRAP_SQL`/`ADMIN_WRITE_ROLE`/`AdminWritePolicyOptions` move) + a
   **new entitlement gate on `/dashboard/members`** (live and ungated today — product work,
   part of this carve). The $199 standalone branch is dead; $249 locked (ADR-0252).
4. **Display = hub-extend + Provenance persona page**: the /marketplace Editions tab becomes
   Bundles (6 cards), the module catalog gains a category facet, Provenance gets a fifth
   persona page on the existing pattern. `pricing.ts`'s 1:1 `edition:` field becomes 1:N
   `bundles: readonly BundleId[]` (registry truth: field-crypto spans 3 bundles). Renewal
   display defers to the dashboard until Kickoff E's plumbing is live.
5. **Local-first = full 3-way carve at $629** (operator pick): `local-sync` $199 ·
   `local-inference` $249 · `local-privacy` $99. Sum 199+249+99+99+199 = 845 → 0.75×845 =
   633.75 → **$629** (25.6% off, below-sum ✓). Engineering order is binding: extract privacy
   first (down-only dep), repoint inference's 5 `EgressGuard` import sites, then extract sync
   (zero cross-concern deps). The G7 exception now covers only `ai-kit`/`agent-dev` metas.
6. **credits joins AI-Production at price = formula recompute**: AI-Production **$739**
   (0.75 × 994 = 745.5 → 739, 25.7% off ✓). credits stays a member (registry truth — ai-kit
   0.3.0 members already pins it; ai-kit/ai-meter hard-depend on it, so removal would recreate
   the ADR-0238 broken-install wall).
7. **Everything = $2,059, full-catalog content**: price = 0.75 × Σ(personas 1,049+739+629+329
   = 2,746) = 2,059.5 → **$2,059** (25.0% off ✓; Provenance $0-incremental, strict subset of
   Compliance). **Content = every sellable SKU including ui-pro**; only `@caisson/brand`
   (private, never sold) is excluded. Supersedes ADR-0251 §5's "no bundle membership" for
   Everything only — ui-pro stays out of the four persona bundles and out of all formula
   inputs. The current `bundleMembers()` (base ∪ edition members over `editions:[]` regardless
   of license) is replaced by an explicit Everything membership rule with a brand/private
   exclusion.
8. **Paddle = big-bang sandbox rebuild** (operator override of additive-first): one dedicated
   Paddle PR after all packages/carves land — create the full target catalog (~16 SKU
   products, the 5 persona/Provenance bundles, Everything, and the renewal price rows),
   re-point the pricebook, true up Kickoff E's placeholder renewal cents to the real ladder,
   retire the 4 edition products in the same sweep. Production Paddle recreation stays a
   separate operator-gated act at the commerce flip (sandbox never ports).

## 2. Scope — what this program builds (grounded current-state per the research pass)

### 2a. Vocabulary + schema (the rename spine)

- `registry-schema`: `MODULE_KINDS` gains `"bundle"`; `EDITIONS` closed enum gives way to the
  shared bundle-vocabulary module (new bundle ids + the legacy-alias map). `membersOfEdition`
  generalizes to `membersOfBundle`; `expandEntitlements` resolves aliases at its single entry
  point (fail-closed TM-E throw semantics untouched; the reserved-ids fail-soft carve-out
  pattern reused for the F7 window filter).
- Hand-copies of the edition list reconciled to the constant: standards-gate `EDITION_NAMES`
  (checks.ts:43-48), site `EDITION_IDS` (pricing.ts:35-45). Golden fixtures pinning
  `kind:"edition"` (4 sites) re-baselined additively.
- License tokens: issued claims stay leaf-expanded module ids (unchanged); the alias map means
  legacy purchased ids never 422/downgrade (server fail-closed and Worker fail-safe paths both
  verified in the research pass).

### 2b. Package extractions (all pre-first-publish per the ADR-0248 ratchet)

| Extraction                             | Source                                                                                                                                                                                                                                                                                                                                                     | New package(s)                                                             | Price      |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------- |
| Compliance 3-SKU carve                 | `packages/compliance` src/{evidence,frameworks,registry}                                                                                                                                                                                                                                                                                                   | `compliance-core` $299 · `frameworks-pack` $249 · `signing-primitive` $199 | ADR-0252   |
| Org module (G4+G6)                     | `packages/auth` (workos + narrow membership) + `packages/tenancy-rls` (6 admin-write exports; ~35-LOC private role-guard duplicated or API-widened)                                                                                                                                                                                                        | `org-controls`                                                             | $249       |
| Billing orchestration (G3)             | `packages/billing` (~93% of LOC: provider.ts, events.ts, paddle-events.ts, lemonsqueezy.ts, polar.ts, idempotency.ts) — verify-only files stay open; LemonSqueezy/Polar verify fns extracted to open files for uniformity; `BillingProvider` port + `DomainBillingEvent` stay OPEN (registry-schema precedent; keeps apps/base's free-floor demo building) | `billing-orchestration`                                                    | $99        |
| Local-ai 3-way carve                   | `packages/local-ai` (privacy → inference repoint → sync)                                                                                                                                                                                                                                                                                                   | `local-sync` $199 · `local-inference` $249 · `local-privacy` $99           | ADR-0258   |
| cli debit decouple → credits flip (G5) | `packages/cli` meter.ts injection port (`GenerationDeps.debit`, required field); credits→devDependency; apps/base wires the concrete debit                                                                                                                                                                                                                 | `credits` flips commercial                                                 | $149       |
| Brand extraction (ADR-0250 G2b step 1) | `packages/ui` brand.tsx + 22 bespoke glyphs + app-shell/credential-strip baked defaults; module-registry `registerIcons()` extension point (server-safe, zero call-site edits); dashboard-shell.tsx passes an explicit brand prop (the one live regression site)                                                                                           | `brand` (private, license-issue pattern)                                   | never sold |
| ui-pro build (ADR-0251)                | new package; 7 components per `outputs/specs/ui-pro/SPEC.md`; floor backfill lands in `ui` same wave                                                                                                                                                                                                                                                       | `ui-pro`                                                                   | $129       |

Every new/carved package: changeset per touched dir (private packages included), greptile-gate
glob + `.greptile/rules.md` row added **in the same PR that creates the package**, standards-gate
license rows (`OPEN_BASE_NAMES` untouched — sources stay open with narrower surfaces; carves are
new commercial names), PRICE_AUTHORITY row per priced SKU.

### 2c. Bundle objects + membership

- New bundle entries (kind `bundle`): Compliance (members grow: compliance-core ·
  frameworks-pack · signing-primitive · audit-worm · field-crypto · tenancy-rls · kernel ·
  alerting · retention-runner) · AI-Production (+ ai-evals fold-in, + credits stays) ·
  Local-first (+ the 3 carve SKUs) · Agentic-Dev (tool-exec already a member) · Provenance
  (net-new) · Everything (explicit full-catalog rule, ui-pro in, brand out).
- Members-fold republish per the ADR-0228 manual ritual: consume changesets → repin bundle
  manifests → `ci-publish-step.ts --dry-run false` → deterministic index rebuild → manual
  drift verification (no CI gate exists; the F5 parity check below closes part of this).
- ai-evals `standaloneOnly` flag drops; RESERVED_MODULE_ENTITLEMENT_IDS stale entries
  (`alerting`, `retention-runner` — both indexed) cleaned in the same wave.

### 2d. F7/F8 commerce mechanics (per lock §1.2)

- `pricebook`: bundle-membership timeline (`Record<bundleId, Record<memberId, ISO8601>>`,
  append-only versioned like PURCHASE_BOOK, backfilled with lock dates) + upgrade-credit map
  (`resolveUpgradeCredit`, fail-closed on unmapped pairs) + checkout crediting reads
  (`bundle − owned` at retail, floor $0, pre-declared — never ad-hoc).
- Claims: `entitledSince` record threaded through license-issue/verify + services/license
  claims construction (after PR #128; sibling of `updatesWindows`; absent = grandfathered).
- Resolver: per-member join-date fail-soft filter in `membersOfBundle` (reserved-ids pattern;
  TM-E throw untouched).

### 2e. Standards-gate catalog checks (ADR-0248 F5, advisory-first)

Four checks per the gap-4 build map: price-coverage (closes the 3-of-19 PRICE_AUTHORITY gap) ·
orphan-SKU (needs the `sellable` manifest field prerequisite so bundle-only glue like
platform-reads is declarable) · catalog↔manifest parity (promotes pricing.test.ts's membership
lint to a gate, generalized to the bundle set) · split-trigger/reserved-ids staleness (warn
tier, fires on the two live stale entries today). Built early in the wave order so the
membership folds are self-verifying.

### 2f. Display + docs + legal

- Marketplace hub: Bundles tab (6 cards incl. Everything), category facet on the module
  catalog (~20 SKUs), Provenance persona page (pattern of the existing 4), ui-pro catalog card
  (the caisson.sh/ui gallery is a separate ADR-0251 build item — a demo surface, not the
  priced listing).
- `pricing.ts`: 1:N `bundles[]` data model; new numbers per ADR-0258; the membership lint
  extends (never bypassed).
- Legal/docs taxonomy (gap-5 inventory): EULA "Compliance Updates" defined term generalizes to
  the bundle-agnostic updates-window term (the ONE binding-text change — operator reviews that
  diff at PR); legal/license summary page restructures around bundles + Provenance + the carve;
  docs tree gains provenance/ (audit-worm + field-crypto relocate out of compliance/) +
  signing-primitive.mdx; llms.txt count/copy; terms/privacy need vocabulary-only/no change.
- 25 "four editions" copy sites + JSON-LD nodes swept at the display flip.

## 3. Non-goals / boundaries

- **Kickoff E owns:** ADR-0255 `updatesWindows` claims rewrite + per-version window
  enforcement (PR #128), renewal plumbing/expiry/FIFO, EULA window copy. This program supplies
  numbers, the vocabulary constant, and RENEWAL_BOOK normalization + net-new rows only.
- **No production Paddle work** — sandbox only; production recreation is operator-gated at the
  commerce flip.
- **No kit stage 2/3** (runtime theme API, public gallery build timing per ADR-0250 G2b) and
  **no wave-1 `./ui` frontends** — sequenced after this SPEC's waves per the kickoff.
- **No `OPEN_BASE_NAMES` removals** except the locked credits flip; the palette/theme move is
  mechanically blocked until the theme API exists (brand cut excludes it — scope-creep guard).
- Grandfathering policy stays operator-owned (ADR-0106 lineage).

## 4. Verification (goal-backward, per bundle/carve)

1. Below-sum invariant re-checked per bundle at build (Compliance 1,049<1,443 · AI 739<994 ·
   Local-first 629<845 · Agentic 329<446 · Provenance 399<547 · Everything 2,059<2,746 — all ✓
   at lock).
2. A legacy id (`ai-kit`, `bundle`, …) resolves through the alias map to the identical leaf
   set the old path produced (round-trip test), server 422-free and Worker downgrade-free.
3. Buyer install proof per carve: a purchased module's install succeeds with ONLY its own
   entitlement (no ADR-0238 wall) — especially local-inference (privacy dep), org-controls
   (role-guard), the compliance carves.
4. `/dashboard/members` denies without the org-controls entitlement, allows with it, dual-logs
   per the admin mutation pattern.
5. Standards-gate green including the four new checks; changeset gate green per PR;
   members-fold drift manually verified post-republish.
6. Display flip: every sellable SKU visible + priced (F1b), the four persona pages + Provenance
   render, EULA defined-term diff operator-approved.

## 5. Open items routed out

- Production Paddle catalog recreation (operator, at commerce flip; the stale
  outstanding-work row refreshes with the target catalog in this program's first PR).
- Cookiy WTP validation (optional, operator-funded, survey 374111) — now also covers
  local-sync/inference/privacy bands if funded.
- PostHog purchase-SKU instrumentation (Linear CAISSON-22).
- Kit stage 2 (theme API) then wave-1 frontends (next program items per ADR-0250 G2b/G2d).
