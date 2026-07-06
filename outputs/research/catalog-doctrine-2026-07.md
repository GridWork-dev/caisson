---
updated: 2026-07-05
status: live
grounds:
  [
    docs/state/package-catalog.md,
    apps/site/lib/pricing.ts,
    tooling/standards-gate/src,
  ]
---

# Catalog doctrine research — editions as bundles over a sellable package catalog

**The operator redirect (2026-07-05, NOT LOCKED).** In the Kickoff-A picker round the R3
compliance-split price fork was _widened, not picked_: instead of choosing a compliance number, the
operator redirected the whole round to pressure-test one direction — **all editions become bundle
options over an individually-sellable package catalog**, with explicit written standards for (a)
what goes OSS/base vs commercial-sold-on-site and (b) when a package must split into its own
sellable surface. This document is the evidence base + FORK QUEUE for that direction. It decides
nothing. Every recommendation below is labeled PROPOSAL and waits for the operator's picker.

This round **folds in the R3 compliance price re-lock** — the compliance split can only ship behind
a superseding ADR against the two numbers it would move: **ADR-0227** (compliance $749→$799,
below-sum invariant) and **ADR-0238** (dropped the four edition-core à-la-carte rows because no
separable "core" artifact exists). Any lock this round produces supersedes those; until the picker,
0227/0238 stand.

Scope note: the two just-locked commerce ADRs constrain every bundle mechanic below —
**ADR-0244** (one-time purchase = perpetual use + 12-month included-updates window + ~40% renewal)
and **ADR-0245** (pooled credit rollover, every grant expires 12 months from issue, FIFO burn).
Neither is reopened here; both are treated as fixed walls the catalog rework must fit inside.

---

## Section 1 — CURRENT STATE (catalog inventory)

Disk truth in this worktree, cross-checked against `docs/state/package-catalog.md`. Discrepancies
are flagged as findings, not resolved.

### 1.1 Package count + license split

`packages/*/package.json` (36 dirs):

- **Apache-2.0: 16** — `ai-config, auth, billing, cli, credits, email, jobs, kernel, license-verify,
mcp-server, migrate, observability, rate-limit, registry-schema, tenancy-rls, ui`
- **LicenseRef-Caisson-Commercial: 20** — `agent-dev, agent-kernel, agent-runner, ai-evals, ai-kit,
ai-meter, alerting, audit-harness (private), audit-worm, compliance, field-crypto, guardrails,
license-issue (private), local-ai, local-store, platform-reads, pricebook, prompt-registry,
retention-runner, tool-exec`

Plus, all commercial and outside the 36: `services/{license,docs,support-bot}` (pyproject) and
`registry/` (npm package, private).

