# CANDIDATES-KIMI — media set + marketplace/cart overhaul

Independent candidate slate from kimi-k3, design lead. Opinionated, committed, grounded in the
repo as built. Every identifier quoted in the interactive specs was verified against package
source (paths cited inline). One of two slates; the operator decides at the candidates review.

## Grounding (verified facts that shape the slate)

- The sellable catalog is **26 modules + 6 bundles = 32 entries**, not "14 + 6" as the brief
  states. Source: `apps/site/lib/pricing.ts` (`MODULE_PRICES`, 26 rows; `BUNDLE_PRICES`, 6 rows)
  and `apps/site/lib/marketplace-surface.ts` (`ALL_ENTRIES`). I design for 32.
- The marketplace grid is `13rem facets · minmax(0,1fr) results · 21rem rail` inside a 1140px
  `cs-container` (`apps/site/components/marketplace.module.css` `.surface`;
  `packages/ui/styles/base.css` `.cs-container`). At max width the results column gets ≈484px,
  so the two card columns render ≈230px wide. The cramped read is arithmetic, not taste.
- A cart drawer **already exists and ships**: native `<dialog>` right slide-over
  (`apps/site/components/cart-drawer.tsx`, `cart.module.css` `.drawer` = `min(24rem,100vw)`,
  `inset: 0 0 0 auto`), mounted once in `app/layout.tsx`; nav `CartTrigger` on both breakpoints
  (`components/cart-trigger.tsx`, `site-nav.tsx`); `addItem` auto-opens the drawer and fires
  `view_cart` once per open (`components/cart-provider.tsx`); full review lives on `/cart`
  (`components/cart-view.tsx`) and hands to auth-gated `/dashboard/cart`. The marketplace also
  carries a mobile `<details>` bottom dock at ≤56.25rem (`.stackDock`, ADR-0374).
- Detail pages **already have their own add-to-cart**: module pages carry a sticky `BuyRail`
  plus a `MobileBuyBar` (`app/(marketing)/marketplace/modules/[slug]/page.tsx`); the five
  persona bundle pages carry three `AddToCartButton` placements each; the marketplace
  `PreviewDialog` closes itself on add so the drawer never stacks under it.
- The homepage stack module is `StackBuilderLazy`, section 11 of 15 on
  `app/(marketing)/page.tsx`, sitting directly after the "Six bundles" section and the SKU
  matrix. `/stack-fit` already exists as the honest adapter-matrix page
  (`app/(marketing)/stack-fit/page.tsx`).
- Media pipeline: `SlideKind = "diagram" | "component" | "code-artifact" | "image"`
  (`apps/site/lib/media-manifest.ts`). 24 `DiagramKey`s (3 ADR-0377 bespoke schematics + 21
  shared mechanism diagrams). 6 modules ship live `component` slides (`MODULE_COMPONENTS`:
  ui-pro, audit-worm, ai-meter, prompt-registry, local-store, credits). Schematic primitives
  exist and are locked: `Sheet`/`SNode`/`Flow`/`Boundary`/`ByteStrip`/`TitleBlock`/`Chip`,
  340×190 viewBox, hairline non-scaling strokes, one accent per sheet
  (`apps/site/components/schematics.tsx`). Carousel chrome (arrows with 2.75rem hit areas, dots,
  aria-live caption) and `MediaFrame` are done (`components/media-carousel.tsx`,
  `media-frame.tsx`).
- Tokens: `--cs-*` only, both themes via `data-theme`, 44px (2.75rem) invisible-hit-area
  precedent in `marketplace.module.css` `.cardCompare::before`, `media-carousel.module.css`,
  `cart-trigger.module.css`. Grid utilities `cs-grid--2/3/4` collapse at the ADR-0100 ladder
  (lg 60rem, md 48rem). Type: Hubot Sans / Martian Mono.

Build rules every option below inherits: token system only (both themes), 44px touch-target
floor, honest-artifact floor (every name exists in `packages/*`, cited), reduced-motion safe,
no new palettes, no backend calls from any proposed component.

---

## A) Media-set compositions

Context: migrate-all-24 is locked, so every option includes the remaining schematic build:
24 module sheets to go (field-crypto, audit-worm done of 26) + 5 bundle cross-sections to go
(compliance done of 6) = **29 sheets** at roughly 0.5–1 dev-day each on the existing primitive
kit. The 21 shared mechanism diagrams retire as their target pages get bespoke sheets (the
ADR-0377 pilot precedent: the sheet REPLACES the shared diagram on its own page).

### Option A1 — "The sheet floor" (lean)

Per-module set (2–3 slides):

1. Bespoke schematic sheet (the claim).
2. Code-artifact slide, single-sourced from `MODULE_PAGES` (zero marginal build; the manifest
   already resolves it).
3. Live `component` slide only where it already exists (the 6 `/ui` surfaces).

Per-bundle set (2 slides): cross-section strata sheet + the parametrized composition slide
(real member chips onto the Apache-2.0 base).

Depth-page carousel order: sheet → component (artifact omitted per WR-03; it renders in the
page body). Card viewer order: sheet → artifact → component.

Build cost: 29 sheets ≈ **15–29 dev-days** + trivial manifest wiring. No new slide kind, no
new chrome.

Verdict: honest but static. It tells the claim and shows the code; it never lets the buyer
touch the proof. For a product whose entire positioning is "the artifact is the repo", a
read-only media set under-sells the one thing no competitor can fake: runnable behavior. Not
enough.

### Option A2 — "Sheet + poke + artifact" (recommended)

Per-module set (3–4 slides):

1. Bespoke schematic sheet.
2. **One interactive** (the "poke"): a self-contained client component running a deterministic
   in-browser simulation of the module's shipped mechanism, one paradigm per module class,
   specced in section B. ui-pro is the exception: its existing live component slide IS the
   poke (the product is a component kit), no new build.
3. Code-artifact slide.
4. Live `component` slide where it already exists.

Per-bundle set (2–3 slides): strata sheet + composition slide + the hero member's poke reused
verbatim as slide 3 (Compliance borrows the field-crypto bench, AI-Production the ai-meter
console, Agentic-Dev the lifecycle stepper, Local-first the RRF explorer, Provenance the
tamper lab, Everything stays strata + composition). Bundles borrow, never fork: the poke is
the same component the module page renders, so marginal cost per bundle is one manifest line.

Depth-page order: sheet → poke → component (artifact in body). Card viewer order: poke →
sheet → artifact → component. The poke leads the card viewer because it is the only slide
kind that stops a scrolling buyer mid-gesture.

Build cost: A1's 15–29 dev-days + the interactive kit from section B (a shared deterministic
sim kit ≈2 days, 4 flagships at 2–3 days each, 12 class rigs of which 8 are pattern-only at
1–2 days each, 21 pattern-grade instances at 1–1.5 days each, plus golden-file parity tests)
≈ **+41–65 dev-days**. Call it 11–19 weeks single lane end to end; two parallel lanes
(sheets / interactives) land it in 6–10 weeks of calendar.

Verdict: the floor that matches the positioning. The sheet states the mechanism, the poke
proves it under the buyer's cursor, the artifact shows the code that ships. This is the
media-set floor I would lock.

### Option A3 — "A2 + the produced loop" (heavy)

Everything in A2, plus a Remotion-produced 6–9 second silent loop per module (the repo already
carries `apps/site/remotion/` + `remotion.config.ts`): the sheet draws in, the poke cycles its
three states, the frame bar carries the package name. The loop becomes the card-viewer lead
slide and the social/OG-adjacent teaser asset; depth pages keep the interactive lead.

Per-bundle set: strata + composition + hero poke + loop.

Build cost: A2 + loop template (~3 days) + 26 parametrized renders (~0.25 day each) + poster
and reduced-motion wiring (~2 days) ≈ **+11–12 dev-days over A2** (67–106 dev-days total).

Verdict: garnish on a plate that is not served yet. Loops sell after the interactive floor
exists, and they rot the first time a mechanism changes (the loop is a second artifact to
keep honest). Defer to a later kickoff; do not block the floor on it.

---

## B) Interactive components ("the poke")

One paradigm per module class. Every paradigm is a shared rig; each module instance feeds the
rig its own real names and data. All are `"use client"` components under
`apps/site/components/poke/`, loaded via `next/dynamic({ ssr: false })` exactly like the
existing demos (`ai-meter-demo.tsx` precedent), wrapped in `MediaFrame`, carrying an honest
one-line caption, pinned by golden-file tests against package fixtures (the repo's
golden-regression convention). Sample inputs are visibly labeled as samples; every control is
≥44px; all state transitions honor `prefers-reduced-motion`.

### The paradigm-per-class table (all 26 modules covered)