**Finding — doc stale by one:** `package-catalog.md` states "15 enforced-open packages." Disk truth
is **16** — `@caisson/rate-limit` (Apache-2.0, extracted in the PR #119 hygiene wave) is in the
standards-gate `OPEN_BASE_NAMES` allowlist (`tooling/standards-gate/src/checks.ts:84`) and in the
registry index, but appears nowhere in the doc's open-Base table. `@caisson/audit-harness`
(commercial, private, self-described "not a sellable module") is also absent from the doc's tables
entirely, sellable or not.

### 1.2 Sellable catalog today (verified against `apps/site/lib/pricing.ts`, the committed-price file)

- **4 editions** (`EDITION_PRICES`): Compliance **$799** · AI Production Kit **$599** · Local-first
  AI **$349** · Agentic-Dev **$249**.
- **1 bundle** (Everything): **$1,499** vs. $1,996 edition-sum → "$497 saved" badge.
- **11 à-la-carte modules** (`MODULE_PRICES`; the 4 edition-core rows were dropped per ADR-0238):
  `field-crypto` $199 · `audit-worm` $149 · `retention-runner` $199 · `alerting` $149 (Compliance) ·
  `ai-meter` $199 · `ai-evals` $199 (`standaloneOnly: true` — no edition grants it) · `guardrails`
  $149 · `prompt-registry` $99 (AI Kit) · `local-store` $99 (Local-first) · `agent-kernel` $199 ·
  `agent-runner` $49 (Agentic-Dev).
- **Subscription/plan SKUs** (`PLAN_PRICES`): Compliance Updates $1,499/yr · Developer $499/yr ·
  Enterprise (contact). "Per-module" is a computed display row (min $49), not its own SKU.
- **Credit pack $49** (5,000 credits): real in `packages/pricebook/src/purchases.ts` (Paddle live
  price `pri_01kwj71ae0g946ztm4sej7bq76`) but **not surfaced in `pricing.ts`/`catalog.ts`** — a
  backend-only direct-checkout SKU with no storefront row.

Displayed on-site: 4 editions + 1 bundle + 11 modules + 3 plan rows = **19 rows**. Credit pack is a
20th real, priced, sellable item that exists in code but not in the display layer.

### 1.3 How an edition grant works (constrains any bundle rework)

Resolver `packages/registry-schema/src/entitlements.ts::expandEntitlements`, fed by
`registry/index.json` (the single membership source, ADR-0071):

- A purchase carries a **purchased id** (edition slug, the `"bundle"` sentinel, or a bare module
  slug). `PURCHASE_BOOK` (`packages/pricebook/src/purchases.ts`) maps a Paddle price id →
  `{ credits, entitlements: [...ids] }`.
- **Edition membership is NOT self-declared by member packages** — every commercial member carries
  `editions: []` in its own manifest. Membership comes entirely from the edition meta-package's
  frozen `members` map (e.g. `packages/compliance/manifest.ts`), read live off the built index —
  so adding a module to an edition reaches existing buyers with **no license re-issue**.
- Verified live from `registry/index.json`: `compliance` → `{compliance, audit-worm, field-crypto,
tenancy-rls, kernel, alerting, retention-runner}` · `ai-kit` → `{ai-kit, ai-config, ai-meter,
credits, field-crypto, guardrails, kernel, prompt-registry, tenancy-rls}` · `local-ai` → `{local-ai,
kernel, local-store, license-verify, field-crypto}` · `agent-dev` → `{agent-dev, agent-kernel,
agent-runner, ai-config, kernel, local-store, tool-exec}`.
- **Cross-edition sharing is already live**: `field-crypto` is a member of THREE editions;
  `local-store` of TWO. "Editions share primitives" is not a hypothetical of the rework — it is the
  current mechanic. Any "editions are just bundle options" model generalizes a live precedent, not a
  green field.
- Bundle = `base ∪ every edition's members`, index-derived (`bundleMembers`).
- A bare-slug per-module purchase resolves to exactly `@caisson/<slug>` **only if a `PURCHASE_BOOK`
  row exists** — no row → un-buyable standalone regardless of what the resolver could resolve.
- `RESERVED_MODULE_ENTITLEMENT_IDS` (`alerting`, `retention-runner`) is a fail-soft "sold-not-yet-
  indexed" carve-out — **now stale/dead**: both are indexed today.

### 1.4 Orphans — packages in NO edition or with no price path

- **`@caisson/tool-exec`** — commercial, registry-indexed, a member of `agent-dev`'s map, but **zero
  `PURCHASE_BOOK` row + zero `pricing.ts` entry**. Real, built, shipped inside the Agentic-Dev
  purchase, but **cannot be bought standalone today**. The clearest "individually sellable" gap.
- **`@caisson/license-issue`** — commercial, `private: true`, never published (operator-only issuer).
  Correctly excluded; not a gap.
- **`@caisson/audit-harness`** — commercial, `private: true`, self-described non-sellable internal
  tooling. Not a gap, just undocumented (§1.1).
- **`@caisson/pricebook`, `@caisson/platform-reads`** — commercial base-kind, bundle-only substrate,
  intentionally never sold standalone (documented).

### 1.5 Delta: "every package sellable" vs. today

- **Minimum new standalone SKUs: 1.** `tool-exec` is the only built+indexed+commercial package with
  no price path. Adding it is mechanically identical to the other 11 module rows (a `PURCHASE_BOOK`
  entry + a `MODULE_PRICES` row); no resolver change (bare-slug resolution already works generically).
- **No standalone value story** (needs product framing, not just a price): `pricebook`,
  `platform-reads`, `license-issue`, `audit-harness` (infra/back-office, no buyer-facing surface);
  the **4 edition meta-packages themselves** (ADR-0238's wall — each hard-depends on its commercial
  members at the code level; a buyer holding only the "core" fails mid-`bun install`); the **16 open
  packages** (already free, no price to add).
- **Net:** "every commercial package is its own SKU, editions are bundles of SKUs" is _close to
  already true_ — of the 20 commercial packages, minus 4 edition-glue metas, minus 4 non-surface
  infra packages, roughly **1 SKU (`tool-exec`) is missing outright**; the rest is a re-framing +
  pricing-of-the-4-editions-as-bundles exercise, not a large build.

### 1.6 What the standards-gate does NOT yet enforce (relevant to the redirect)

Current checks (`tooling/standards-gate/src/checks.ts`): `checkAgplBoundary`, `checkExternalAgpl`,
`checkDownOnly`, `checkOpenCoreLicensing`, `checkOpenCommercialBoundary`, `checkDeclarations`,
`checkManifestAgreement`, `checkManifestPriceAgreement`, `checkCopyPaste`, `checkRlsEquivalence`,
`checkShippedProse`, `checkChangesetProse`, `checkEntitlementTokenScan`.

- **`PRICE_AUTHORITY` covers only 3 of 19 priced SKUs** (`compliance`, `audit-worm`, `local-ai`).
  Verified live: `ai-kit` manifest carries `priceCents: 49900` ($499, commented "PLACEHOLDER")
  against a $599 site display; `agent-dev` carries `4900` ($49, "pre-launch placeholder") against
  $249. Self-documented, not silent bugs — but 16 of 19 SKUs have no CI tie between manifest price
  and committed site price. "Everything sellable" multiplies this surface (19 → 20+).
- **No check ties a `members` map to package.json workspace deps** the way `checkManifestAgreement`
  ties `dependencies`. The members map is the sole membership source yet is unvalidated against the
  dependency graph — a stale entry silently under/mis-grants.
- **No orphan check**: a commercial, indexed package with no price row and no non-sellable
  declaration (today: `tool-exec`) passes every gate silently.
- **No `RESERVED_MODULE_ENTITLEMENT_IDS` staleness check** (`alerting`/`retention-runner` still
  reserved despite being indexed).
- **`checkDownOnly` has no notion of "edition-glue-only vs. genuinely reusable primitive"** — exactly
  the axis the redirect needs a rule for. ADR-0238's finding was discovered by hand, not a gate.

---

## Section 2 — INTERNAL PRECEDENT (implicit split criteria + OSS-line history)

Reconstructed from what actually became its own package vs. stayed folded, across R1/R2
(`docs/state/refactor-split-opportunities.md`), the harvest program, and the "considered and
rejected" merge section.

### 2.1 The implicit split criteria the repo already uses

1. **Duplication across ≥3 real-or-imminent consumers → extract.** `@caisson/rate-limit` (R1) split
   because `services/docs` + `services/license` had a near-verbatim `TokenBucketLimiter`; a code
   comment named the exact threshold — two copies tolerated, "if a **third surface** needs this, lift
   it." The site's `/api/waitlist` XFF parse was the third → trigger. **Criterion: N≥3.**
2. **A concern marooned on the wrong side of the open/commercial line → hoist.** R2 split not on
   duplication but because a base-only concern (ADR-0112 per-account PG throttle, importing only
   Apache-2.0 `kernel`+`tenancy-rls`) lived inside the _commercial_ `services/license`, creating an
   open→commercial up-dependency. Fix: relocate to the tier its dependency graph already declares.
3. **"Genericness" test for new packages** (harvest, ADR-0135): the two harvested NEW-PKGs
   (`alerting`, `retention-runner`) were accepted as **plain audit-logging primitives**, explicitly
   NOT WORM/tamper-evidence — the doc notes "every 'X-as-WORM' candidate turned out to be ordinary
   audit-logging dressed up as tamper-evidence." A candidate's real technical claim gates package-hood.
4. **A port stays a package however tiny, if it's the swap point.** The rejected-merges section
   refused to merge `ai-config`/`tenancy-rls`/`jobs`/`email` (49–82 LOC each) — each is a
   single-responsibility DI **port** with its own driver-expansion ADR lane. **"The line count is the
   point, not a defect."** LOC is _evidence a boundary is a real port_, never a reason to merge.
5. **A composition root is not dissolvable even when thin.** `ai-kit` (358 LOC) was kept intact
   because it's the _sold SKU boundary_ — "the composition **is** the product." Internal file-splits
   allowed; the package boundary untouchable.
6. **Every executed extraction followed one shape:** "extract shared concern → own package →
   consumers import DOWN, never copy" (`registry-schema` from `registry`, `migrate` from `cli`,
   `platform-reads`). No split ever went the other way (fold two into one).

### 2.2 R3's three surfaces + why they're separable

`packages/compliance` (16 src / 2871 LOC, largest edition; `build-state.md:425`) bundles three
concerns behind one barrel:

1. **Framework catalog** (~836 LOC): `frameworks/{soc2-tsc,hipaa-security,eu-ai-act}.ts` —
   independently versionable **data packs**, not logic. Separability rests on the P7 roadmap naming
   "compliance vertical packs" as a future SKU family (a named buyer for SOC2-alone).
2. **Evidence assembly** (`evidence/{collector,collectors/*,pack-format,generate.ts}`; `generate.ts`
   438 LOC): the flag-never-guess control→pack builder + byte-stable ZIP. This is _logic_, fed by the
   frameworks.
3. **Signing** (`evidence/sign.ts`, 293 LOC): per-tenant Ed25519 + RFC-3161. Explicitly "distinct
   from the Caisson license key" (`sign.ts:8-11`) — a self-contained provenance primitive, plausible
   à-la-carte.

Left over if those three are carved: `with-tenant-crypto.ts` composition, `migrate/assemble.ts`,
`observe.ts`, the unwired `oscal-export.ts` — 429 LOC of glue **not claimed as separable**.

**The load-bearing caveat for the redirect:** R3 is flagged "speculative," gated behind an operator
price re-lock, **never executed**. And **ADR-0238 already tried "make everything inside an edition
separately sellable" and hit a wall** — the four edition-core rows were _dropped, not renamed_,
because each edition meta hard-depends on its commercial members with no separable "core" artifact; a
core-only buyer failed mid-`bun install`. That is direct evidence _against_ assuming "edition → parts"
is generically clean. R3's three surfaces are separable **because they were evaluated concern-by-
concern**, not because decomposition is generically true.

### 2.3 The anti-merge law (thin ports stay thin by design)

Three converging reasons, stated together in the rejected-merges section: **(a) independent
versioning** — each port has its own driver-expansion ADR lane (`email`→SMTP/SES ADR-0119,
`jobs`→pg-boss 0124, `ai-config`→Bedrock/Azure/Ollama 0125); **(b) composability law (ADR-0003)** —
"an edition never copies base code, it depends on the package; a package never depends 'up' on an
edition"; merging `email`+`jobs` makes "compose `email` without `jobs`" impossible; **(c)
standards-gate granularity** — the gates are keyed on package-level boundaries; merging blurs them.
**Smallness never justifies merging; it marks a well-drawn seam.**

### 2.4 Where the OSS line sits, and why (all supersessions named)

- **ADR-0023** (2026-06-27): fully commercial, one AGPL flank. Explicit reversal of ADR-0010's
  open-core lean.
- **ADR-0094** (2026-06-29): reopened by external market research; **Base substrate → Apache-2.0**
  (`kernel, auth, tenancy-rls, ui, billing, credits, jobs, email, ai-config, mcp-server`). Everything
  else commercial. Stated rule: open = "table-stakes… the discovery + trust layer" — chosen because
  "Base alone has no compliance/AI/evidence value," i.e. giving it away gives away nothing sellable.
  The one place graph-depth is explicitly overridden: `field-crypto` + `audit-worm` stay commercial
  _despite_ being base-adjacent because they are **"the differentiating compliance primitives, not
  table-stakes."** Rejected on record: BSL/source-available (wrong threat model — "Caisson sells
  code, not hosting"), MIT (no patent grant), reaffirming fully-commercial (acquisition friction).
- **ADR-0136** (2026-06-30): widens open again — `cli, migrate, license-verify` flip open because
  they "ship in every generated repo regardless of edition"; gating them "would break every buyer's
  generated app." Also re-keys the registry free-floor from `editions.length === 0` (a composition
  tag) to **license SPDX** (the real product boundary). **Stated rule (0136 §Why): "License is the
  true product boundary; `editions[]` is a composition tag, not a sell/no-sell signal."** One SPDX
  rule replaces a drift-prone allowlist.