| Class               | Modules (rig : instances)                                                              | The poke                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crypto & signing    | field-crypto (flagship F1) · signing-primitive                                         | Seal/open workbench: transform a value under one identity, watch every other identity fail to open it. signing-primitive instance: verify a detached Ed25519 signature and read its RFC-3161 countersign receipt (labels per `pricing.ts` blurb; adjacent verified name `verifyAnchorSignature`, `packages/audit-worm/src/chain-store.ts`; package API wired at build).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Ledger & evidence   | audit-worm (flagship F2) · credits                                                     | Append-and-break chain lab. credits instance: grant lines typed by `GRANT_EVENT_TYPES` (`"purchase"`, `"sub_allotment"`, `"topup"`, `"feature_grant"`, `packages/credits/src/credits.ts`), then a debit walks FIFO and an empty balance throws the real `InsufficientCreditsError` 402 (`packages/kernel/src/errors.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Metering & money    | ai-meter (flagship F3) · billing-orchestration                                         | Reserve/reconcile console. billing-orchestration instance: redeliver one webhook twice, watch it fulfill exactly once, with `DomainBillingEvent` type chips (`"purchase.completed"`, `"subscription.created"`, …, `packages/billing/src/events.ts`) across the four provider tabs (Paddle, Stripe, LemonSqueezy, Polar).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Guard & gate        | guardrails (flagship F4) · tool-exec · local-privacy · org-controls · retention-runner | Verdict gate: type the input, watch the boundary's typed verdict. tool-exec: propose an argv, the default-deny allowlist over Zod-strict argv answers, never a shell. local-privacy: type a host, the `EgressGuard` answers against `localOnlyPolicy` / `ZERO_EGRESS_POLICY` (`packages/local-privacy/src/egress-guard.ts`). org-controls: toggle `Role = "owner" \| "seat"` (`packages/auth/src/membership.ts`); the owner mutation lands two rows (mutation + audit), the seat is denied. retention-runner: fan out one erasure across targets with per-target error isolation, exactly one reason-tagged audit row, `ERASURE_CRYPTO_SHRED = "erasure.crypto-shred"` (`packages/field-crypto/src/crypto-shred.ts`).                                                                                                                                                                                                                                                                               |
| Retrieval           | local-store                                                                            | RRF explorer: a baked 8-doc corpus, the vec0 leg and the FTS5 leg ranked side by side, fused by Reciprocal Rank Fusion with a `RRF_K = 60` slider (`packages/local-store/src/store.ts`); a no-vector toggle degrades to keyword-only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Sync                | local-sync                                                                             | Converge two devices: two replica columns take offline edits, `reconcileWithTombstones` (`packages/local-sync/src/reconcile.ts`) merges them through the logical clock (`HlcStamp`) to one converged state, tombstones and all.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| On-device inference | local-inference                                                                        | Stay on the box: the prompt runs against the on-device backend (`OnnxEmbeddingBackend`, `DEFAULT_ONNX_MODEL`, `EMBEDDING_DIM` spark strip, `packages/local-inference`), the egress meter reads zero; opting into a `RentedInferenceBackend` visibly crosses the boundary.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Agent governance    | agent-kernel · agent-runner · agent-trajectory                                         | Lifecycle stepper + run replay. agent-kernel: click transitions across `ACTS = ["spec","plan","execute","verify","sweep","eval","ship"]`, `canTransition` verdicts, a failed VERIFY reopens PLAN, an illegal skip throws (`packages/agent-kernel/src/lifecycle.ts`). agent-runner: the child env built from scratch (`buildEngineEnv`, `PASSTHROUGH_KEYS`, `CLAUDE_CLI_PROFILE`, `packages/agent-runner/src/agent-runner.ts`) streaming to a `.jsonl` transcript. agent-trajectory: an `EVENT_KINDS` timeline (11 kinds, `"tool.proposed"` → `"tool.approved"` → `"tool.result"`, …, `packages/agent-trajectory/src/schema.ts`) where sensitive bodies show as `DigestRef` and `project()` replays to the same projection every time.                                                                                                                                                                                                                                                               |
| Compliance evidence | compliance-core · frameworks-pack · access-review · risk-register · trust-page         | Control board: typed verdicts into a deterministic artifact. compliance-core: six collector cards (`rlsForceCollector`, `chainVerifyCollector`, `wormRetentionCollector`, `fieldCryptoPolicyCollector`, `aiRiskRegisterCollector`, `impersonationCollector`) flip `EvidenceStatus = "pass" \| "flagged" \| "unresolved"`; `generateEvidencePack` refuses while any is unresolved (`EvidencePackBlockedError`, `packages/compliance-core/src/evidence/generate.ts`). frameworks-pack: pick a clause, map it to a control, export an OSCAL v1.2.2 snippet (`OSCAL_VERSION = "1.2.2"`, `toOscalCatalog`). access-review: approve/revoke each reviewee, close the campaign with one undecided, watch it flag unresolved, never auto-approve. risk-register: likelihood × impact sliders produce the computed residual (never caller-supplied); an override lands as a chained exception. trust-page: toggle fields against the redaction allowlist; a non-allowlisted field never reaches HTML or JSON. |
| Alerting            | alerting                                                                               | Pipeline push: one event through dedup → rate-cap with digest fallback → timezone-aware quiet hours → multi-channel delivery; every outcome lands an audit row.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Eval                | ai-evals                                                                               | Baseline gate: run scores against the committed JSON baseline; a drop past tolerance fails the build; re-blessing is a deliberate click, never a silent pass (module artifact: "The fail-closed regression compare", `packages/ai-evals/src/baseline.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Prompt assets       | prompt-registry                                                                        | Move the alias: `name@version` rows (the shipped `PromptBrowser` surface stays as the component slide), promote the alias pointer to a version, roll it back, the registry stays append-only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| UI kit              | ui-pro                                                                                 | No new build. The existing live component slide (data grid + hash-chained audit timeline) is the poke.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

The open-base packages (observability, tenancy-rls, kernel, auth, billing, jobs, email,
ai-config, mcp-server) are not sellable SKUs; the hub's "Every bundle sits on this" section
already markets them, and the floor above does not require pokes for them.

### Flagship F1 — field-crypto: "The envelope bench"

- One line: `Seal a value as one tenant. Watch every other tenant fail to open it.`
- Anatomy (MediaFrame, three stacked zones):
  1. Inputs: tenant segmented control (`tenant-a` / `tenant-b`, labeled as samples), key
     version stepper, plaintext field prefilled with a sample value.
  2. The envelope: the real byte layout rendered on the schematic `ByteStrip` primitive:
     `[ver 1B | alg 1B | key_version u16 BE | nonce 12B | ciphertext | tag 16B]`, measures
     labeled from the package constants `FORMAT_VERSION = 0x01`, `ALG_AES_256_GCM = 0x01`,
     `NONCE_BYTES = 12`, `TAG_BYTES = 16` (`packages/field-crypto/src/envelope.ts`).
  3. Verdict line + StatusChip.
- Interaction: `Seal as tenant-a` runs REAL crypto in-browser: WebCrypto HKDF-SHA256 with the
  literal info string `caisson-field-crypto:v{keyVersion}:{tenantId}` (`deriveInfo`,
  `packages/field-crypto/src/derive.ts`, `TENANT_KEY_BYTES = 32`) feeding AES-256-GCM with the
  AAD 4-tuple from `buildAad(tenantId, keyVersion, columnContext, rowId)`
  (`packages/field-crypto/src/aad.ts`). `Open as tenant-b` derives tenant-b's key and the GCM
  tag verification fails: the shipped cross-tenant isolation claim, proven under the cursor
  (the module blurb: "a cross-tenant read fails to decrypt in the test suite, every run").
  `Rotate key version` mirrors `KeyVersionRegistry.rotate(tenantId)`
  (`packages/field-crypto/src/registry.ts`); the old envelope still opens because the
  self-describing envelope carries its `keyVersion` (the sheet caption's "old key versions
  decrypt forever"). Nonces are drawn per run exactly like the shipped `encryptField`
  (`packages/field-crypto/src/encrypt-field.ts`); a "replay the golden vector" toggle pins the
  fixed nonce from `packages/field-crypto/src/__golden__/envelope.json` for byte-identical
  deterministic output, asserted by a golden test.
- Names cited: `encryptField` / `decryptField` (encrypt-field.ts), `deriveTenantKey` /
  `deriveInfo` / `TENANT_KEY_BYTES` (derive.ts), `FORMAT_VERSION` / `ALG_AES_256_GCM` /
  `NONCE_BYTES` / `TAG_BYTES` (envelope.ts), `buildAad` (aad.ts), `KeyVersionRegistry.rotate`
  (registry.ts), `sealField` / `openField` (column.ts).
- Cost: 3 dev-days incl. golden test.

### Flagship F2 — audit-worm: "Break the chain"

- One line: `Append. Anchor. Then edit history and watch the verdict flip.`
- Anatomy: a 5-entry chain strip (seq · payload · short hash per entry, entry shape
  `{ seq, prevHash, payload, hash }` per `packages/kernel/src/canonical.ts`), a tamper button
  on each historical row, an anchor panel, a verdict line carrying the real `RowStateChip`
  labels ("Verified", "Tampered", "Chain root",
  `packages/audit-worm/src/ui/row-state-chip.tsx`).
- Interaction: `Append entry` extends a REAL chain computed live in-browser (WebCrypto
  SHA-256 over canonical payloads, mirroring `buildChain` / `chainEntry`,
  `packages/kernel/src/audit-chain.ts`; the kernel itself stays out of the browser bundle, the
  same constraint the existing demo documents in `audit-worm-demo.tsx`, and a golden test
  pins one entry hash against kernel output for parity). `Tamper this row` edits one past
  payload and `verifyChain` returns the real `ChainVerification { valid, brokenAt }` shape:
  every link after the edit breaks. `Cut the tail` deletes the last entry: the surviving
  prefix hashes clean but the anchor panel fails it, because `verify()` treats the store as
  the trusted length oracle (the sheet caption's claim, made playable). The anchor panel
  mints an `AuditChainAnchor` in the golden shape `{ length, tipHash, genesisHash }`
  (`packages/audit-worm/src/__golden__/anchor.json`) at the real key layout
  `{account_id}/audit-chain/anchors/<12-zero-padded length>.json`, with a
  `RetentionMode = "GOVERNANCE" | "COMPLIANCE"` toggle (`packages/audit-worm/src/store.s3.ts`)
  computing the retain-until date from `MIN_RETENTION_YEARS = 6` /
  `DEFAULT_RETENTION_YEARS = 7` (`packages/audit-worm/src/retain.ts`).
- Names cited: `AuditChainStore.append` / `AppendResult { entry, anchor }` (chain-store.ts),
  `buildChain` / `verifyChain` / `chainEntry` / `canonicalize` (kernel audit-chain.ts),
  `ChainVerification` (kernel canonical.ts), `RetentionMode` (store.s3.ts),
  `MIN_RETENTION_YEARS` / `DEFAULT_RETENTION_YEARS` / `retainUntilFrom` (retain.ts),
  `RowStateChip` labels (row-state-chip.tsx).
- Cost: 3 dev-days incl. parity test. The existing `ChainViewer` component slide stays as the
  module's `component` slide; the poke is the argument, the viewer is the artifact.

### Flagship F3 — ai-meter: "The breaker console"

- One line: `Reserve before you spend. Reconcile to the cent. Trip before the invoice.`
- Anatomy: a run configurator (model select, prompt-size slider, hard-cap stepper), a ledger
  readout, a scripted-run button row, and a breaker lamp.
- Interaction: the model select lists the REAL `BUNDLED_PRICE_BOOK` keys
  (`"anthropic/claude-sonnet-4.5"`, `"openai/gpt-4o-mini"`, `"anthropic/claude-3-5-haiku"`,
  `"google/gemini-1.5-flash"`, `"openai/text-embedding-3-small"`,
  `packages/ai-meter/src/pricebook.ts`, with `PRICE_BOOK_VERSION = "2026-07-06"` in the frame
  bar). Prompt size drives `estimateUsage` (`CHARS_PER_TOKEN = 4`,
  `DEFAULT_OUTPUT_TOKENS = 1024`, `packages/ai-meter/src/estimate.ts`). `Reserve` previews the
  real `ReserveResult` fields (`reservedCredits`, `balance`, `spent`, `softExceeded`,
  `breakerTripped`, `idempotent`, `windowKey`, `packages/ai-meter/src/meter.ts`) computed with
  the package's pure math (`computeCost`, `creditsForMicroUsd`, integer micro-USD end to end,
  ADR-0007). `Run` draws a scripted actual from the golden case
  (`packages/ai-meter/src/__golden__/cost.json`: input 12000, cached 8000, output 800 →
  `costMicroUsd: 1680`, `credits: 2` at `microUsdPerCredit: 1000`) and `reconcile` trues the
  reservation up. `Runaway loop` fires repeated reserves until the cap crosses: the real
  `SpendCapError` (`code = "spend_cap_reached"`, `httpStatus = 402`,
  `packages/ai-meter/src/breaker.ts`) lands, the breaker lamp flips `BreakerState` from
  `"closed"` to `"open"`, and `resetBreaker` closes it. Debit-before-spend ordering is
  narrated in the ledger readout, never asserted in copy alone.
- Names cited: `reserve` / `reconcile` / `ReserveResult` / `ReconcileResult` (meter.ts),
  `computeCost` / `creditsForMicroUsd` / `resolvePriceEntry` / `priceKey` /
  `BUNDLED_PRICE_BOOK` / `PRICE_BOOK_VERSION` (pricebook.ts), `estimateUsage` /
  `CHARS_PER_TOKEN` / `DEFAULT_OUTPUT_TOKENS` (estimate.ts), `SpendCapError` / `readBreaker` /
  `tripBreaker` / `resetBreaker` / `BreakerState` (breaker.ts).
- Cost: 2.5 dev-days. The existing `UsageChart` component slide stays.

### Flagship F4 — guardrails: "The boundary"

- One line: `Every call crosses the same gate. Type something it should stop.`
- Anatomy: an input textarea prefilled with the golden fixture sentence from
  `packages/guardrails/src/__golden__/pii-redact.json` ("Contact jane.doe@example.com or
  404-555-0100. SSN 123-45-6789. Card 4111 1111 1111 1111 expires soon."), a live span
  highlighter, a mode segmented control, a stage toggle, an outage switch, and an output
  panel.
- Interaction: typing runs detection and underlines each `PiiMatch` span typed by
  `PII_KINDS = ["email", "ssn", "credit_card", "phone"]`
  (`packages/guardrails/src/pii.ts`), with per-kind count chips. The mode control
  (`PiiMode = "mask" | "hash" | "tokenize"`) renders the package's literal output formats:
  `[EMAIL]`, `[EMAIL:86e0b9e56c17]`, `[[PII:email:0]]`, with the tokenize mode labeled as
  sealed under `PII_COLUMN_CONTEXT = "guardrails.pii"`. A golden test pins the fixture input's
  masked and hashed outputs to the package fixture, so the demo can never drift from shipped
  behavior. The stage toggle mirrors `guardInput` / `guardOutput`
  (`packages/guardrails/src/guard.ts`). The outage switch simulates a moderator timeout:
  `moderateWithDeadline` expires and the call blocks fail-closed with the typed 422
  (`GuardrailError`, `packages/kernel/src/errors.ts`), the `GuardCategory` chips
  (`"moderation" | "pii" | "injection" | "secret" | "custom"`,
  `packages/guardrails/src/moderator.ts`) show which fired, and the block is narrated as the
  real event label `"guardrail.blocked"`. Fail-closed is the whole point: a down moderator
  blocks the call, never waves it through.
- Names cited: `guardInput` / `guardOutput` / `GuardOutcome` (guard.ts), `detectPii` /
  `redactPii` / `tokenizePii` / `PII_KINDS` / `PiiKind` / `RedactMode` / `PiiMode` /
  `PiiMatch` / `PII_COLUMN_CONTEXT` (pii.ts), `GuardCategory` / `moderateWithDeadline` /
  `localModerator` (moderator.ts), `GuardrailError` (kernel errors.ts).
- Cost: 2.5 dev-days incl. golden test.

Shared kit under all four: a `poke/` rig of tiny deterministic primitives (seeded chain
hasher via WebCrypto, integer ledger math, span highlighter, verdict chips) that the 21
pattern-grade instances reuse. Nothing in any poke fetches, persists, or measures the user.

---

## C) Marketplace desktop layout (rail assumed GONE)

Killing the 21rem rail + one 2rem gap frees the results zone from ≈484px to ≈852px (facets
kept) or the full ≈1092px content width (facets moved). All three treatments keep: the
`PreviewDialog` viewer, the compare tray, the chip row with clear-all, the aria-live results
count, card Add-to-cart footers, and the `?view=` deep-link scheme.

### C1 — "The showroom"

- Layout: facets stay left (13rem, sticky `top: var(--cs-space-20)`, contextual counts
  unchanged). The freed results zone splits into two bands: a "Bundles" eyebrow + `cs-grid--3`
  band of the six bundle cards (≈270px each), a hairline divider, then a "Modules" eyebrow +
  `cs-grid--2` of module cards (≈416px each).
- Filter chrome: unchanged (four facet fieldsets + search + chips). The Type radio facet
  mirrors the two bands.
- Section rhythm: bundles always lead, modules follow; facets filter both bands; count line
  spans both ("Showing 19 of 32").
- Cost: smallest delta. Delete the rail column, add two band headers, swap grid classes.
  ≈2–3 dev-days.
- Verdict: roomy module cards, but bundle cards at 270px carry the longest blurbs in the
  catalog (the pricing `note` lines), and a 240px facet column is a lot of permanent chrome
  for 32 items. A good compromise that does not go far enough.

### C2 — "The exchange floor" (recommended)

- Layout: full ≈1092px canvas. The facet column dies; its contents move into a sticky filter
  toolbar (`position: sticky; top: var(--cs-space-20)`, surface-1 + border, shadow on stick):
  a segmented Type control (`All 32` / `Bundles 6` / `Modules 26`, 44px segments), `Category`
  and `Price` disclosure panels riding the nav-panels dropdown pattern (44px option rows,
  counts preserved inline), a `Has media` toggle, and the search field. Chip row + count stay
  directly under the toolbar.
- Grid: a "Bundles" band, `cs-grid--3`, 6 cards at ≈350px (two rows of three), then a
  hairline divider + "Modules" eyebrow, `cs-grid--3` at ≈350px. Same card component, one
  continuous scan, kind eyebrow + StatusChip already differentiate.
- Section rhythm: toolbar → bundles band → divider → modules band → empty state (unchanged).
  Below 60rem the bands step to 2-up, below 48rem to 1-up (the existing ladder), and the
  toolbar collapses into a single `Filters` disclosure + search.
- Cost: new segmented control + two disclosure panels + toolbar stickiness + grid surgery.
  ≈4–6 dev-days.
- Verdict: the register matches the product. Engineers scan dense, filter-forward grids well;
  350px cards finally fit the chrome the card already carries (eyebrow + pill + compare,
  price, three-line blurb, CTA); sticky filter access beats a facet column the moment the
  page becomes the primary add surface. Ship it.

### C3 — "The reading room"

- Layout: no facet column, no toolbar. A sticky category subnav (mono chips: `Bundles` ·
  `Compliance` · `AI-Production` · `Local-first` · `Agentic-Dev` · `Provenance` · `Platform`)
  anchors stacked sections, each `cs-grid--2` at ≈536px cards. The bundles section leads as
  feature rows (price, member count, "Save $X vs à la carte" chip, CTA), Everything spanning
  full width. Search stays; price/media filtering dies.
- Section rhythm: one section per persona + Platform; subnav scroll-spies the active section.
- Cost: section model + scroll-spy subnav + bundle feature-row card variant. ≈5–7 dev-days,
  plus a real data problem (below).
- Verdict: the prettiest and the least honest to the data. field-crypto belongs to four
  bundles; sections force it to repeat 4× or hide its span. Price filtering dies on a store
  page. 32 cards over 7 sections is a very long scroll. Reject.

---

## D) Cart drawer patterns

Shared givens: the native `<dialog>` drawer, nav trigger, `view_cart` chokepoint, `/cart`
review page, and the shared `cart-shared.tsx` anatomy (lines, pruned notice, upgrade callout,
trust note) all ship today. The stack rail and the mobile `<details>` stack dock die in every
pattern. The homepage stack module (`StackBuilderLazy`, section 11) is replaced in every
pattern by the decision band specced at the end of this section.

### D1 — "Ship-shape drawer" (evolve what exists; recommended)

- Trigger placement: unchanged (nav, both breakpoints, 2.25rem target + 2.75rem invisible hit
  area). The badge gains a compositor-only pulse (transform/opacity keyframe, reduced-motion
  safe) on every add while the drawer is closed.
- Desktop anatomy: right slide-over widened 24rem → 26rem. Header (title + 44px close),
  pruned notice, compact lines with remove, the upgrade callout (the bundle-savings nudge
  from `buildStackSummary`, the highest-value element in the cart system), subtotal row, trust
  note, primary `Review cart` + a new ghost `Keep browsing` that just closes.
- Mobile anatomy: the same dialog becomes a bottom sheet below 48rem (`inset: auto 0 0 0`,
  full width, `max-height: 85vh`, safe-area padding, visual grab handle), matching the mental
  model the retired dock trained. ESC, backdrop tap, and close all work (native dialog). This
  kills the marketplace-only `<details>` dock in favor of one site-wide surface.
- Added-feedback while closed: badge increment + pulse; the AddToCartButton flips to its
  disabled `In cart` state (existing); no toast.
- Auto-open rule (the amendment that makes this D1-amended): the FIRST add per page view opens
  the drawer (the confirmation + the savings-nudge impression); subsequent adds on the same
  page view only pulse the trigger (the provider holds a per-route flag, reset on navigation).
  On `/cart` and `/dashboard/cart` the drawer never auto-opens. Rationale: on the primary add
  surface a buyer multi-adds; modal-whipping them on every click is hostile, but hiding the
  nudge entirely (D2) leaves money on the table.
- Detail-page CTAs: placements unchanged (sticky BuyRail, MobileBuyBar, three placements on
  persona pages). Same first-add rule. The PreviewDialog keeps its close-then-drawer handoff.
- Cost: sheet restyle + pulse + per-route flag + Keep browsing + dock deletion. ≈3–4 dev-days.

### D2 — "The quiet cart"

- Adds NEVER open the drawer. Feedback is entirely local: badge pulse, button state flip, and
  a one-line polite aria-live confirmation under the CTA (`Field encryption is in your cart.
$199.`) with a text `View cart` action. Drawer opens only from the trigger or that action.
- Anatomy: same drawer/sheet as D1. Trigger: nav, but the badge becomes the sole ambient
  signal, so it gains an accent-tinted resting state whenever the cart is non-empty.
- Detail-page CTAs: identical placements, quiet rule everywhere; the MobileBuyBar gains a
  cart-count segment once items exist.
- Cost: confirmation line + badge states + buy-bar segment; drawer stays nearly as-is.
  ≈2–3 dev-days.
- Verdict: the calmest UX and the wrong economics. The bundle-upgrade nudge ("The Compliance
  bundle covers your 10 picks for $1,449. Save $621." — a real scenario: all ten
  compliance-member modules à la carte sum to $2,070 against the locked $1,449 bundle price)
  lives in the drawer; quiet-add means a buyer who never opens the drawer never sees the one
  message that raises average order value while honestly saving them money. The mitigation
  (inline per-card nudges) clutters every card with math that belongs in one place.
  Runner-up.

### D3 — "The persistent dock"

- Once the cart is non-empty, a slim fixed bottom bar appears site-wide (desktop + mobile):
  `Cart · 3 items` left, subtotal center, 44px `Review` right, opening the drawer/sheet above
  it. The marketplace stack dock generalizes into it; the module-page MobileBuyBar merges into
  it as a second zone.
- Verdict: the dock preserves the rail's one virtue (the always-visible total) at the cost of
  permanent fixed chrome on every marketing page, a direct collision with the MobileBuyBar on
  the 23 module pages, and an app-y read on a store. The site has been deleting fixed bars,
  not adding them. Reject.

### The homepage treatment (all patterns): the decision band

`StackBuilderLazy` (section 11) dies; the full configurator already lives one click away on
the marketplace, which the locked scope makes the primary add surface. Replacement: a slim
band after the SKU matrix titled `Pick the path. The bundle follows.` with three path cards,
each mapping to its persona bundle and price from the pricing SOT: `Pass an audit`
(Compliance, $1,449), `Ship AI features` (AI-Production, $739), `Build offline-first`
(Local-first, $629). Each card routes to the marketplace with that bundle's viewer open
(`?view=bundle:<id>`), never adding directly (the homepage sells the path; the marketplace
sells the SKU). A ghost link closes the band: `Does it fit your stack?` → `/stack-fit`, the
adapter-matrix page that already exists. No cart chrome on the homepage at all. Build: one
static band, ≈1 dev-day, and it deletes the `StackBuilderLazy` idle-mount cost from the
homepage entirely.

---

## E) Verdicts

- **A — ship A2.** The sheet states the claim, the poke proves it under the cursor, the
  artifact shows the code. A1 is a museum; A3 is a trailer for a film not yet shot. Lock the
  three-slide module floor (sheet + poke + artifact, component slides where shipped) and the
  borrow-don't-fork bundle variant. Build order: the four flagships first (they sit on the two
  wedge seams: field-crypto + audit-worm for Compliance, ai-meter + guardrails for
  AI-Production), then the class rigs, then sheets in catalog order.
- **B — ship the paradigm table as specced.** Twelve classes, twelve rigs (four built with
  the flagships), 25 pokes, ui-pro exempt. Every name verified against package source; every
  simulation deterministic and backend-free; golden tests pin the crypto and PII legs to
  package fixtures so the demos can never drift from shipped behavior.
- **C — ship C2.** The rail's death is only worth its 21rem if the cards get it back; C2
  hands the full 1140px canvas to the catalog, keeps bundles leading as their own band, and
  moves filtering into a sticky toolbar that survives the scroll. C1 is the safe half-measure,
  C3 is dishonest to multi-bundle modules.
- **D — ship D1 amended.** Keep the shipped dialog drawer and its `view_cart` chokepoint;
  widen it, turn it into a bottom sheet on mobile, kill the stack dock, add `Keep browsing`;
  first-add-per-page auto-opens (the savings nudge earns its impression), later adds pulse the
  closed trigger. Homepage gets the decision band: three honest paths, zero cart chrome, the
  configurator's duplicate dies.

One program, one kickoff: sheets and pokes in parallel lanes, C2 + D1-amended in a third, all
landing before the first loop of A3 is ever storyboarded.

KIMI-DONE