**Enforcement is three-layer (ADR-0022):** ESLint static-import boundary + dependency-cruiser
(transitive/dynamic reachability, SPDX-blind) + Bun `standards-gate` (the SPDX authority,
import-blind). Each layer's blind spot is another layer's job — the trio, not any one, holds the line.

### 2.5 The gap the redirect is the first real test of

Every open/commercial decision to date has been about **whole existing packages** — never a freshly-
carved sub-piece of a commercial package. There is **no repo-stated rule yet** for what tier a split
piece (e.g. R3's framework-catalog) lands in. The redirect's (b) — decide OSS-vs-commercial per newly-
carved piece — is exactly this untested axis.

---

## Section 3 — MARKET EVIDENCE (cited, all retrieved 2026-07-05)

### 3.1 Per-component vs. suite pricing norms

- **AG Grid** — sells per-_product_, not per-module (its "modules" are a tree-shaking mechanism only,
  no per-feature SKU). Enterprise $999/dev; Enterprise Bundle (grid + charts) $1,498 vs. $1,598 sum =
  **~6% off** — a bundle discount too thin to read as an incentive. Renewal ~$350 vs. $750/$999
  purchase = **~35–47%**, the same order as ADR-0244's ~40%.
  [ag-grid.com/license-pricing](https://www.ag-grid.com/license-pricing/),
  [ag-grid.com/archive/25.0.0/license-pricing.php](https://www.ag-grid.com/archive/25.0.0/license-pricing.php) (n.d.)
- **MUI** — clean 4-rung tier ladder, no per-component SKU: Community (free) / Pro $299 / Premium
  $599 / Enterprise $1,399 per dev/yr, strictly additive. Cleanest good/better/best.
  [mui.com/pricing](https://mui.com/pricing/) (retrieved 2026-07-05)
- **Syncfusion** — the closest analog: **split ONE all-in Enterprise Edition into five separately-
  licensed, separately-renewing editions**, each its own key; individual components renew
  independently of the suite. **Existing whole-suite customers grandfathered** — "even at renewal,
  nothing changes." Pushes an "Unlimited/stop-counting" flat-fee (vendor claims up to 90% at scale).
  [syncfusion.com/blogs/post/essential-studio-editions](https://www.syncfusion.com/blogs/post/essential-studio-editions) (2025-09-05),
  [syncfusion.com/sales/unlimitedlicense/stopcounting](https://www.syncfusion.com/sales/unlimitedlicense/stopcounting) (n.d.)
- **DevExpress** — the most per-component-alive: true per-platform subs alongside the Universal bundle
  ($2,299.99/dev/yr, 2025). **Source-code access is a bundle-only carrot**, never a per-product
  add-on.
  [devexpress.com/subscriptions/universal.xml](https://www.devexpress.com/subscriptions/universal.xml),
  [componentsource 2025 configs](https://www.componentsource.com/news/2025/07/14/devexpress-announces-new-product-configurations-and-pricing) (2025-07-14)
- **JetBrains** — sells both, but **structurally penalizes à-la-carte**: post-Jan-2-2025, new single-
  product licenses lose the year-2/3 continuity discount, steering toward the All Products Pack
  ($299 individual / $979/user commercial). Break-even framing: APP pays off "past ~1 extra IDE" — an
  effectively unbounded bundle discount for polyglot teams.
  [jetbrains.com/all](https://www.jetbrains.com/all/),
  [checkthat.ai/brands/jetbrains/pricing](https://checkthat.ai/brands/jetbrains/pricing) (n.d.)
- **Tailwind Plus** — the one clean **pure-bundle** case: retired all per-template purchase for one
  all-access SKU (personal $299 / team $979, lifetime, future items included). But it's a single-
  product-family, not a 51-package multi-domain catalog.
  [tailwindcss.com/blog/tailwind-plus](https://tailwindcss.com/blog/tailwind-plus) (retrieved 2026-07-05)

**Revealed trajectory:** the market runs **granular-first → consolidate as the catalog grows**
(DevExpress, Syncfusion, Telerik all still show live per-product SKUs and are _now_ pushing bundle-
first without deleting them). **No case found of a vendor going pure-suite from inception at this
catalog scale** and surviving; Tailwind Plus is the lone pure-bundle, at a materially simpler shape.

### 3.2 Bundle-discount norms (% below naive sum)

- General ecommerce/SaaS bundling: **10–25% off sum-of-parts**; SaaS specifically **15–30%**, with
  "clearly below sum, clearly above the core alone" as the shape constraint.
  [fudge.ai/blog/product-bundle-pricing-strategy](https://www.fudge.ai/blog/product-bundle-pricing-strategy/) (2026),
  [getmonetizely bundling psychology](https://www.getmonetizely.com/articles/how-does-price-bundling-affect-customer-psychology-and-revenue-optimization) (n.d.)
- AG Grid's real ~6% is _below_ the norm — a vendor that doesn't lean on bundling.
- JetBrains' break-even-past-1-extra-product is the **stronger lever than a flat %** — the discount
  scales with how many packages the buyer would have bought.
- **Caisson's current Everything Bundle: $1,499 vs. $1,996 sum = ~25% off** (`pricing.ts`) — already
  at the top of the general band.
  [zuora bundling guide](https://www.zuora.com/guides/guide-to-product-bundling-for-saas/) (n.d.)

### 3.3 Choice-overload — helps or hurts

- Iyengar-Lepper jam study: 24 options → 3% purchase; 6 options → 30%.
  [cognitive-clicks paradox of choice](https://cognitive-clicks.com/blog/the-paradox-of-choice/) (n.d.)
- SaaS case: **6 plans → 3 = +17% conversion**.
  [getmonetizely case studies](https://www.getmonetizely.com/blogs/5-in-depth-pricing-transformation-case-studies) (n.d.)
- **Figma, 2025-03-11** collapsed per-product seats into 4 unified seat types explicitly for buyer
  simplicity — a dated, named dev-tool-adjacent SKU _reduction_.
  [figma pricing/seats update](https://help.figma.com/hc/en-us/articles/27468498501527-Updates-to-Figma-s-pricing-seats-and-billing-experience) (2025)
- **Counter-pattern:** Gainsight/Mixpanel moved _toward_ modular à-la-carte — but in **sales-assisted
  enterprise** motions where a rep curates the subset shown. The overload evidence is strongest for
  **self-serve, low-touch** flows. Caisson sells self-serve on-site → the self-serve reading applies.
- "Paradox-of-the-paradox" caveat: choice overload doesn't replicate in every meta-analysis — don't
  over-claim as settled.
  [greenbook paradox of the paradox](https://www.greenbook.org/insights/levelup-research-analytics/the-paradox-of-the-paradox-of-choice) (n.d.)

**The transferable lesson: "individually sellable" ≠ "individually displayed."** Every real per-
component vendor gates deepest granularity behind a secondary "or buy individually" page — the primary
surface is always the tier/bundle ladder. A 51-package catalog implies a **two-layer IA**, not 51
SKUs on one pricing page. Source-code / depth-of-access (DevExpress) is a legitimate **bundle-
exclusive lever** independent of per-package pricing.

### 3.4 OSS-line doctrines

- **GitLab buyer-based open core** — the canonical _written_ standard. Rule: **"who cares most about
  this feature?"** — the buyer persona (IC / manager / exec) sets the tier; IC-features → open,
  manager/exec-features → paid. Codified corollaries: **(1) never move a shipped FOSS feature into a
  paid tier** (one-way ratchet); **(2) ties default to the _lower_ (more-open) tier**; (3) split is
  feature-based, tracked in a `features.yml` SoT with a PM-issue rationale per change.
  [handbook.gitlab.com/handbook/company/stewardship](https://handbook.gitlab.com/handbook/company/stewardship/),
  [gitlab tiering guidance](https://handbook.gitlab.com/handbook/product/product-processes/tiering-guidance-for-features/),
  [opencoreventures feature-based split](https://www.opencoreventures.com/blog/open-core-split-should-be-based-on-features-not-on-code-base) (all n.d.)
- **Crown-jewel / core-differentiator test** — keep only the moat closed, open everything else.
  Agenta lived it: open-sourced eval/prompt/observability, closed only "advanced enterprise collab";
  a first attempt closing evaluation (its real differentiator) _backfired on adoption_.
  [termsfeed dual-licensing vs open-core](https://www.termsfeed.com/blog/dual-licensing-vs-open-core/),
  [agenta journey](https://agenta.ai/blog/commercial-open-source-is-hard-our-journey) (n.d.)
- **Fair Source (FSL/BUSL)** — a _license-timing_ doctrine (source-visible, non-compete carve-out,
  auto-converts to OSS after 2–4 yr), **orthogonal** to feature-split. Solves "will a hyperscaler
  clone my hosted service," NOT "which features go free for adoption." Wrong tool for Caisson (sells
  code, not hosting); flag as a fork only if BYOK/hosting ambitions grow.
  [techcrunch fair source](https://techcrunch.com/2024/09/22/some-startups-are-going-fair-source-to-avoid-the-pitfalls-of-open-source-licensing/) (2024-09-22),
  [sentry FSL](https://blog.sentry.io/introducing-the-functional-source-license-freedom-without-free-riding/) (n.d.)
- **Full-closed-with-mirror-fork (Cal.com "Cal.diy," 2026)** — documented _failure mode to avoid_,
  not a model.
  [cal.com reversal](https://ayvhieel.substack.com/p/why-calcom-went-closed-source-the) (2026)

**Failure-case pattern (decisive):** every "too-closed" blowup — HashiCorp→BUSL/OpenTofu, Sentry→BUSL/
GlitchTip, MinIO console-strip, Cal.com, RHEL source-restrict — involved a **retroactive move**: a
feature/binary that was open getting pulled into paid _after users depended on it_. **Zero incidents
found of a company punished for keeping a _new_ feature closed from day one.** This validates GitLab's
"never move existing FOSS to paid" ratchet as the single highest-leverage clause.
[jeffgeerling corporate OSS is dead](https://www.jeffgeerling.com/blog/2024/corporate-open-source-dead/),
[opentofu/hashicorp saga](https://www.theregister.com/software/2024/04/04/how-hashicorps-license-shakeup-seeded-an-open-source-rebel/1013190),
[minio retrospective](https://www.banandre.com/blog/minio-billion-dollar-exit-strategy-open-source-cautionary-tale) (all n.d.)
Over-open failure is quieter — PostHog notes open-core free→paid conversion is **0.5–2%**; too-
generous starves revenue slowly ("we can't hire") rather than a headline.
[posthog OSS business models](https://posthog.com/blog/open-source-business-models) (n.d.)

### 3.5 Bundle mechanics vs. Caisson's locked walls (ADR-0244/0245/0223)

- **Per-module renewal inside bundles** — Syncfusion runs **independent renewal cycles per edition/
  component**; keygen.sh models entitlements as attachable/detachable units, not a license-wide
  expiry. **Constraint:** if modules become individually sellable with staggered purchase timing,
  ADR-0244's 12-month-updates clock **needs its own date per module**, not one per license — else you
  over-grant (everything rides the earliest clock) or fragment into N license records per customer.
  [syncfusion editions](https://www.syncfusion.com/blogs/post/essential-studio-editions) (2025-09-05),
  [keygen feature-licenses](https://keygen.sh/docs/choosing-a-licensing-model/feature-licenses/) (n.d.)
- **Module→bundle upgrade crediting** — Freemius auto-prorates at checkout **only if the catalog
  pre-declares the standalone→bundle mapping**; Soundtoys formula = `bundle_price − owned_retail_value`;
  Native Instruments credits against _registered activations_ and **invalidates** the credit if the
  qualifying base is later removed; JetBrains credits unused days; Creative-Tim is the manual-coupon
  floor. **Constraint:** self-serve crediting requires a **pre-declared, maintained (module × bundle)
  price cross-reference** + a proration formula — a per-membership authoring cost, or you fall back to
  manual coupons.
  [freemius product→bundle upgrades](https://freemius.com/blog/changelog/introducing-seamless-license-upgrades-from-products-to-bundles/) (2025-11-19),
  [soundtoys upgrade pricing](https://support.soundtoys.com/article/102) (n.d.),
  [jetbrains upgrade/downgrade](https://www.jetbrains.com/help/jetbrains-console/upgrade-or-downgrade-commercial-subscriptions.html) (n.d.)
- **Growing-bundle problem** — JetBrains APP auto-includes new IDEs because it's an **evergreen
  subscription** (funded by renewals). **AG Grid (perpetual) does NOT** — a one-time bundle grants
  only what shipped inside the paid 365-day window; later additions need a renewal. SaaS literature
  converges on **feature-based grandfathering by explicit clause, never implicit**. **Constraint for
  Caisson:** ADR-0244 is _perpetual one-time_ (AG Grid's shape, not JetBrains') — a module added to a
  bundle after purchase should **not** silently become free-forever; it needs the same update-window
  gating, which means the purchase must **snapshot "member modules as of purchase/last-renewal"**
  (mirroring ADR-0228's members-fold pinning).
  [jetbrains APP new-products clause](https://sales.jetbrains.com/hc/en-gb/articles/207240685) (n.d.),
  [ag-grid archive pricing](https://www.ag-grid.com/archive/25.0.0/license-pricing.php) (n.d.),
  [saas grandfathering](https://revreclaim.com/blog/grandfathered-pricing-saas) (2026-03-09)
- **Checkout/registry ceilings** — Paddle: a subscription is one `items[]` array, **no first-class
  bundle object**; every item must **share the same billing interval** (no perpetual-module-price
  mixed with a subscription-billed one in one transaction); self-serve overlay checkout **can only
  shrink a cart, never add**; hard cap **100 line items**/transaction. keygen's versioned-entitlement
  `APP_V1`/`APP_V2` pattern is the direct precedent for **gating registry tarball versions by the
  updates window** (ADR-0223's license-token-authed npm delivery). **Registry gating needs three
  independently-clocked resources:** (a) which modules a token unlocks, (b) each module's updates-
  window end date → which _version_ is servable, (c) the ADR-0245 credit meter (separate trigger:
  grant date, not purchase date) — conflating any two breaks one's math.
  [paddle add/remove items](https://developer.paddle.com/build/subscriptions/add-remove-products-prices-addons) (n.d.),
  [paddle line-item cap](https://developer.paddle.com/errors/subscriptions/subscription_maximum_number_of_line_items_reached) (n.d.),
  [keygen versioned entitlements](https://keygen.sh/docs/choosing-a-licensing-model/feature-licenses/) (n.d.)

---

## Section 4 — CANDIDATE DOCTRINE (PROPOSAL)

The strongest coherent proposal the evidence supports, clearly labeled PROPOSAL. Honest counter-
proposals flagged where the evidence splits. Nothing here is a lock.

### 4.1 Catalog granularity rule — PROPOSAL

**Every commercial, non-private, registry-indexed package is individually _licensable and priced_;
the storefront _displays_ a small curated set (editions/bundles + a secondary "buy individually"
surface).** This is a two-layer IA, matching §3.3's universal market pattern ("individually sellable
≠ individually displayed") and Caisson's own reality (§1.5: ~1 SKU is actually missing; the rest is
re-framing). The default marketed path stays the 4 editions + Everything bundle; per-package is the
secondary curated path — **not 20 SKUs on one page** (§3.3 choice-overload, self-serve flow).

**Honest counter:** the market's revealed trajectory is granular-first-then-consolidate (§3.1), and
Caisson is _already_ consolidated (4 editions). Fully exploding to per-package display would run
_against_ the trend and risk the jam-study conversion hit. The proposal threads this by keeping
display curated — but if the operator wants genuine per-package _marketing_, that is the higher-risk
option and should be named as such.

### 4.2 Bundle discount formula — PROPOSAL

**Keep the current ~25%-off-sum shape** (Everything: $1,499 vs $1,996 = 25%, already top of the
10–25%/15–30% bands, §3.2) **and make editions read as JetBrains-style break-even bundles**: size each
edition so it's obviously correct past ~2 modules wanted (Compliance $799 vs. its 4 modules summing
$696 à-la-carte is _already_ a "buy the edition once you want 3+" story). **Reserve one depth-of-
access lever as bundle/edition-exclusive** (§3.4 DevExpress source-code precedent; candidate:
priority support SLA or the updates window length) rather than pricing every benefit per-package.

**Counter:** AG Grid's ~6% shows a vendor can _choose_ a thin discount to protect per-product revenue.
If per-package sales are meant to be a real revenue line (not just a funnel option), a smaller bundle
discount protects them. The 25% number is a lever the operator owns, not a derived constant.

### 4.3 OSS-line written standard — PROPOSAL (adopt GitLab buyer-based, minus Fair-Source)

Adopt a written standard, one artifact per package/feature, mechanical enough for a solo operator:

1. **One decision question:** _who is the buyer for this capability?_ → resolves to `developer-self-
hoster` (→ open/Apache-2.0) / `compliance-or-security-buyer` (→ commercial) / `procurement-signing-
exec` (→ commercial). (GitLab "who cares most.")
2. **Tie-breaks toward open** — ambiguous package → Apache-2.0 **unless it directly contains regulated-
   compliance IP with independent commercial value** (audit-worm evidentiary logic, field-crypto,
   framework mappings). This is Caisson's existing ADR-0094 differentiator override, written down.
3. **Ratchet clause as a published promise:** _a package that has shipped under an open license is
   never re-licensed commercial_ — as binding as the append-only ADR rule. §3.4's decisive finding:
   every failure was a retroactive close; zero were "kept new thing closed."
4. **Location rule:** the split is **package-based** (whole `packages/*` are Apache-2.0 or commercial)
   — keep it; do NOT regress to GitLab's `ee/`-folder interleaving (Cal.com's `/ee` coupling is
   exactly what made self-hosters unknowingly breach the license).
5. **SPDX is the boundary** (ADR-0136 already law) — not `editions[]`, not an allowlist.
6. **Crown-jewel cross-check runs _after_ the buyer call, not instead:** "does closing this protect
   irreplaceable IP, or gate a commodity a competitor already gives free?" (catches over-closing that
   kills the funnel; §3.4 Agenta).
7. **Fair-Source/BUSL explicitly OUT of scope** this round (§3.4: wrong threat model — Caisson sells
   code, not hosting). Record it as a separate, deferred license-family fork, not conflated with the
   split.

**Counter:** the crown-jewel test (B) could be the primary rule instead of a cross-check. Evidence
says no for Caisson specifically — a compliance-wedge library has _several_ crown jewels across
editions; "keep only the one moat closed" invites over- or under-closing. Buyer-based is the better
primary; crown-jewel stays the cross-check.

### 4.3a Written OSS split-decision checklist (the artifact §2.5's gap needs)

For any newly-carved sub-piece of a commercial package (the untested axis):

- [ ] Buyer question answered (one of the three personas).
- [ ] If tie → open, unless it directly holds regulated-compliance IP with standalone commercial value.
- [ ] Crown-jewel cross-check: closing protects real IP, not a commodity.
- [ ] Ratchet respected: not currently shipping open (if it is, it _stays_ open).
- [ ] SPDX tag set; standards-gate `checkOpenCommercialBoundary` still green (no open→commercial dep).

### 4.4 Split-standard checklist — PROPOSAL (codify §2.1 + §2.2's caveat)

A package **must split** into a sellable surface only when:

- [ ] **≥3 real-or-imminent consumers** of identical logic (R1), OR a concern **marooned on the wrong
      license tier** (R2), OR a sub-surface with an **independently named buyer/use-case** (a roadmap SKU,
      a code-level "distinct from X" statement — R3's frameworks/signing).
- [ ] **Dependency-closure verified**: the carved piece has NO hard dependency chain back to its
      siblings that would break a standalone buyer's `bun install`. **This is ADR-0238's wall — the
      sharpest caution for the redirect.** "Editions minus their core" is NOT generically separable.
- [ ] **NOT split/merged on LOC** — a small package that is the sole swap-point for a driver family
      stays separate regardless of size (anti-merge law, §2.3). Smallness marks a seam, never a merge.
- [ ] **`checkDownOnly` preserved** — no "up" dependency introduced.

**New standards-gate checks the redirect implies** (§1.6): (1) `PRICE_AUTHORITY` covers **every**
priced package, not 3 of 19; (2) an **orphan check** — every commercial, non-private, indexed package
has exactly one of {a price row, an explicit non-sellable manifest declaration}; (3) a **members-map ↔
workspace-deps** validation; (4) a `RESERVED_MODULE_ENTITLEMENT_IDS` staleness flag.

### 4.5 Growing-bundle policy — PROPOSAL (AG-Grid perpetual shape, snapshot-at-sale)

Because ADR-0244 is **perpetual one-time + 12-month updates** (AG Grid's shape, NOT JetBrains'
evergreen): a package added to an edition/bundle after a purchase is **gated by the buyer's updates
window like everything else** — available if inside the paid window, else needs a renewal. The
purchase **snapshots member modules as of purchase/last-renewal** (extends ADR-0228 pinning). No
silent free-forever additions. State this as an explicit clause in checkout/EULA copy (per §3.5;
grandfathering is always explicit, never implicit).

**Counter:** the operator could choose the JetBrains "renewal buys all future additions" generosity as
a _renewal_ incentive (renew → get everything added since). That's a renewal-value lever, compatible
with the perpetual base; name it as an option, not a default.

---

## Section 5 — FORK QUEUE (picker-ready)

Each fork is independent unless noted. Recommendation confidence: **High** (evidence converges) /
**Med** (evidence leans) / **Low** (genuine split / operator-value call). Nothing is locked.

| #      | Fork                                                           | Options                                                                                                                                                                                                                                                                                                                                                                                              | Recommendation + confidence                         | One-line evidence                                                                                                                                                                                                                                                                                                |
| ------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1** | Catalog granularity                                            | (a) every commercial package individually priced, curated display · (b) every package individually priced AND displayed · (c) status quo (4 editions + 11 modules + bundle)                                                                                                                                                                                                                          | **(a)** · **Med**                                   | §3.3 "sellable ≠ displayed" is universal; §1.5 only ~1 SKU actually missing — (a) captures the direction at near-zero build without the jam-study conversion hit of (b).                                                                                                                                         |
| **F2** | Editions become bundles (mechanics + grant migration)          | (a) editions stay meta-packages, re-_labeled_ "bundles" over the same members maps (no code change) · (b) true bundle objects, editions dissolved into pure module sets · (c) hybrid: editions kept as curated bundles, `tool-exec` added as the one missing module SKU                                                                                                                              | **(c)** · **High**                                  | §1.3 members-maps already ARE bundle mechanics + cross-edition sharing is live; §2.2/ADR-0238 shows editions can't fully dissolve (no separable core) — (b) re-hits the install wall; (c) is the minimal real delta.                                                                                             |
| **F3** | Bundle discount formula                                        | (a) keep ~25%-off-sum · (b) JetBrains break-even sizing (bundle wins past ~2 modules) · (c) thin ~6–10% to protect per-package revenue · (d) formula-driven `sum − owned_value`                                                                                                                                                                                                                      | **(a)+(b) combined** · **Med**                      | §3.2 25% is top-of-band and already live; §3.2 break-even framing is the stronger lever; (c) only if per-package sales must be a primary revenue line.                                                                                                                                                           |
| **F4** | OSS-line written standard adoption                             | (a) adopt GitLab buyer-based + ratchet + SPDX-location, Fair-Source out · (b) crown-jewel-primary · (c) leave implicit (ADR-0094/0136 as-is, no written checklist)                                                                                                                                                                                                                                   | **(a)** · **High**                                  | §3.4 buyer-based is the only _written_ solo-operator-mechanical standard; ratchet is the highest-leverage clause (every failure was a retroactive close); §3.4 crown-jewel misfires for multi-moat compliance libs.                                                                                              |
| **F5** | Split-standard checklist adoption                              | (a) adopt the §4.4 checklist + 4 new gate checks · (b) checklist only, no new CI · (c) status quo (hand-judged, per ADR-0238)                                                                                                                                                                                                                                                                        | **(a)** · **Med-High**                              | §2.1 the criteria already exist implicitly; §1.6 the gate gaps are real (`tool-exec` orphan passes silently, 16/19 prices uncovered); ADR-0238 was caught by hand, not a gate.                                                                                                                                   |
| **F6** | R3 compliance split + price shape (folds the R3 price re-lock) | (a) **hold $799, 5-SKU** (compliance meta + frameworks + evidence + signing + a leftover-glue stays bundled) · (b) **hold $799, 3-SKU** (meta + frameworks-pack + signing-primitive) · (c) **signing-only** carve (extract `sign.ts` as a standalone primitive, compliance unchanged at $799) · (d) **raise $899** (split justifies a higher anchor) · (e) **no split**, hold $799 (ADR-0227 stands) | **(c) signing-only** · **Med**                      | §2.2 signing is the one surface with a clean "distinct from license key" separability claim + a non-compliance buyer; frameworks-as-SKUs rest on an un-built P7 roadmap; ADR-0238 warns against assuming clean separability — (c) is the lowest-risk real carve. (d)/(e) are pure price calls the operator owns. |
| **F7** | Growing-bundle policy (future packages)                        | (a) AG-Grid perpetual: updates-window-gated + snapshot-at-sale, no free-forever · (b) JetBrains: renewal buys all future additions · (c) case-by-case ADR per addition                                                                                                                                                                                                                               | **(a), with (b) as a renewal incentive** · **High** | §3.5 ADR-0244 is perpetual one-time (AG Grid's shape, not evergreen); snapshot-at-sale extends ADR-0228 pinning; implicit free-forever contradicts the paid-window model.                                                                                                                                        |
| **F8** | Module→bundle upgrade crediting                                | (a) Freemius auto-prorate (`bundle − owned_retail`), pre-declared module×bundle map · (b) JetBrains unused-days credit · (c) manual coupon (Creative-Tim floor) · (d) no crediting (re-buy)                                                                                                                                                                                                          | **(a)** · **Med**                                   | §3.5 self-serve crediting is table-stakes for a per-package catalog; requires a maintained price cross-ref (authoring cost) — (c)/(d) push friction onto the exact buyer the redirect wants to enable; Paddle has no bundle object so the map must live in `pricebook`.                                          |

**Cross-fork dependency:** F6's price shape is gated against ADR-0227 ($799) + ADR-0238 (catalog
math) — any F6 lock except (e) needs a superseding ADR. F2(c) + F1(a) together are the minimal
"editions-as-bundles" realization (add `tool-exec`, re-label, curate display). F7 + F8 are the
mechanic tail that any per-package catalog needs regardless of F1–F6.

---

## Section 6 — WHAT THIS DOES NOT TOUCH

Out of scope this round; do not let the picker drift into them:

- **Subscriptions** — Compliance Updates $1,499/yr, Developer $499/yr, Enterprise (contact) stand as-
  is (`PLAN_PRICES`). This round is one-time catalog shape, not recurring plans.
- **Registry delivery mechanics** — ADR-0223's license-token-authed self-hosted npm registry
  (`registry.caisson.sh`, packuments + tarballs) is a fixed wall the catalog fits inside, not a thing
  this round re-opens. §3.5's three-clock constraint is a _requirement on_ the rework, not a change to
  delivery.
- **The launch runbook / DEPLOY** — Paddle SANDBOX→live flip, the edge revocation deny-set, migrations,
  the checkout/EULA copy flip. Any price or window a lock touches becomes runbook copy _after_ the
  lock, in a separate operator-gated act.
- **ADR-0244 / ADR-0245** — the perpetual-updates window and credit policy are treated as fixed; this
  round designs the catalog to fit them, never reopens them.

---

**Next step:** dedicated catalog-rework spec session (see `outputs/kickoffs/` —
`KICKOFF-C-catalog-rework.md`) — no lock exists until that picker.
