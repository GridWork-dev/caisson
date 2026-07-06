---
updated: 2026-07-05
status: live
grounds:
  - knowledge/decisions/
---

# ADR index

Canonical catalog of every Architecture Decision Record in `knowledge/decisions/`. This
file is a **synthesized view** (number -> title -> domain -> status -> supersession). It does
not own decision content: the ADRs themselves are the source of truth, and the live board
`docs/state/decisions-and-forks.md` (CLAUDE.md SoT #1) owns "locked vs open". On any
conflict, the ADR file and the board win over this index.

- ADRs are append-only and immutable (ADR-0006). A later ADR _supersedes_ a clause; it
  never edits the prior file. So most rows below are **partial** supersessions (one clause),
  not a wholesale replacement.
- Numbering is **not**
  contiguous: present are **0001-0024** and **0040-0143** + **0150-0153** (Stage-2 Stream B) + **0160-0162** + **0170-0185** (Stage-2 Streams A/C/D · the 2026-07-01 provider picker · the 2026-07-01 edition seam-completion picker 0179-0185) + **0187-0199** (LIFT/site-rework/audit-remediation; 0186 filed 2026-07-02 at agent-runner build start per its "files at build" reservation) + **0200-0203** (commerce-goes-live 0200/0203 + editions-go-live 0201-0202; the Discord ADR was drafted 0201 and renumbered to 0203 at merge — editions claimed 0201 first, ADR-0088 second-merger-renumbers) + **0204-0209** (the 2026-07-02 strix-remediation lock 0204 + the edition-tails-ops picker 0205-0209; the transports ADR was drafted 0204 and renumbered to 0209 at merge — strix claimed 0204 first, ADR-0088 second-merger-renumbers) + **0210-0217** (the 2026-07-02 lift-harvest slice-2 wave, drafted 0204-0211 and renumbered at merge per ADR-0088 — strix/edition-tails claimed 0204-0209 first: reconcile + wave lock 0210 · jobs consumer-side 0211 · branded-money/rounding-provenance 0212 · ai-kit embeddings 0213 · ai-evals depth 0214 · guardrails 0215 · mcp-server manifest/ledger 0216 · ai-meter dedup gate 0217; 0186 filed 2026-07-02 at agent-runner build start per its "files at build" reservation) + **0218-0221** (the 2026-07-02 deferred-respec picker round: Paddle per-line partial refund 0218 · CF front rate-limit 0219 · admin mutation surface v1 0220 · live seams KMS/ONNX 0221) + **0222** (the 2026-07-02 distribution picker: caisson-sh GitHub org + @caisson-sh npm scope + credit-pack/agent-runner catalog completion) + **0223** (the same-day registry self-hosted npm delivery lock: `registry.caisson.sh` serves the npm install protocol, option-A + 8 sub-forks) + **0224** (the same-day live-verification harness fork locks: F1–F6 seam proofs) + **0225-0227** (the 2026-07-02 third picker round: admin-v2 purchase-revoke six fork locks 0225 · pre-launch credential-sweep four fork locks 0226 · compliance reprice $799 + per-module sandbox catalog 0227) + **0228** (the members-fold republish second wave, reserved against the in-flight 0225-0227 set per ADR-0088) + **0229-0232** (the 2026-07-03 fourth picker round: wave-6 compliance/billing subset build 0229 · WORM GOVERNANCE-now-COMPLIANCE-at-launch 0230 · OSCAL rlink signed-bundle Option 1 0231 · SEO renderer trigger + glossary-program pre-commit 0232 · audit-harness v2 locks 0233 · ask-AI widget locks 0234) + **0235-0236** (the 2026-07-03 fifth picker round: glossary-program five fork locks 0235 · ask-AI question-text capture 0236) + **0237-0238** (the fifth round's second sitting: site-presentation-rework eight forks + two riders 0237 · the build-time catalog à-la-carte row drop 0238 — both REALIZED, PRs #97/#98/#102) + **0239-0241** (the 2026-07-03 deploy-closeout picker round: wave-6 close-out 0239 · local-ai $349 canonical 0240 · changeset prose source-gate 0241) + **0242** (landing via a parallel PR) + **0243-0245** (the 2026-07-05 Kickoff-A picker round: agent-dev inspector Bun.serve+list locks 0243 · perpetual updates window 0244 · credit pooled rollover 0245; the R3 price re-lock was REDIRECTED into catalog-doctrine research, not locked) + **0246-0248** (the same-day catalog-rework picker against the doctrine F1-F8 queue: full per-package catalog + editions-dissolve-to-bundles + compliance 3-SKU carve 0246 · bundle commerce mechanics 25%-off/snapshot/crediting 0247 · buyer-based OSS-line standard + split checklist 0248) + **0249** (the same-day G-series follow-up: bundle set persona+Provenance · billing split · auth-sso carve · credits decouple-then-flip · rls admin-write carve · metas bundle-only; G2 kit shape redirected, not locked) + **0250** (the G2 third round: ui floor + ui-pro commercial + brand private tiering (P3 override) · staged buildout · ./ui-subpath frontend shape · S-class wave 1) + **0251-0254** (the 2026-07-06 Kickoff-E picker rounds: updates-window claim+edge enforcement + renewal SKUs + copy posture 0251 · credit expiry grant_consumption/FIFO/badge+email 0252 · build-state generated counts + sot count-parity 0253 · measurement pair PAYG citation loop + split docs funnel 0254) — **ceiling 0254**; **0025-0039 are an unused gap**
  (no files). The 0040 jump was a deliberate block reservation for the brand/positioning set.
  **0089-0093** = the 2026-06-28 picker-round locks (billing X-2 / migrate / mig-bundle / bin / local-debit);
  **0094-0096** = the 2026-06-29 GTM-report locks (open-core Base / GTM offer / services-docs);
  **0097** = the W1 registry schema/service split; **0098** = the B1 credit-denomination home (resolves 0089 SD-3);
  **0099-0104** = the 2026-06-29 design-system-harden track locks (component-recipe+kit / token+theming / gates / signature-animation / brand-mark "Pressure vessel" / Phase-2 hero static-code-as-proof);
  **0105** = the 2026-06-29 support-bot implementation locks (discord.py / OpenRouter / thread+Postgres escalation — implements 0009, P6 Bucket C item 2);
  **0106-0107** = the 2026-06-29 P6 operator-gates locks (final pricing numbers + grandfathering / CF-Access go-live gate); **0108** = the 2026-06-30 Paddle-MoR payment-provider switch (supersedes Stripe-as-MoR; amends 0089); **0109** = the 2026-06-30 support-bot member-management lock (auto-role / mod commands / /grant-role — extends 0105).
  **0110-0113** = the 2026-06-30 P6 code-track locks (license-issuer impl + production verify-key bake / publish-readiness private→public flip / buyer-MCP per-account rate-limit / entitlement-revoke + one-time purchases + refund credit-clawback). The code track originally drafted issuer at 0108 and entitlement at 0109; both were **renumbered at the integration merge** (0108→0110, 0109→0113) so the go-live operator track keeps the contiguous 0106-0109 block.
  **0114-0115** = the 2026-06-30 dashboard host/DB picker round (unified dynamic Next 16 app on
  Railway, supersedes ADR-0084's static-export deploy mode / Railway managed Postgres, amends
  ADR-0014's Neon default).
  **0116-0118** = the 2026-06-30 unified-app build-session picker round (billing driver scope —
  Paddle platform-only, Stripe retained as a buyer `@caisson/billing` driver, extends 0108 /
  observability — vendor-neutral OpenTelemetry to a self-hosted SigNoz, supports 0114/0115 /
  web analytics — Plausible, cookieless, env-gated, complements 0117).
  **0129-0135** = the same-day 2026-06-30 pricing + store-rework and harvest grill sessions
  (0129 value-based per-module pricing + edition-bundle math, supersedes the ADR-0106 Local-first/
  bundle point-values / 0130 store-front as-if-built availability, supersedes ADR-0082 §3/§4 /
  0131 on-site cart + multi-item Paddle checkout, extends ADR-0116 / 0132 buyer sign-in — magic-link
  - OAuth via better-auth / 0133 AI/agent-infra harvest initiative, post-go-live and spec-gated /
    0134 cross-domain audit/validate harness, full build, generalizes ADR-0101 / 0135 two new
    commercial Compliance modules — `@caisson/alerting` + `retention-runner`). Numbered above 0128,
    the highest number used-or-proposed at authoring time (`docs/state/adapter-expansion.md`'s
    Tier-3 proposals) — **0119-0128 remain proposed-only** (adapter-expansion.md) and are not filed
    as ADRs.
    **0136-0137** = the 2026-06-30 store-rework BUILD wave (locked + built this session): 0136
    license-keyed registry gating (closes the free-view leak; opens the ships-with-generator tooling
    trio cli·migrate·license-verify as Apache-2.0 Base — amends ADR-0094/0111) / 0137 edition reprice
    to full below-sum (supersedes the ADR-0129 edition point-values, reverses its thin-edition-premium
    thesis).
- Status tokens read from each ADR's own header line:
  - `proposed` = literal header value on the founding + foundations sets (0001-0019, 0024).
    Per the board (line 90) these are **in force / locked** despite the stale "proposed"
    header text written during the Phase-5 spec; the header was never updated. See accuracy
    flags at the bottom.
  - `locked` = D9 module-pipeline set (0020-0023).
  - `accepted` = brand/wave-0/wave-1/design/gtm sets + picker-round locks + P6 go-live/code tracks + the dashboard host/DB picker round + the billing-scope/observability/analytics picker round + the pricing/store-rework and harvest grill sessions + the store-rework build wave (0040-0137).

Domain detail and rationale: read the ADR file. Architecture overview: `specs/01-architecture.md`.
Product framing: `specs/00-product-spec.md`. Build plan: `plan.md`.

---

## GTM renumber map (read this first)

Two parallel build tracks each allocated **0045-0048** against the same `main` after PR #11,
producing eight files on four numbers. ADR-0088 resolved it: the **GTM set was renumbered to
0084-0087**; the **Wave-0 substrate set kept 0045-0048**. Authoritative record:
`knowledge/decisions/ADR-0088-adr-number-collision-renumber.md`; board note at
`docs/state/decisions-and-forks.md` line 90.

| OLD number (GTM)          | NEW number   | Topic                                         | Kept-at-old (Wave-0 substrate)              |
| ------------------------- | ------------ | --------------------------------------------- | ------------------------------------------- |
| ADR-0045 (gtm-site-stack) | **ADR-0084** | GTM site stack (Fumadocs + MDX -> CF Pages)   | ADR-0045 = field-crypto AEAD cipher         |
| ADR-0046 (waitlist)       | **ADR-0085** | Waitlist capture seam (CF Function -> Resend) | ADR-0046 = ciphertext envelope format       |
| ADR-0047 (web-analytics)  | **ADR-0086** | Web analytics (Plausible)                     | ADR-0047 = registry read-path / Worker seam |
| ADR-0048 (hero-sku)       | **ADR-0087** | Hero SKU surface                              | ADR-0048 = generator engine                 |

> Frozen research/spec artifacts under `outputs/research/design-session/` and
> `outputs/specs/design-brand-site-seo/` predate the renumber and **may still cite the old
> GTM 0045-0048 numbers**. They are not edited (frozen evidence). When a design/brand/SEO/copy
> artifact references ADR-0045/0046/0047/0048, resolve it through the map above: a _GTM/site_
> context means 0084-0087; a _field-crypto / registry / generator_ context means the Wave-0
> 0045-0048 files. Verified: `grep -rE "ADR-004[5678]" outputs/research/design-session/` hits.

---

## Supersession chains

Read top-to-bottom = oldest decision to current in-force position. Each arrow is a _partial_
supersession of one clause unless noted.

- **Licensing / open-core:** `0010` (open-core boundary) -> `0023` (fully-commercial, kills
  free/OSS base) -> `0050` (kills the local-ai AGPL flank, Wave-1) -> `0083` (go-live: local-ai
  fully commercial, removes the last AGPL/open-core carve-out). Net: **no AGPL, no free tier
  anywhere.** (0050 and 0083 both close the local-ai flank from two different sessions; 0083 is
  the current authority.)
- **Brand / design tokens:** `0042` (palette + type lock) -> `0078` (brand-foundation expansion;
  keeps the 0042 token center, supersedes its "depth = tone + hairline, never shadows" rule).
- **Pricing display / hero SKU:** `0087` (orig 0048; structure shown, prices deferred to
  waitlist) -> `0081` (indicative placeholder prices) -> `0082` (committed pricing, live
  self-serve) -> `0106` (final edition-level numbers + grandfathering) -> `0129` (adds
  value-based per-module SKUs + edition-bundle math) -> `0137` (edition reprice to full
  below-sum; supersedes the 0129 edition point-values **in full** and reverses its
  thin-edition-premium thesis; the 0129 **module** sheet holds) -> `0227` (Compliance
  $749 -> $799, 5.6% below the $846 member-sum — the 0137 below-sum invariant kept; the
  other edition numbers hold). Current: `0227` for Compliance; `0137` for the rest
  (AI-Kit $599 · Agentic-Dev $249 · Local-first $349 · Bundle $1,499).
- **Registry read-path visibility / gating:** `0047` (static CI-built index + deferred Worker
  seam, free view keyed on `editions[]===[]`) -> `0136` (free floor re-keyed on
  `license === Apache-2.0`; commercial base-kind requires an entitlement, fail-safe to open; the
  ships-with-generator tooling trio flips open). Current: `0136`. Un-gating takes effect at DEPLOY.
- **Storefront availability posture:** `0082` §3-§4 (true-to-built artifacts, Agentic-Dev the one
  labeled-roadmap exception) -> `0130` (full 17-SKU catalog shown available, no maturity flags;
  site stays CF-Access-gated per 0107) -> `0237` rider 2 (FULL V1-live posture — retires the
  0082 §4 Agentic-Dev roadmap exception) -> `0238` (11-module standalone catalog — the four
  edition-core à-la-carte rows dropped; supersedes 0227's 14-sellable clause). Current: `0238`.
- **Field-crypto:** `0006` (compliance data layer, base "env-key") -> `0043` (per-tenant key
  derivation, amends the base-tier key clause) -> `0055` (P2: crypto-shred granularity +
  row-level AAD). Cipher/envelope implemented by `0045`/`0046`.
- **Go-live site posture:** `0085` + `0087` (pre-launch waitlist CTA) + `0081` (indicative
  prices) all superseded by `0082` (live self-serve, committed prices, true-to-built claims).
- **Site deploy mode:** `0084` (static-export Next app -> Cloudflare Pages direct-upload) ->
  `0114` (one dynamic Next 16 app, Node `standalone` -> Railway; `/dashboard` route group
  added). The Fumadocs/MDX docs framework and single-app/one-brand topology of `0084` are kept;
  only the deploy mode is replaced.
- **Platform DB host:** `0014` (Drizzle + Neon default) -> `0115` (Railway managed Postgres
  default; `drizzle-orm/node-postgres` over TCP). The ORM, migration strategy, and
  swappable-`DATABASE_URL` clause of `0014` are kept; Neon remains a supported, non-default
  driver target.

---

## Full catalog

Links are relative from repo root. "Relations" captures supersedes / amends / superseded-by /
implements as stated in each ADR header.

### Founding set (0001-0012) - status `proposed` (in force per board)

| #                                                                             | Title                                                             | Domain             | Status   | Relations                                       |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------ | -------- | ----------------------------------------------- |
| [0001](../knowledge/decisions/ADR-0001-monorepo-tooling.md)                   | Monorepo tooling: Bun + Turborepo + changesets                    | Tooling            | proposed | -                                               |
| [0002](../knowledge/decisions/ADR-0002-engineering-invariants.md)             | Engineering invariants (all product code)                         | Invariants         | proposed | refs 0006, 0007                                 |
| [0003](../knowledge/decisions/ADR-0003-composable-package-base-split.md)      | Composable capability packages; editions = compositions           | Architecture       | proposed | -                                               |
| [0004](../knowledge/decisions/ADR-0004-generator-registry-codegen-credits.md) | `create-caisson` generator + versioned registry + codegen-credits | Generator/Registry | proposed | -> impl 0021, 0047, 0048, 0049                  |
| [0005](../knowledge/decisions/ADR-0005-fail-closed-rls-tenancy.md)            | Fail-closed multi-tenant RLS                                      | Tenancy            | proposed | extended by 0073 (local tier)                   |
| [0006](../knowledge/decisions/ADR-0006-worm-audit-chain-field-crypto.md)      | WORM + append-only audit chain + field encryption                 | Compliance/Crypto  | proposed | amended by 0043, 0055; impl 0045/0046/0051-0058 |
| [0007](../knowledge/decisions/ADR-0007-credit-metering-model.md)              | Credit wallet + metering model                                    | Credits            | proposed | amended by 0024; extended by 0074               |
| [0008](../knowledge/decisions/ADR-0008-buyer-mcp-server-auth.md)              | Buyer-facing MCP server, auth-gated                               | MCP                | proposed | extended by 0071, 0076                          |
| [0009](../knowledge/decisions/ADR-0009-custom-support-bot-service.md)         | Custom support-bot service (Discord + RAG)                        | Support            | proposed | -                                               |
| [0010](../knowledge/decisions/ADR-0010-licensing-open-core-boundary.md)       | Licensing, entitlements, open-core boundary                       | Licensing          | proposed | open-core clause superseded by 0023, 0083       |
| [0011](../knowledge/decisions/ADR-0011-provider-agnostic-ai-config.md)        | Provider-agnostic AI config + agent-assisted setup                | AI-config          | proposed | -> 0059 (ai-kit gateway owns the call)          |
| [0012](../knowledge/decisions/ADR-0012-pricing-packaging.md)                  | Pricing & packaging model                                         | Pricing            | proposed | numbers still open; display via 0081/0082       |

### Foundations track (0013-0019, 0024) - status `proposed` (in force per board)

| #                                                                      | Title                                              | Domain     | Status   | Relations                                                          |
| ---------------------------------------------------------------------- | -------------------------------------------------- | ---------- | -------- | ------------------------------------------------------------------ |
| [0013](../knowledge/decisions/ADR-0013-testing-golden-file-harness.md) | Testing strategy + golden-file harness (PGlite)    | Testing    | proposed | -                                                                  |
| [0014](../knowledge/decisions/ADR-0014-database-orm-migrations.md)     | Database, ORM (Drizzle), migration strategy (Neon) | Database   | proposed | migration assembly -> 0070; Neon default amended by 0115 (Railway) |
| [0015](../knowledge/decisions/ADR-0015-auth-session-rls-seam.md)       | Auth (better-auth), session shape, auth->RLS seam  | Auth       | proposed | -                                                                  |
| [0016](../knowledge/decisions/ADR-0016-ci-cd-standards-gate.md)        | CI/CD pipeline + the standards gate                | CI/CD      | proposed | + eval gate 0062                                                   |
| [0017](../knowledge/decisions/ADR-0017-billing-stripe-mor.md)          | Billing (Stripe), tax, webhook verification, MoR   | Billing    | proposed | -                                                                  |
| [0018](../knowledge/decisions/ADR-0018-jobs-email.md)                  | Background jobs (Trigger.dev) + email (Resend)     | Jobs/Email | proposed | Resend reused by 0085                                              |
| [0019](../knowledge/decisions/ADR-0019-error-model.md)                 | Typed error model + 402 credit-gate response       | Errors     | proposed | extends 0002; -> 0075 EventSink                                    |
| [0024](../knowledge/decisions/ADR-0024-credit-idempotency-index.md)    | Credit idempotency index                           | Credits    | proposed | amends 0007                                                        |

### D9 module-standards pipeline (0020-0023) - status `locked`

| #                                                                           | Title                                                | Domain          | Status | Relations                                                          |
| --------------------------------------------------------------------------- | ---------------------------------------------------- | --------------- | ------ | ------------------------------------------------------------------ |
| [0020](../knowledge/decisions/ADR-0020-module-manifest-authoring.md)        | Module manifest + authoring conventions              | Module-pipeline | locked | -                                                                  |
| [0021](../knowledge/decisions/ADR-0021-registry-publish-pipeline.md)        | Registry publish pipeline (one ingress) + versioning | Module-pipeline | locked | impl of 0004; credential -> 0069                                   |
| [0022](../knowledge/decisions/ADR-0022-import-boundary-lint-gates.md)       | Import-boundary + license lint gates                 | Module-pipeline | locked | AGPL gate moot after 0050/0083                                     |
| [0023](../knowledge/decisions/ADR-0023-fully-commercial-licensing-model.md) | Fully-commercial licensing model                     | Licensing       | locked | supersedes 0010 open-core; local-ai flank superseded by 0050, 0083 |

### Brand block (0040-0042) + amendments (0043-0044) - status `accepted`

| #                                                                       | Title                                                              | Domain        | Status   | Relations                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------- | -------- | ------------------------------------------------- |
| [0040](../knowledge/decisions/ADR-0040-positioning-hero.md)             | Hero positioning: compliance wedge under production-rigor umbrella | Positioning   | accepted | supersedes "AI production codebase starter" frame |
| [0041](../knowledge/decisions/ADR-0041-product-name-caisson.md)         | Product name: Caisson (`@caisson/*`)                               | Name          | accepted | supersedes working names `stack` / `Forge`        |
| [0042](../knowledge/decisions/ADR-0042-design-system-foundation.md)     | Design-system foundation: palette + type lock                      | Design        | accepted | **superseded by 0078** (widened)                  |
| [0043](../knowledge/decisions/ADR-0043-field-crypto-per-tenant-keys.md) | Field-crypto per-tenant key derivation                             | Field-crypto  | accepted | amends 0006; extended by 0055                     |
| [0044](../knowledge/decisions/ADR-0044-app-framework-nextjs.md)         | App framework: Next.js for edition reference apps                  | App-framework | accepted | -                                                 |

### Wave-0 shared-substrate forks (0045-0049) - status `accepted`

> These four (0045-0048) **kept** their numbers in the ADR-0088 renumber; the colliding GTM
> set moved to 0084-0087. See the GTM renumber map.

| #                                                                        | Title                                                              | Domain            | Status   | Relations                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------------- | -------- | ------------------------------------ |
| [0045](../knowledge/decisions/ADR-0045-field-crypto-aead-cipher.md)      | Field-crypto AEAD cipher: AES-256-GCM via `node:crypto`            | Field-crypto      | accepted | impl of 0006/0043                    |
| [0046](../knowledge/decisions/ADR-0046-ciphertext-envelope-format.md)    | Ciphertext envelope: self-describing binary, base64 into text      | Field-crypto      | accepted | impl of 0045                         |
| [0047](../knowledge/decisions/ADR-0047-registry-readpath-worker-seam.md) | Registry read-path: static CI-built index + deferred Worker seam   | Registry          | accepted | impl of 0021/0004/0008               |
| [0048](../knowledge/decisions/ADR-0048-generator-engine.md)              | Generator engine: in-repo template copy + typed transform          | Generator         | accepted | impl of 0004/0021; built out by 0068 |
| [0049](../knowledge/decisions/ADR-0049-codegen-credit-debit-point.md)    | Codegen credit-debit point: debit-before-spend at generation entry | Credits/Generator | accepted | impl of 0004/0007/0024               |

### Wave-1 editions forks (0050-0077) - status `accepted`

| #                                                                               | Title                                                          | Domain                     | Status   | Relations                                    |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------- | -------- | -------------------------------------------- |
| [0050](../knowledge/decisions/ADR-0050-local-ai-fully-commercial.md)            | Local-first AI edition is fully-commercial (kills AGPL flank)  | Licensing                  | accepted | closes 0023's open flank; reaffirmed by 0083 |
| [0051](../knowledge/decisions/ADR-0051-worm-objectlock-retention-mode.md)       | WORM Object-Lock retention mode (GOVERNANCE default)           | Compliance/WORM            | accepted | impl of 0006                                 |
| [0052](../knowledge/decisions/ADR-0052-audit-chain-anchor-persistence.md)       | Audit-chain entry + trusted-anchor persistence                 | Compliance/Audit-chain     | accepted | durability for 0045-family chain             |
| [0053](../knowledge/decisions/ADR-0053-append-only-version-schema.md)           | Append-only locked-version DB schema + immutability            | Compliance/Versioning      | accepted | DB layer for 0006 versioning                 |
| [0054](../knowledge/decisions/ADR-0054-worm-artifactstore-port.md)              | WORM ArtifactStore port, backend, retention floor              | Compliance/WORM            | accepted | impl of 0006                                 |
| [0055](../knowledge/decisions/ADR-0055-field-crypto-cryptoshred-and-row-aad.md) | Field-crypto P2: crypto-shred + row-level AAD                  | Field-crypto               | accepted | extends 0043/0045                            |
| [0056](../knowledge/decisions/ADR-0056-evidence-pack-signing.md)                | Evidence-pack signing: per-tenant Ed25519                      | Compliance/Evidence        | accepted | resolves 0006 "signed" gap                   |
| [0057](../knowledge/decisions/ADR-0057-compliance-control-model.md)             | Compliance control model: own-authored SCF-parity catalog      | Compliance/Controls        | accepted | serves 0040 framework set                    |
| [0058](../knowledge/decisions/ADR-0058-evidence-pack-format-determinism.md)     | Evidence-pack format, determinism, flag-never-guess            | Compliance/Evidence        | accepted | gates 0013 golden fixtures                   |
| [0059](../knowledge/decisions/ADR-0059-ai-kit-inference-gateway.md)             | AI-Kit metered-inference gateway (Vercel AI SDK v5)            | AI-Kit                     | accepted | owns the 0011 provider call                  |
| [0060](../knowledge/decisions/ADR-0060-ai-kit-metering-spendcap.md)             | AI-Kit token metering, spend caps, circuit breaker             | AI-Kit                     | accepted | on 0007/0024 ledger; behind 0059             |
| [0061](../knowledge/decisions/ADR-0061-ai-kit-prompt-registry.md)               | AI-Kit versioned prompt registry                               | AI-Kit                     | accepted | append-only substrate (0053 family)          |
| [0062](../knowledge/decisions/ADR-0062-ai-kit-eval-harness-ci-gate.md)          | AI-Kit eval harness + regression-vs-baseline CI gate           | AI-Kit                     | accepted | extends 0016 standards gate                  |
| [0063](../knowledge/decisions/ADR-0063-ai-kit-guardrails.md)                    | AI-Kit guardrails: moderation, PII redaction                   | AI-Kit                     | accepted | layered on 0059                              |
| [0064](../knowledge/decisions/ADR-0064-local-first-edition-architecture.md)     | Local-first AI edition: built two-way sync, vector, runtime    | Local-first                | accepted | unblocked by 0050                            |
| [0065](../knowledge/decisions/ADR-0065-base-agent-kernel-package.md)            | New base package `@caisson/agent-kernel`                       | Agent-kernel               | accepted | base for 0066                                |
| [0066](../knowledge/decisions/ADR-0066-agentic-dev-governed-kernel-emitter.md)  | Agentic-Dev: governed TS kernel + multi-harness emitter        | Agent-Dev                  | accepted | on 0065                                      |
| [0067](../knowledge/decisions/ADR-0067-base-local-store-package.md)             | New base package `@caisson/local-store` (vec + FTS + RRF)      | Local-store                | accepted | unblocked by 0050                            |
| [0068](../knowledge/decisions/ADR-0068-generator-engine-fileset-writer.md)      | Generator engine: templates tree, FileSetWriter, transform     | Generator                  | accepted | builds out 0048/0049                         |
| [0069](../knowledge/decisions/ADR-0069-publish-flow-credential-backfill.md)     | Publish flow: GITHUB_TOKEN, incremental backfill, changesets   | Module-pipeline            | accepted | names 0021's abstract credential             |
| [0070](../knowledge/decisions/ADR-0070-migration-assembly-single-ledger.md)     | Migration assembly: compose-time assembler + single ledger     | Database/Migrations        | accepted | reconciles 0014 single-ledger                |
| [0071](../knowledge/decisions/ADR-0071-entitlement-expansion-registry-graph.md) | Entitlement expansion: edition/bundle -> member-module graph   | Licensing/Entitlements     | accepted | joins 0012 to 0008 gate                      |
| [0072](../knowledge/decisions/ADR-0072-buyer-repo-boundary.md)                  | Monorepo-vs-generated-repo boundary                            | Architecture/Generator     | accepted | scopes 0013/0016/0020/0062 into buyer repo   |
| [0073](../knowledge/decisions/ADR-0073-local-tenancy-db-file-per-tenant.md)     | Local/SQLite tenant isolation: one DB file per tenant          | Tenancy/Local              | accepted | extends 0005 to local tier                   |
| [0074](../knowledge/decisions/ADR-0074-credit-event-type-model.md)              | Credit event-type extension: generic feature_debit/grant + tag | Credits                    | accepted | extends 0007/0024 enum                       |
| [0075](../knowledge/decisions/ADR-0075-observability-eventsink-port.md)         | Observability: base EventSink port; audit-chain stays separate | Observability              | accepted | extends 0019; distinct from 0052             |
| [0076](../knowledge/decisions/ADR-0076-buyer-mcp-extensibility.md)              | Buyer MCP server: extensible tool registration + edition tools | MCP                        | accepted | extends 0008                                 |
| [0077](../knowledge/decisions/ADR-0077-edition-versioning-member-pinning.md)    | Edition versioning: independent modules + manifest member pin  | Module-pipeline/Versioning | accepted | extends 0003/0021                            |

### Design / brand / SEO / copy block (0078-0081) - status `accepted`

| #                                                                          | Title                                                        | Domain       | Status   | Relations                                                                          |
| -------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------ | -------- | ---------------------------------------------------------------------------------- |
| [0078](../knowledge/decisions/ADR-0078-brand-foundation-expansion.md)      | Brand foundation expansion: mark, icon, illustration, motion | Brand/Design | accepted | supersedes 0042 (widens; keeps token center)                                       |
| [0079](../knowledge/decisions/ADR-0079-seo-strategy.md)                    | SEO strategy: dev-kit long-tail + programmatic engine        | SEO          | accepted | relates 0040, 0084, 0086, 0087->0081; amended by 0114 (CWV/SEO delivery mechanism) |
| [0080](../knowledge/decisions/ADR-0080-copy-messaging-expansion.md)        | Copy & messaging: per-surface laws over specs/04 voice       | Copy         | accepted | extends specs/04                                                                   |
| [0081](../knowledge/decisions/ADR-0081-pricing-indicative-placeholders.md) | Pricing display: indicative placeholder prices (pre-launch)  | Pricing      | accepted | supersedes 0087; **superseded by 0082**                                            |

### Go-live (0082-0083) - status `accepted` (current authority)

| #                                                                       | Title                                                      | Domain      | Status   | Relations                                                       |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- | ----------- | -------- | --------------------------------------------------------------- |
| [0082](../knowledge/decisions/ADR-0082-go-live-site-posture.md)         | Go-live: live self-serve, committed pricing, true-to-built | GTM/Pricing | accepted | supersedes 0085/0087 waitlist stance + 0081 placeholder pricing |
| [0083](../knowledge/decisions/ADR-0083-local-first-fully-commercial.md) | Local-first AI is fully commercial (removes AGPL flank)    | Licensing   | accepted | supersedes 0023 flank + 0010 open-core carve-out                |

### GTM site (0084-0087, renumbered from 0045-0048) - status `accepted`

| #                                                                  | Title (was)                                                   | Domain             | Status   | Relations                                                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [0084](../knowledge/decisions/ADR-0084-gtm-site-stack.md)          | GTM site stack: Fumadocs + MDX -> CF Pages (was 0045)         | GTM-site           | accepted | renumbered per 0088; **deploy mode (static-export -> CF Pages) superseded by 0114** (docs framework + single-app topology kept) |
| [0085](../knowledge/decisions/ADR-0085-waitlist-capture-seam.md)   | Waitlist capture seam: CF Function -> Resend (was 0046)       | GTM-site           | accepted | renumbered per 0088; pre-launch CTA stance superseded by 0082                                                                   |
| [0086](../knowledge/decisions/ADR-0086-web-analytics-plausible.md) | Web analytics: Plausible, cookieless (was 0047)               | GTM-site/Analytics | accepted | renumbered per 0088                                                                                                             |
| [0087](../knowledge/decisions/ADR-0087-hero-sku-surface.md)        | Hero SKU surface: structure shown, prices deferred (was 0048) | GTM-site/Pricing   | accepted | renumbered per 0088; **superseded by 0081 -> 0082**                                                                             |

### Meta (0088) - status `accepted`

| #                                                                        | Title                                                      | Domain | Status   | Relations                                      |
| ------------------------------------------------------------------------ | ---------------------------------------------------------- | ------ | -------- | ---------------------------------------------- |
| [0088](../knowledge/decisions/ADR-0088-adr-number-collision-renumber.md) | Resolve 0045-0048 collision: renumber GTM set -> 0084-0087 | Meta   | accepted | knowingly exempts 0006 immutability (one-time) |

### Picker-round locks (0089-0093, 2026-06-28) - status `accepted`

Eight open forks decided in a two-round operator picker (research from a 12-agent workflow). Five
locked as ADRs below; three deferred to P6 on the board (publishability flip, MCP rate-limit, final
pricing numbers).

| #                                                                             | Title                                                                 | Domain    | Status   | Relations                                            |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------- | -------- | ---------------------------------------------------- |
| [0089](../knowledge/decisions/ADR-0089-billing-credit-grant.md)               | Subscription cycle -> credit grant + commerce price-book (closes X-2) | Billing   | accepted | composes 0007/0012/0017/0024/0060; build at P6       |
| [0090](../knowledge/decisions/ADR-0090-caisson-migrate-base-package.md)       | Promote @caisson/migrate base pkg (full extract)                      | Generator | accepted | resolves 0070 impl fork; ADR-0003                    |
| [0091](../knowledge/decisions/ADR-0091-compose-time-migration-bundling.md)    | Compose-time migration bundling via CLI build-step copy               | Generator | accepted | resolves bundling fork; 0070/0014; relocatable→0090  |
| [0092](../knowledge/decisions/ADR-0092-create-caisson-bin-runtime.md)         | create-caisson bin -> dist/cli.js + node shebang (npx reach)          | CLI       | accepted | operator override; impl at P6 w/ publishability 0021 |
| [0093](../knowledge/decisions/ADR-0093-local-cli-free-codegen-debit-scope.md) | Local CLI free; codegen debit scoped to hosted path                   | CLI       | accepted | clarifies 0049; 0024/0005/0008                       |

### GTM-report + W1/B1 locks (0094-0098, 2026-06-29) - status `accepted`

| ADR                                                                      | Title                                                                                               | Domain             | Status   | Notes                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------ | -------- | ---------------------------------------------------- |
| [0094](../knowledge/decisions/ADR-0094-open-core-base-apache2.md)        | Open-core Base: Apache-2.0 substrate; editions/primitives/generator/registry/updates commercial     | Licensing          | accepted | amends 0023/0050/0083 (Base tier only); impl = W1    |
| [0095](../knowledge/decisions/ADR-0095-gtm-offer-structure.md)           | GTM offer: free EU-AI-Act sample · Enterprise "Contact us" tier · annual cadence · pricing deferred | GTM                | accepted | extends 0012/0081/0082/0089                          |
| [0096](../knowledge/decisions/ADR-0096-services-docs-standalone.md)      | services/docs standalone AI-native docs service                                                     | Docs               | accepted | separate from apps/site Fumadocs; build at P6        |
| [0097](../knowledge/decisions/ADR-0097-registry-schema-service-split.md) | Registry schema/service split: open @caisson/registry-schema + commercial registry service          | Licensing/Registry | accepted | amends 0094; W1 impl lock (open↔commercial boundary) |
| [0098](../knowledge/decisions/ADR-0098-credit-conversion-home.md)        | Credit denomination lives in @caisson/kernel (resolves 0089 SD-3)                                   | Billing/Credits    | accepted | B1 lock; composes 0007/0024/0089                     |

### Design-system-harden track (0099-0104, 2026-06-29) - status `accepted`

Eight forks (F1-F8) from `outputs/kickoffs/design-marketing-rebuild.md`, locked on a 7-agent code-grounded
fanout. Adopts the _mechanism_ of `outputs/research/wardfile-frontend-playbook.md` (token/brand VALUES stay
Caisson's). The track is harden-not-build (Caisson already owned the token foundation).

| #                                                                             | Title                                                                            | Domain           | Status   | Relations                                                                  |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------- | -------- | -------------------------------------------------------------------------- |
| [0099](../knowledge/decisions/ADR-0099-component-recipe-kit-packaging.md)     | Component recipe + framework-agnostic kit packaging (F1/F2/F7/F8)                | Design/UI        | accepted | adopts wardfile playbook; Lucide per DESIGN.md §4; ADR-0078/0042/0003/0044 |
| [0100](../knowledge/decisions/ADR-0100-token-theming-hardening.md)            | Token & theming hardening: breakpoint ladder · scrim · 3-prong dark mode (F4/F3) | Design/Tokens    | accepted | extends 0042/0078; ThemeToggle per 0099                                    |
| [0101](../knowledge/decisions/ADR-0101-deterministic-design-quality-gates.md) | Deterministic design-quality gates (staged) + advisory critic (F5)               | Design/CI        | accepted | extends 0016/0022/0062; enforces 0099/0100                                 |
| [0102](../knowledge/decisions/ADR-0102-signature-animation-css-svg.md)        | Marketing signature animation: tokenized CSS/SVG, video deferred (F6)            | Design/Marketing | accepted | adopts hero-concepts; under 0078 §6 / 0080 §3                              |
| [0103](../knowledge/decisions/ADR-0103-brand-mark-pressure-vessel.md)         | Brand mark: the "Pressure vessel" (operator pick); signature sketch deferred     | Design/Brand     | accepted | supersedes 0078 §2 glyph; defers 0102 sketch; under 0078 §8 / 0099         |
| [0104](../knowledge/decisions/ADR-0104-phase2-hero-static-code-as-proof.md)   | Phase-2 hero: static code-as-proof (operator pick); three.js spike deferred      | Design/Marketing | accepted | amends 0102/0103 hero plan; under 0080/0079/0078 §6 §8; ADR-0082           |

### P6 support-bot impl (0105, 2026-06-29) - status `accepted`

Implementation forks for `services/support-bot` (P6 Bucket C item 2), resolved in an operator picker
after exa + codebase research. Implements ADR-0009's shape; does not supersede it.

| #                                                                     | Title                                                                          | Domain           | Status   | Relations                                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------- | -------- | ----------------------------------------------------------------- |
| [0105](../knowledge/decisions/ADR-0105-support-bot-implementation.md) | support-bot impl: discord.py · OpenRouter (one key) · thread+Postgres escalate | Services/Support | accepted | implements 0009; consumes 0096 (/query); full-build + deploy seam |

### P6 operator-gates + go-live (0106-0109, 2026-06-29..30) - status `accepted`

The DEPLOY-class operator session's go-live forks. ADR-0106 executes the ADR-0095 §4 pricing deferral;
ADR-0107 formalizes the keep-gated CF-Access decision into a launch runbook; ADR-0108 switches the
payment provider to Paddle (Merchant of Record), superseding the Stripe-as-MoR assumption; ADR-0109
locks support-bot member-management scope (extends 0105) built in the 2026-06-30 go-live session.

| #                                                                        | Title                                                                                    | Domain           | Status   | Relations                                                                                                                                                  |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [0106](../knowledge/decisions/ADR-0106-final-pricing-grandfathering.md)  | Final pricing numbers + grandfathering (Compliance $2,499 · Bundle $3,499 · annual subs) | Commerce/Pricing | accepted | executes 0095 §4; supersedes 0082 §2 display; extends 0012/0081/0089                                                                                       |
| [0107](../knowledge/decisions/ADR-0107-cf-access-go-live-gate.md)        | CF-Access go-live gate: keep gated until checkout works; flip = the launch act           | Infra/Go-live    | accepted | formalizes board decision; relates 0082/0106/0089/0009/0096; gate mechanism re-homed by 0114 (CF-Pages Access -> app auth / CF Access in front of Railway) |
| [0108](../knowledge/decisions/ADR-0108-payment-provider-paddle-mor.md)   | Payment provider: Paddle (Merchant of Record) supersedes Stripe-as-MoR                   | Commerce/Billing | accepted | supersedes Stripe-as-MoR (0012); amends 0089; relates 0106                                                                                                 |
| [0109](../knowledge/decisions/ADR-0109-support-bot-member-management.md) | Support-bot member management (auto-role · mod cmds · /grant-role) — one bot, new module | Services/Support | accepted | extends 0105 (in the 0009 envelope); defers webhook to 0108                                                                                                |

### P6 code-track (0110-0113, 2026-06-30) - status `accepted`

The unattended code-track slices landed alongside the go-live operator gates and merged in the same
P6 integration. Issuer (0110) and entitlement-revoke (0113) were drafted at 0108/0109 and renumbered
at the merge so the operator track keeps the contiguous 0106-0109 block.

| #                                                                         | Title                                                                                                                      | Domain           | Status   | Relations                                                 |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------- | --------------------------------------------------------- |
| [0110](../knowledge/decisions/ADR-0110-license-issuer-implementation.md)  | License-issuer impl: private @caisson/license-issue · PKCS8 Signer port · baked verify-key · lazy bearer-gated POST /issue | Services/License | accepted | implements 0010; private flank of 0097; relates 0047/0071 |
| [0111](../knowledge/decisions/ADR-0111-publish-readiness.md)              | Publish-readiness: private→public flip · open-base→npm / commercial→GH split · changeset gate                              | Registry/Release | accepted | executes 0094/0097 open-core; relates 0020-0023/0092      |
| [0112](../knowledge/decisions/ADR-0112-mcp-rate-limit.md)                 | Buyer-MCP per-account rate limit (lazy-refill token bucket · port-injected · fail-open)                                    | Services/MCP     | accepted | extends 0009 MCP surface; relates 0089 metering           |
| [0113](../knowledge/decisions/ADR-0113-entitlement-revoke-and-onetime.md) | Entitlement revocation + one-time purchases + refund credit-clawback (reference-counted grants)                            | Services/License | accepted | evolves 0071; amends 0089; relates 0007 integer-credits   |

### P6 dashboard host/DB (0114-0115, 2026-06-30) - status `accepted`

The buyer-dashboard build surfaced a host/URL fork (a static-export Next app and Cloudflare
Workers/`workerd` both cannot serve the transaction-scoped fail-closed RLS `withTenant` read) and a
co-located DB-host fork, both locked in one operator picker round. Closes the dashboard host/URL fork
and the dashboard DB-host fork on the live board (`docs/state/decisions-and-forks.md`).

| #                                                                       | Title                                                                       | Domain         | Status   | Relations                                                                             |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------- | -------- | ------------------------------------------------------------------------------------- |
| [0114](../knowledge/decisions/ADR-0114-unified-railway-next-app.md)     | Unified dynamic Next 16 app on Railway (marketing + docs + buyer dashboard) | App/Infra      | accepted | supersedes 0084 deploy mode; amends 0079; re-homes 0107; consistent with 0044/0015    |
| [0115](../knowledge/decisions/ADR-0115-railway-postgres-platform-db.md) | Railway Postgres as the platform DB host                                    | Database/Infra | accepted | amends 0014 (Neon default -> Railway); supports 0114; supports 0005 (RLS transaction) |

### P6 unified-app build session: billing scope + observability + analytics (0116-0118, 2026-06-30) - status `accepted`

Three operator-picked forks surfaced building the unified app: the buyer-facing `@caisson/billing`
package's Stripe scope post-Paddle-MoR, the observability vendor, and web analytics. Locked in one
operator-picker round alongside the dashboard build.

| #                                                                                            | Title                                                                                            | Domain             | Status   | Relations                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------ | -------- | ------------------------------------------ |
| [0116](../knowledge/decisions/ADR-0116-billing-driver-scope-paddle-platform-stripe-buyer.md) | Billing driver scope: Paddle platform-only; Stripe retained as a buyer `@caisson/billing` driver | Commerce/Billing   | accepted | extends 0108; clarifies 0017; relates 0089 |
| [0117](../knowledge/decisions/ADR-0117-observability-otel-signoz.md)                         | Observability: vendor-neutral OpenTelemetry -> self-hosted SigNoz                                | Observability      | accepted | supports 0114/0115; complemented by 0118   |
| [0118](../knowledge/decisions/ADR-0118-web-analytics-plausible.md)                           | Web analytics: Plausible (cookieless, env-gated on `PLAUSIBLE_DOMAIN`)                           | GTM-site/Analytics | accepted | complements 0117; fits 0079/0095           |

### Pricing + store-rework grill session (0129-0132, 2026-06-30) - status `accepted`

A two-round operator picker on the store-rework initiative: round 1 locked the packaging/pricing
forks (module pricing model, edition-bundle math, catalog scope, availability posture); round 2
locked the mechanics (checkout, sign-in) alongside sequencing/grandfathering decisions recorded on
the board rather than as new ADRs.

| #                                                                                | Title                                                                    | Domain           | Status   | Relations                                                                      |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------- | -------- | ------------------------------------------------------------------------------ |
| [0129](../knowledge/decisions/ADR-0129-pricing-packaging-value-based-modules.md) | Pricing & packaging: value-based per-module + discounted edition bundles | Pricing          | accepted | supersedes 0106's Local-first/bundle numbers; extends 0012/0081/0082/0095/0106 |
| [0130](../knowledge/decisions/ADR-0130-storefront-as-if-built-availability.md)   | Store-front as-if-built availability: full catalog, no maturity flags    | GTM/Pricing      | accepted | supersedes 0082 §3/§4; composes 0129; extends 0095/0106                        |
| [0131](../knowledge/decisions/ADR-0131-cart-multiitem-paddle-checkout.md)        | On-site cart + single multi-item Paddle checkout                         | Commerce/Billing | accepted | extends 0116; composes 0129/0089/0098/0113                                     |
| [0132](../knowledge/decisions/ADR-0132-buyer-signin-magiclink-oauth.md)          | Buyer sign-in: magic-link + GitHub/Google OAuth via better-auth          | Auth             | accepted | extends 0015; closes the sign-in-placeholder gap                               |

### Harvest grill session (0133-0135, 2026-06-30) - status `accepted`

Document-only locks — no code lands under any of these three. Consolidated ranked tracking doc:
`docs/state/harvest-program.md`. Sequenced strictly post-go-live, after the pricing/store-rework set
above and the Railway cutover.

| #                                                                                    | Title                                                                            | Domain             | Status   | Relations                                          |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------ | -------- | -------------------------------------------------- |
| [0133](../knowledge/decisions/ADR-0133-ai-agent-infra-harvest-initiative.md)         | AI/agent-infra harvest initiative: gridwork-core substrate + Wardfile base lifts | Agentic-Dev/AI-Kit | accepted | composes 0059-0063, 0065-0066, 0075; document-only |
| [0134](../knowledge/decisions/ADR-0134-cross-domain-audit-validate-harness.md)       | Cross-domain audit/validate harness (full build)                                 | Tooling/CI         | accepted | extends 0101; composes 0016; document-only         |
| [0135](../knowledge/decisions/ADR-0135-new-compliance-modules-alerting-retention.md) | New commercial Compliance modules: `@caisson/alerting` + `retention-runner`      | Compliance         | accepted | composes 0003, 0057, 0075; document-only           |

### Store-rework build wave (0136-0137, 2026-06-30) - status `accepted` (locked + built)

Unlike the document-only 0129-0135 locks, these two landed as code on
`feat/dashboard-unified-and-p6-tail` this session (gates green).

| #                                                                                     | Title                                                                    | Domain             | Status   | Relations                                                                                   |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------ | -------- | ------------------------------------------------------------------------------------------- |
| [0136](../knowledge/decisions/ADR-0136-license-keyed-registry-gating-tooling-open.md) | License-keyed registry gating + ships-with-generator tooling opened Base | Registry/Licensing | accepted | extends 0047/0071/0077; amends 0094 (open-Base set) + 0111 (publish split); protects 0129   |
| [0137](../knowledge/decisions/ADR-0137-edition-reprice-full-below-sum.md)             | Edition reprice: every edition below its module-sum (Q4)                 | Pricing            | accepted | supersedes 0129 edition point-values in full; reverses 0129 §2; extends 0106 grandfathering |

---

### Admin control-plane + fleet observability (0138, 2026-06-30) - status `accepted` (charter, build post-Stage-1)

Base-level architecture lock for the `admin.caisson.sh` operator control-plane + full-fleet
observability; implementation is post-Stage-1, spec-gated.

| #                                                                                      | Title                                                                        | Domain            | Status   | Relations                                                                 |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------- | -------- | ------------------------------------------------------------------------- |
| [0138](../knowledge/decisions/ADR-0138-admin-control-plane-and-fleet-observability.md) | admin.caisson.sh operator control-plane + full-fleet observability (charter) | Ops/Observability | accepted | executes 0117; builds on 0114/0115; absorbs 0099-0104 studio; reuses 0107 |

---

### Stage-2 Stream A detail-fork locks (0140-0143, 2026-06-30) - status `accepted` (initiative SPEC)

The four ADR-0138 detail forks, locked at the Stream A initiative SPEC (operator picker). Build is
local-only on `stream/obs-admin`; deploy is the separate integration session. `0139` reserved for the
deploy's own Railway topology ADR; `0144-0149` reserved for Stream A spillover.

| #                                                                           | Title                                                      | Domain            | Status   | Relations                            |
| --------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------- | -------- | ------------------------------------ |
| [0140](../knowledge/decisions/ADR-0140-admin-auth-cf-access.md)             | admin.caisson.sh auth: CF-Access alone                     | Auth/Security     | accepted | opens 0138 fork; reuses 0107         |
| [0141](../knowledge/decisions/ADR-0141-business-admin-read-only-cockpit.md) | business-admin: read-only cockpit + admin-read RLS role    | Auth/Security     | accepted | opens 0138 fork; builds on 0005/0115 |
| [0142](../knowledge/decisions/ADR-0142-signoz-sizing-retention-sampling.md) | SigNoz self-host: single-node, 14-day retention, 100% head | Ops/Observability | accepted | opens 0138 fork; executes 0117       |
| [0143](../knowledge/decisions/ADR-0143-architecture-diagram-react-flow.md)  | live architecture diagram: interactive React Flow          | Ops/Observability | accepted | implements 0138 §4                   |

### Stage-2 Stream B — harvest-modules parallel build (0150-0153, 2026-07-01) - status `accepted`

Four greenfield commercial packages built in parallel on `stream/harvest-modules`; board/index
cross-stream reconcile is integration-owned. `0154-0159` reserved for Stream B spillover.

| #                                                                           | Title                                                                  | Domain               | Status   | Relations                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------- | -------- | --------------------------------------------------- |
| [0150](../knowledge/decisions/ADR-0150-stream-b-parallel-build.md)          | Stream B build: parallel independent build of four greenfield packages | Architecture/Process | accepted | executes 0134/0135; branch stream/harvest-modules   |
| [0151](../knowledge/decisions/ADR-0151-alerting-multi-channel-transport.md) | @caisson/alerting: four channels behind one AlertChannel port          | Compliance/Alerting  | accepted | implements 0135; builds under 0150                  |
| [0152](../knowledge/decisions/ADR-0152-retention-runner-scheduling.md)      | @caisson/retention-runner: @caisson/jobs port + in-memory dev driver   | Compliance/Retention | accepted | implements 0135; builds under 0150                  |
| [0153](../knowledge/decisions/ADR-0153-tool-exec-governed-tool-call.md)     | @caisson/tool-exec: governed tool-call / sandboxed-exec primitive      | Editions/Agentic     | accepted | new Agentic-Dev substrate under 0133; wired by 0199 |

### Stage-2 Stream C — edition + AI hardening & drivers (0160-0162, 2026-07-01) - status `accepted`

Adapter/transport/BYOK expansion behind already-locked ports (reserved range 0160-0169; SPEC
`outputs/specs/stream-c-edition-hardening/SPEC.md`). Board/index cross-stream reconcile is
integration-owned.

| #                                                                        | Title                                                 | Domain        | Status   | Relations                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------- | ------------- | -------- | ------------------------------------------------ |
| [0160](../knowledge/decisions/ADR-0160-ai-inference-driver-expansion.md) | AI inference drivers: Bedrock · Azure OpenAI · Ollama | AI/Adapters   | accepted | extends 0059/0011; realizes adapter-expansion 2C |
| [0161](../knowledge/decisions/ADR-0161-mcp-streamable-http-transport.md) | MCP Streamable-HTTP remote transport (beside stdio)   | MCP/Transport | accepted | implements 0008/0112; unblocked by 0110/0113     |
| [0162](../knowledge/decisions/ADR-0162-per-tenant-encrypted-byok.md)     | Per-tenant encrypted BYOK for AI lanes                | AI/Security   | accepted | amends 0011; composes 0043/0045/0046/0005        |

### Stage-2 Stream-D adapter + org-account locks (0170-0176, 2026-06-30) - status `accepted`

The base-substrate driver buildout (one ADR per port-family, `docs/state/adapter-expansion.md`) + the D4
org-account fork lock. These take real numbers from Stream D's reserved **0170-0179** range, retiring the
advisory "0119+" placeholders in `adapter-expansion.md`. Drivers are env-gated/dormant until creds; org-account
is a real migration. **0177-0178 used by the 2026-07-01 provider picker (below); 0179 reserved for D6 harvest.**

| #                                                                     | Title                                                       | Domain           | Status   | Relations                                                            |
| --------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------- | -------- | -------------------------------------------------------------------- |
| [0170](../knowledge/decisions/ADR-0170-email-multi-driver.md)         | Email adapter: SMTP + AWS SES + Postmark behind `Emailer`   | Adapters/Email   | accepted | extends 0018/0085; realizes adapter-expansion §1A                    |
| [0171](../knowledge/decisions/ADR-0171-field-crypto-aws-kms.md)       | KMS adapter: wire AWS KMS (license KmsSigner excluded, P7)  | Adapters/Crypto  | accepted | extends 0043/0045/0046/0055; realizes §1B                            |
| [0172](../knowledge/decisions/ADR-0172-workos-sso.md)                 | SSO adapter: WorkOS SAML/SCIM, sign-in scope only           | Adapters/Auth    | accepted | extends 0015; composes 0176; realizes §1C                            |
| [0173](../knowledge/decisions/ADR-0173-pgboss-jobqueue.md)            | Jobs adapter: pg-boss (Postgres-native) behind `JobQueue`   | Adapters/Jobs    | accepted | extends 0018; composes D6 harvest; realizes §2B                      |
| [0174](../knowledge/decisions/ADR-0174-supabase-transactor.md)        | DB adapter: Supabase (session-mode/TCP) behind `Transactor` | Adapters/DB      | accepted | extends 0005/0014/0115                                               |
| [0175](../knowledge/decisions/ADR-0175-lemonsqueezy-polar-billing.md) | Billing adapter: LemonSqueezy + Polar (buyer-facing)        | Adapters/Billing | accepted | extends 0017/0108/0116                                               |
| [0176](../knowledge/decisions/ADR-0176-org-account-model.md)          | Buyer account: org model via `account_member` (multi-user)  | Auth/Tenancy     | accepted | extends 0015/0132; closes personal placeholder; RLS (0005) unchanged |

### Provider picker (0177-0178, 2026-07-01) - status `accepted`

The 2026-07-01 operator provider picker (research: forks PF-1..PF-7, `docs/state/providers.md`).

| #                                                                 | Title                                                                          | Domain              | Status   | Relations                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------- | -------- | --------------------------------------- |
| [0177](../knowledge/decisions/ADR-0177-provider-stack-2026-07.md) | Provider stack: Grafana-sole OTLP · PostHog · Linear+Cookiy · Greptile PR-gate | Infra/Observability | accepted | supersedes 0117; relates 0118/0138/0086 |
| [0178](../knowledge/decisions/ADR-0178-edition-members-fold.md)   | Edition members-fold: bundle Stage-2 harvest primitives into editions          | Pricebook           | accepted | extends 0077/0137/0003; PR #34          |

### Edition seam-completion picker (0179-0185, 2026-07-01) - status `accepted`

Seven operator-locked forks from the **edition seam-completion** initiative (SPECs under
`outputs/specs/edition-seam-completion/`). 0179-0181 = the OSCAL export seam; 0182-0183 = the BYOK
buyer edge; 0184 = live-transports (decided-to-defer, no build); 0185 = Bun OTel request spans. Two
diverged from the draft recommendation (0181 scope-broadest, 0184 defer-all). **Note:** 0179 had been
advisory-reserved for D6 harvest / Stream-D spillover; the operator reassigned it here.

| #                                                                          | Title                                                                            | Domain            | Status   | Relations                                     |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------- | -------- | --------------------------------------------- |
| [0179](../knowledge/decisions/ADR-0179-oscal-version-catalog-binding.md)   | OSCAL version + catalog binding: emit v1.2.2 + per-framework AP fragment         | Compliance/OSCAL  | accepted | relates 0058/0057/0181                        |
| [0180](../knowledge/decisions/ADR-0180-oscal-output-format.md)             | OSCAL output format: JSON primary + oscal-cli XML converter path (CI round-trip) | Compliance/OSCAL  | accepted | relates 0058/0179                             |
| [0181](../knowledge/decisions/ADR-0181-oscal-collector-framework-scope.md) | OSCAL collector + framework scope: all 3 + HIPAA/EU-AI-Act collectors + wizard   | Compliance/OSCAL  | accepted | relates 0058/0043/0162/0179; diverges (broad) |
| [0182](../knowledge/decisions/ADR-0182-byok-credit-billing-policy.md)      | BYOK billing: free ($0 credit debit under a tenant key; metering = spend-cap)    | Billing/Pricebook | accepted | resolves 0162 §6; relates 0007/0137/0106      |
| [0183](../knowledge/decisions/ADR-0183-byok-key-submission-ux.md)          | BYOK edge: `apps/site` route-handler; validate-on-submit · write-only · rotate   | Secrets/Auth      | accepted | relates 0162/0114/0182                        |
| [0184](../knowledge/decisions/ADR-0184-live-transport-unstub-scope.md)     | Live transports: defer all three (S3 WORM · hosted infer · ONNX); no build       | Infra             | accepted | relates 0054/0064; diverges (defer-all)       |
| [0185](../knowledge/decisions/ADR-0185-bun-otel-instrumentation.md)        | Bun OTel: manual `withSpan` request spans (Bun bypasses node auto-instr)         | Observability     | accepted | relates 0117/0140-0143/0177; ADR-0002         |

---

### Site-marketplace-rework session (0189-0196, 2026-07-01) - status `accepted`

Nine forks (D-1…D-9) from the site-marketplace-rework audit, locked in an operator picker (D-8 closed
no-op, no ADR). Numbered from **0189** to sidestep the concurrent lift phase's claim on 0186-0188 (live
shipped ceiling at authoring time: 0178) — renumbers by-meaning at merge if lift lands first.

| #                                                                                           | Title                                                                      | Domain              | Status   | Relations                                                  |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------- | -------- | ---------------------------------------------------------- |
| [0189](../knowledge/decisions/ADR-0189-reaffirm-single-accent-lock-optional-proof-token.md) | Reaffirm ≤10% single-accent lock; optional `--cs-proof` status token (D-1) | Design/Tokens       | accepted | extends 0042/0078; enforced by 0101 contrast gate          |
| [0190](../knowledge/decisions/ADR-0190-nav-editions-disclosure-panel.md)                    | Primary nav: Editions disclosure panel (D-2)                               | Design/IA           | accepted | extends 0078/0099/0102; fixes CTA under 0192               |
| [0191](../knowledge/decisions/ADR-0191-marketplace-three-route-split-build-configurator.md) | Marketplace: three-route split + `/build` configurator (D-3)               | Commerce/Storefront | accepted | extends 0129/0131/0136/0137; live regions per 0194         |
| [0192](../knowledge/decisions/ADR-0192-single-add-to-cart-buy-verb.md)                      | Single "Add to cart" buy-verb sitewide (D-4)                               | Commerce/Storefront | accepted | extends 0116/0131; co-locks button variants with 0195      |
| [0193](../knowledge/decisions/ADR-0193-checkout-drawer-vs-cart-differentiation.md)          | Checkout: differentiate drawer vs `/cart`, single-sourced primitives (D-5) | Commerce/Checkout   | accepted | extends 0131/0132; closes drawer focus gap under 0194      |
| [0194](../knowledge/decisions/ADR-0194-wcag-22-aa-accessibility-floor.md)                   | WCAG 2.2 AA accessibility floor (D-6)                                      | Design/A11y         | accepted | extends 0100/0101; requires 0191/0193/0195                 |
| [0195](../knowledge/decisions/ADR-0195-design-system-martian-mono-codify.md)                | Design-system codify: Martian-only mono + de-dup + button lock (D-7)       | Design/Tokens       | accepted | extends 0042/0099/0100; co-locks button variants with 0192 |
| [0196](../knowledge/decisions/ADR-0196-extend-cmdk-search-sitewide.md)                      | Extend ⌘K search sitewide (D-9)                                            | Design/IA           | accepted | extends 0096; sequenced after nav 0190                     |

### Whole-repo-audit remediation session (0188 + 0197-0199, 2026-07-01) - status `accepted`

Audit-surfaced latent ceilings locked BUILD-NOW in the 2026-07-01 remediation pickers
(ledger findings `1665248bff049c36` + `3991eccd659c6dc4` + `b090309f83aff1a3`; ADR-0134/0188 harness).

| #                                                                            | Title                                                                       | Domain            | Status   | Relations                                                                   |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------- | -------- | --------------------------------------------------------------------------- |
| [0197](../knowledge/decisions/ADR-0197-field-crypto-per-tenant-cmk.md)       | field-crypto AWS KMS honors per-tenant CMKs; shred refuses without keyId    | Security/Crypto   | accepted | extends 0057/0171; surfaced by 0134/0188                                    |
| [0198](../knowledge/decisions/ADR-0198-byok-metering-allowlist.md)           | BYOK zero-cost is per-action allowlisted, default metered                   | Commerce/Metering | accepted | refines 0182; extends 0007; surfaced by 0134                                |
| [0199](../knowledge/decisions/ADR-0199-agent-dev-tool-exec-wired.md)         | @caisson/tool-exec wired into the Agentic-Dev edition (members-fold gap)    | Editions/Agentic  | accepted | honors 0178/0153; surfaced by 0134/0188                                     |
| [0188](../knowledge/decisions/ADR-0188-audit-harness-pipeline-completion.md) | audit-harness pipeline completion: scoped reconcile + external audit driver | Tooling/CI        | accepted | amends 0134; the harness this session's findings ran under; LIFT slice-1 F4 |

### Editions-go-live session (0187 + 0201–0202, 2026-07-01) - status `accepted`

The editions-go-live operator picker (4 questions, one round): revisit the same-day ADR-0184
transports defer, provision the WORM bucket, lock the hosted-inference endpoint, and pull the
Wardfile-B2 retention-escalation forward from LIFT slice-2. ADR-0187 files here from its LIFT
slice-1 reservation (F3, "files at build"). The concurrent commerce session (0200 + 0203) merged
alongside; its Discord ADR was renumbered 0201 → 0203 at merge (ADR-0088 second-merger-renumbers).
0186 stays reserved for agent-runner.

| #                                                                           | Title                                                                      | Domain          | Status   | Relations                                                      |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------- | -------- | -------------------------------------------------------------- |
| [0187](../knowledge/decisions/ADR-0187-support-impersonation-dual-audit.md) | Support-impersonation kernel + dual audit trail (folds into compliance)    | Compliance/Auth | accepted | implements LIFT F3; composes 0052/0054/0057/0058; ADR-0003     |
| [0201](../knowledge/decisions/ADR-0201-live-transports-go-live.md)          | Live transports go live: prove all three (S3 WORM · OpenRouter · ONNX)     | Infra/AI        | accepted | supersedes 0184 defer clause; relates 0054/0051/0064/0059/0160 |
| [0202](../knowledge/decisions/ADR-0202-worm-retention-escalation.md)        | WORM retention escalation: extend-only + gated COMPLIANCE, chain-evidenced | Compliance/WORM | accepted | extends 0051/0054; composes 0052; Wardfile B2 pulled forward   |

### Commerce-goes-live session (0200 + 0203, 2026-07-01) - status `accepted`

Two forks from the commerce-goes-live kickoff (Session A, revenue path), locked in an operator picker.
Recon found the webhook mount + grant path already built by the PR #40 audit remediation; 0200 codifies
it, 0203 closes the ADR-0109 Discord-role deferral (its "before a caller exists" condition expired). The
Discord ADR was drafted as 0201 and renumbered to 0203 at merge, the editions session having taken 0201
first (ADR-0088 second-merger-renumbers convention).

| #                                                                           | Title                                                                | Domain           | Status   | Relations                                            |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------- | -------- | ---------------------------------------------------- |
| [0200](../knowledge/decisions/ADR-0200-paddle-sole-buyer-webhook-mount.md)  | Paddle is the sole mounted buyer-purchase webhook source             | Commerce/Billing | accepted | extends 0108/0116/0131; codifies the PR #40 mount    |
| [0203](../knowledge/decisions/ADR-0203-discord-role-grant-link-and-push.md) | Purchase → Discord edition-role: better-auth link + license→bot push | Services/Support | accepted | implements the 0109 deferral; relates 0132/0176/0200 |

### Strix remediation session (0204, 2026-07-02) - status `accepted`

The Strix pentest remediation (PR #45, `fix/security-billing-hardening`): six finding
dispositions + four operator fork locks (SSRF resolve-recheck · X-Real-IP rate-limit keying ·
admin CF-Access-JWT · owner-only seat authz · multi-item fulfillment). Drafted in parallel with
the edition-tails-ops session — both claimed 0204; strix merged first and kept it (ADR-0088
second-merger-renumbers).

| #                                                                    | Title                                                                                                                   | Domain   | Status   | Relations                                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ------------------------------------------------------------------------ |
| [0204](../knowledge/decisions/ADR-0204-strix-pentest-remediation.md) | Strix pentest remediation: SSRF resolve-recheck · trusted-IP rate-limit · admin CF-Access-JWT · seat authz · multi-item | Security | accepted | supersedes the 0140 admin edge-alone posture; extends 0107; relates 0113 |

### Edition-tails-ops session (0205–0209, 2026-07-02) - status `accepted`

The post-go-live edition-tails + ops-hardening kickoff: one operator picker (8 forks, two rounds)
over recon-confirmed state. Recon found CAISSON-1 (Grafana cutover) and the registry-index required
check already done; the picker locked the genuinely open forks. 0186 stays reserved for agent-runner.
The transports ADR was drafted 0204 and renumbered to 0209 at merge (strix claimed 0204 first).

| #                                                                            | Title                                                                        | Domain           | Status   | Relations                                                           |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------- | -------- | ------------------------------------------------------------------- |
| [0205](../knowledge/decisions/ADR-0205-compliance-runtime-composition.md)    | Compliance composes @caisson/alerting + retention-runner at runtime          | Compliance       | accepted | mirrors 0199; delivers 0178 members; relates 0150/0151              |
| [0206](../knowledge/decisions/ADR-0206-support-bot-linear-triage-sink.md)    | Support-bot escalations post to Linear Triage (third best-effort sink)       | Services/Support | accepted | implements the linear-integration fast-follow; extends 0105         |
| [0207](../knowledge/decisions/ADR-0207-admin-ops-grafana-query-rebuild.md)   | Admin /ops cockpit rebuilds on the Grafana Cloud query API                   | Admin/Obs        | accepted | consequence of 0177 teardown; per the 0140 charter                  |
| [0208](../knowledge/decisions/ADR-0208-ops-hardening-locks.md)               | Ops-hardening locks: owner-only tenant writes · branch-protection · TF defer | Security/Ops     | accepted | fixes Strix vuln-0006; extends 0107 §8; scopes the 0178 republish   |
| [0209](../knowledge/decisions/ADR-0209-local-ai-rented-transport-drivers.md) | local-ai RentedTransport drivers: Azure + Bedrock ship, Ollama out of scope  | Local-AI/Infra   | accepted | closes the 0160 deferred bullet; pattern from 0201; drafted as 0204 |

### Lift-harvest slice-2 wave (0186 + 0210–0217, 2026-07-02) - status `accepted`

The lift-harvest session ran the Act-0 built-vs-remaining reconcile of the full ADR-0133/0134/0135
harvest program (20-agent fan-out), then an operator picker locked the three open program forks:
the ai-evals/guardrails asymmetry → harden in place; scope → the full remaining program; the auth
hash-at-rest lift → deferred (fights better-auth, ADR-0015). ADR-0186 files here from its LIFT
slice-1 reservation (F1/F2/F5, "files at build"). 0210 records the reconcile terminal states +
wave lock; 0211–0217 are the per-package decisions of the build wave. The wave was drafted
0204–0211 and renumbered to 0210–0217 at merge — strix/edition-tails claimed 0204–0209 first
(ADR-0088 second-merger-renumbers).

| #                                                                                   | Title                                                                      | Domain           | Status   | Relations                                                    |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------- | -------- | ------------------------------------------------------------ |
| [0186](../knowledge/decisions/ADR-0186-agent-runner-sandboxed-governed.md)          | @caisson/agent-runner: sandboxed governed agent runner (Agentic-Dev)       | Editions/Agentic | accepted | implements LIFT F1/F2/F5; relates 0133/0137/0153/0199        |
| [0210](../knowledge/decisions/ADR-0210-harvest-slice2-wave-lock.md)                 | Harvest slice-2 wave lock: reconcile terminals, asymmetry, scope, defers   | Program/Harvest  | accepted | executes 0133/0134/0135; resolves the 0133 flagged asymmetry |
| [0211](../knowledge/decisions/ADR-0211-jobs-consumer-side.md)                       | @caisson/jobs consumer side: idempotent enqueue + claim API + visibility   | Base/Jobs        | accepted | extends 0018/0173; Wardfile B1 + lift-sweep #14              |
| [0212](../knowledge/decisions/ADR-0212-kernel-branded-money-rounding-provenance.md) | Branded money types + rounding provenance (Wardfile B3)                    | Base/Money       | accepted | extends 0007/0089/0060/0098                                  |
| [0213](../knowledge/decisions/ADR-0213-ai-kit-metered-embeddings.md)                | ai-kit metered embeddings surface + fetch-deadline floor fix               | Editions/AI-Kit  | accepted | extends 0059/0182/0198/0201                                  |
| [0214](../knowledge/decisions/ADR-0214-ai-evals-eval-science-depth.md)              | ai-evals depth: exit-classifier, Wilson-CI gate, reflexivity, Fleiss-kappa | Editions/AI-Kit  | accepted | extends 0062/0013; lift-sweep #5/#11/#15                     |
| [0215](../knowledge/decisions/ADR-0215-guardrails-egress-gate-ftc4ps.md)            | guardrails: egress secret-gate wiring + FTC-4Ps presentation guardrail     | Editions/AI-Kit  | accepted | extends 0063/0067; lift-sweep #13                            |
| [0216](../knowledge/decisions/ADR-0216-mcp-server-manifest-retirement-ledger.md)    | mcp-server: declarative tool manifest + retired-tool ledger                | Base/MCP         | accepted | extends 0133 clean-lift; leaves 0112 untouched               |
| [0217](../knowledge/decisions/ADR-0217-ai-meter-dedup-before-meter.md)              | ai-meter: pre-call MinHash/LSH dedup-before-meter gate                     | Base/Metering    | accepted | extends 0060; lift-sweep #12                                 |

### Deferred-respec picker round (0218–0221, 2026-07-02) - status `accepted`

The 11 deferred-by-decision items were researched into SPEC drafts (`outputs/specs/deferred-respec/`,
PR #55); the operator selected 5 for build-now and locked all 16 tabled forks in one picker round.
Two picks override the spec recommendations (PF-1 → C-b columns; AM-2 → dedicated `admin_write`
role) and one adds scope (ONNX F2-B EgressGuard unification, security tag). The other 6 specs stay
draft.

| #                                                                                     | Title                                                                        | Domain           | Status   | Relations                                                          |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------- | -------- | ------------------------------------------------------------------ |
| [0218](../knowledge/decisions/ADR-0218-billing-paddle-per-line-partial-refund.md)     | Paddle per-line partial refund: revoke + clawback (C-b/A-1/B-1/D-2)          | Base/Billing     | accepted | supersedes 0113 full-refund clause + §1 index; realizes 0204 defer |
| [0219](../knowledge/decisions/ADR-0219-infra-cloudflare-front-rate-limit.md)          | Cloudflare front rate-limit + WAF: docs-api proxied, Free tier, DEPLOY-gated | Infra/Edge       | accepted | realizes 0204 edge defer; app limiters stay                        |
| [0220](../knowledge/decisions/ADR-0220-admin-mutation-surface-v1.md)                  | Admin mutation surface v1: 4 actions, admin_write role, dual-logged          | Admin/Security   | accepted | supersedes 0141 mutation defer; relates 0204/0074/0152             |
| [0221](../knowledge/decisions/ADR-0221-live-seams-kms-onnx-completion.md)             | Live seams: KMS envelope proof + ONNX disposition (G1 carve-out, F2 unify)   | Security/AI      | accepted | extends 0201; relates 0045/0171/0215                               |
| [0222](../knowledge/decisions/ADR-0222-public-distribution-and-catalog-completion.md) | Distribution: caisson-sh org, @caisson-sh npm scope, catalog completion      | GTM/Distribution | accepted | distributes 0094/0097/0136; exercises 0106 pricing                 |

### Registry self-hosted npm delivery (0223, 2026-07-02) - status `accepted`

The same-day sequel to ADR-0222: the operator locked **option A** (make `registry.caisson.sh` a
real npm registry — packuments + tarballs — authenticated by the license token buyers hold) plus
all eight sub-forks in one picker round (SPEC `outputs/specs/deferred-respec/SPEC-registry-npm-delivery.md`).
Supersedes the structurally-dead GitHub-Packages buyer channel baked into `packages/cli/src/generate.ts`

- `packages/cli/templates/base/.npmrc`; the generator flip + docs flip land in the build that
  implements the SPEC (not yet built). ADR-0222's `@caisson-sh/*` npmjs mirror stays the public
  discovery surface; this ADR owns the COMMERCIAL delivery track.

| #                                                                            | Title                                                                       | Domain             | Status   | Relations                                                                                     |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------ | -------- | --------------------------------------------------------------------------------------------- |
| [0223](../knowledge/decisions/ADR-0223-registry-self-hosted-npm-delivery.md) | Registry self-hosted npm delivery: `registry.caisson.sh` (option A + A1–H1) | Registry/Licensing | accepted | supersedes the GH-Packages buyer channel; extends 0136/0047; relates 0222/0097/0110/0113/0076 |

### Live-verification harness fork locks (0224, 2026-07-02) - status `accepted`

The same-day live-harness picker: six operator forks (F1–F6) gating a verification harness that
proves each of the five production-wired external seams against its real remote (SPEC
`outputs/specs/deferred-respec/SPEC-live-harness-production-seams.md`). Test files + `test:live`
scripts only, no product code; extends the ADR-0201 `live/` + `skipIf` convention to service-level
seams. Two picks override the spec recommendation (F1 → BOTH; F3 → FULL grant + teardown).

| #                                                                  | Title                                                                                            | Domain              | Status   | Relations                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------- | -------- | -------------------------------------------------------- |
| [0224](../knowledge/decisions/ADR-0224-live-harness-fork-locks.md) | Live harness fork locks: F1 BOTH · F2 fleet · F3 full · F4 grep · F5 local · F6 gridwork-env SOT | Testing/Live-verify | accepted | extends 0201; relates 0223/0108/0200/0203/0206/0207/0118 |

### Third picker round (0225-0227, 2026-07-02) - status `accepted`

The third operator picker round of 2026-07-02 (late): 15 questions in one round across the
admin-v2 purchase-revoke SPEC (CAISSON-19, R-1..R-6), the pre-launch credential-sweep SPEC
(Forks 1-4), and the commerce numbers, plus the two residual registry npm-delivery mechanism
forks recorded implementation-level under ADR-0223 (board section, no new ADR). Three picks
override the tabled recommendation: R-4 (build the edge revocation list into v2), credential
Fork 4 (on-incident-only rotation), and the module-catalog posture (sandbox catalog now).

| #                                                                                | Title                                                                                           | Domain           | Status   | Relations                                                           |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------- | -------- | ------------------------------------------------------------------- |
| [0225](../knowledge/decisions/ADR-0225-admin-v2-purchase-revoke-locks.md)        | Admin v2 purchase-revoke: DB-only + claw · source-scoped · one-time only · edge revocation list | Admin/Security   | accepted | extends 0113/0218/0220/0204; reuses 0007/0212/0005/0014; CAISSON-19 |
| [0226](../knowledge/decisions/ADR-0226-pre-launch-credential-sweep-locks.md)     | Pre-launch credential sweep: fresh issuer keypair · vault parity tool · on-incident rotation    | Security/Secrets | accepted | extends 0224 F6; relates 0106/0201/0221/0222/0069                   |
| [0227](../knowledge/decisions/ADR-0227-compliance-reprice-and-module-catalog.md) | Compliance reprice $749 -> $799 + per-module sandbox catalog now                                | Pricing/Commerce | accepted | supersedes the 0137 compliance number; relates 0106/0116/0082/0205  |

### Members-fold republish, second wave (0228, 2026-07-02) - status `accepted`

The MF-A/B/C execution: consumed all 24 pending changesets, hand-repinned both edition `members`
maps to the cascade-bumped versions (Compliance + Agentic-Dev), appended 33 `(id, version)` pairs to
`registry/ledger.jsonl` (65 → 98) + rebuilt `registry/index.json`, re-baselined the two bootstrap-era
guard tests. `CAISSON_PUBLISH_DRY_RUN` stays `"true"`. **Number reserved as 0228 against the in-flight
`picker-locks-third-round` 0225–0227 set (ADR-0088 convention).**

| #                                                                             | Title                                                                    | Domain         | Status   | Relations                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------- | -------- | ---------------------------------------------------- |
| [0228](../knowledge/decisions/ADR-0228-members-fold-republish-second-wave.md) | Members-fold republish, second wave: full-tree repin + agent-runner fold | Registry/Infra | accepted | extends 0208 §5; realizes 0186 F5; relates 0178/0077 |

### Fourth picker round (0229-0232, 2026-07-03) - status `accepted`

The fork-answer round after the execution wave merged (PRs #75-#85 + #84): the wave-6 harvest
residual dispositioned, the WORM retention-mode launch posture set, the OSCAL rlink won't-fix
reversed into the signed-bundle build, and the SEO union-renderer trigger locked with a
pre-committed glossary program (operator override of the wait-for-demand recommendation).

| #                                                                                | Title                                                                                                     | Domain           | Status   | Relations                                          |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------- | -------- | -------------------------------------------------- |
| [0229](../knowledge/decisions/ADR-0229-wave6-compliance-billing-subset.md)       | Wave-6 disposition: build the compliance/billing 10-row subset as one set, roadmap rest                   | Harvest/Billing  | accepted | extends 0210 §3-4; relates 0211/0024               |
| [0230](../knowledge/decisions/ADR-0230-worm-retention-mode-launch-posture.md)    | WORM retention mode: GOVERNANCE now, COMPLIANCE at the launch flip                                        | Compliance/Infra | accepted | extends 0201/0202; keeps 0051 invariant            |
| [0231](../knowledge/decisions/ADR-0231-oscal-rlink-signed-bundle.md)             | OSCAL AP rlink: signed evidence bundle, relative rlinks, sibling-dir (Option 1)                           | Compliance/OSCAL | accepted | reverses 0208 §4; amends 0179; relates 0180        |
| [0232](../knowledge/decisions/ADR-0232-seo-renderer-trigger-glossary-program.md) | SEO union-renderer trigger N=20+/single-initiative + glossary program pre-commit                          | Site/SEO         | accepted | extends the Stream-D board lock; relates 0079/0196 |
| [0233](../knowledge/decisions/ADR-0233-audit-harness-v2-locks.md)                | Audit-harness v2: derived+gated domain matrix + buyer-facing lenses (Fork-E override)                     | Audit/Tooling    | accepted | amends 0134/0188; relates 0080/0222                |
| [0234](../knowledge/decisions/ADR-0234-ask-ai-widget-locks.md)                   | Ask-AI widget: 7 fork locks — dual model lanes, both placements, expanded corpus, Turnstile (4 overrides) | Site/AI          | accepted | relates 0219/0105/0196/0118                        |

### Fifth picker round (0235-0236, 2026-07-03) - status `accepted`

The backlog-fork round after the fourth round's builds all merged (PRs #86-#93): the glossary
program's five tabled forks locked (unblocking the ADR-0232 pre-committed build), and the ask-AI
question-text follow-up fork closed as capture-with-consent (operator override of the defer rec).

| #                                                                          | Title                                                                                                                                               | Domain   | Status   | Relations                                                   |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ----------------------------------------------------------- |
| [0235](../knowledge/decisions/ADR-0235-glossary-program-fork-locks.md)     | Glossary program: 5 fork locks — 32 terms, adversarial agent authoring (Fork-B override), batches                                                   | Site/SEO | accepted | realizes 0232; extends 0079/0080                            |
| [0236](../knowledge/decisions/ADR-0236-ask-ai-question-text-capture.md)    | Ask-AI question-text capture with consent notice, 90-day retention (override of defer)                                                              | Site/AI  | accepted | extends 0234 F6; relates 0118                               |
| [0237](../knowledge/decisions/ADR-0237-site-presentation-rework-locks.md)  | Site presentation rework: 8 fork locks + V1-live posture — /marketplace hub, nav rebuild, depth pages, id renames (3 overrides)                     | Site/UI  | accepted | supersedes 0191 + 0082 roadmap exception; extends 0118/0190 |
| [0238](../knowledge/decisions/ADR-0238-drop-edition-core-alacarte-rows.md) | Drop the 4 edition-core à-la-carte rows (11-module catalog) — F5 collision resolved by removal; grants were whole-edition, no separable core exists | Commerce | accepted | extends 0237 F5; supersedes 0227's 14-sellable clause       |
| [0239](../knowledge/decisions/ADR-0239-wave6-remaining-closeout.md)        | Wave-6 close-out: build the 9 remaining build-next rows (wave-6b), ledger terminal; 28 trigger rows stay parked                                     | Harvest  | accepted | amends 0229 disposition + 0210 §4                           |
| [0240](../knowledge/decisions/ADR-0240-local-ai-price-349-canonical.md)    | Local-first edition price $349 canonical — resolves the audit manifest-vs-ADR drift flag; no number change                                          | Commerce | accepted | affirms 0137; clarifies 0129                                |
| [0241](../knowledge/decisions/ADR-0241-changeset-prose-source-gate.md)     | Changeset internal-prose SOURCE GATE in the standards-gate (formatter rejected); pending-22 hand-swept                                              | Tooling  | accepted | extends 0233 posture; closes the P2-spec formatter fork     |

### Visual-audit tail + Kickoff-A picker round (0242-0245, 2026-07-04/05) - status `accepted`

0242 landed via a parallel PR (its row was missed here until the 2026-07-05 SOT session — the
drift `bun run sot` check #1 now exists to catch). 0243-0245 are the Kickoff-A picker round; the
fourth fork of that round (R3 compliance-split price re-lock) was REDIRECTED into the
catalog-doctrine research program (`outputs/research/catalog-doctrine-2026-07.md`), not locked.

| #                                                                             | Title                                                                                                       | Domain   | Status   | Relations                                                        |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- | -------- | ---------------------------------------------------------------- |
| [0242](../knowledge/decisions/ADR-0242-visual-audit-remediation-picker.md)    | Visual-audit remediation picker: eyebrow voice, real media, mobile buy rail (REALIZED — PRs #116/#120/#122) | Site/UI  | accepted | realizes the 0233-audit visual ledger; extends 0237              |
| [0243](../knowledge/decisions/ADR-0243-agent-dev-inspector-bunserve-locks.md) | Agentic-Dev inspector: Bun.serve shell (A1) + LocalStore.list (B1); build queued, lock-and-go               | Editions | accepted | narrowly supersedes 0044; realizes 0186 read-only; respects 0073 |
| [0244](../knowledge/decisions/ADR-0244-perpetual-updates-window.md)           | Perpetual updates window: 12mo included + ~40% renewal; policy before the checkout flip                     | Commerce | accepted | extends 0095/0106; constrains 0136/0223 entitlements             |
| [0245](../knowledge/decisions/ADR-0245-credit-pooled-rollover-12mo.md)        | Credit policy: pooled rollover, 12-month grant expiry, FIFO burn                                            | Commerce | accepted | extends 0007/0089/0222; relates 0024/0049/0093                   |

### Catalog-rework picker round (0246-0248, 2026-07-05) - status `accepted`

The F1-F8 picker against `outputs/research/catalog-doctrine-2026-07.md`, run in the SOT-expansion
session (the Kickoff-C tmp-dir session is superseded). Brainstorm-class round: deliberately not
bounded by prior packaging ADRs. Bundle-set design, OSS-line redraw candidates (incl. the ui
basic/deep split), and ALL price numbers stay OPEN pending the brainstorm + the queued
pricing-revalidation pass.

| #                                                                            | Title                                                                                                                                                                                                                                         | Domain      | Status   | Relations                                                        |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ---------------------------------------------------------------- |
| [0246](../knowledge/decisions/ADR-0246-catalog-full-percpackage-bundles.md)  | Catalog structure: every package priced+displayed (F1b) · editions dissolve into bundles + set redesign (F2b) · compliance 3-SKU carve, formula-priced (F6)                                                                                   | Commerce    | accepted | extends 0227; supersedes 0238's no-separable-core premise        |
| [0247](../knowledge/decisions/ADR-0247-bundle-commerce-mechanics.md)         | Bundle mechanics: 25%-off-sum anchor (F3a) · snapshot-at-sale growing bundles (F7a) · self-serve upgrade crediting (F8a)                                                                                                                      | Commerce    | accepted | extends 0137/0244/0245                                           |
| [0248](../knowledge/decisions/ADR-0248-oss-line-standard-split-checklist.md) | OSS-line written standard: buyer-based + ratchet-at-first-publish + SPDX boundary (F4a) · split checklist + 4 gate checks (F5a)                                                                                                               | Doctrine    | accepted | extends 0094/0136; constrains all future flips                   |
| [0249](../knowledge/decisions/ADR-0249-catalog-followup-g-locks.md)          | G-series locks: Persona+Provenance bundle set (G1) · billing verify/orchestration split (G3) · auth-sso carve (G4) · credits decouple-then-flip (G5, override) · rls admin-write carve (G6, override) · metas bundle-only (G7); G2 redirected | Commerce    | accepted | realizes 0246 mandate; applies 0248; extends 0247                |
| [0250](../knowledge/decisions/ADR-0250-kit-tiering-brand-frontends.md)       | Kit tiering: ui Apache floor + ui-pro commercial (own SPEC) + brand private (G2a P3, override) · staged buildout · per-package ./ui subpath frontends + S-class wave 1                                                                        | UI/Commerce | accepted | closes 0249's G2 redirect; extends 0246/0248; respects 0044/0078 |

### Kickoff-E picker rounds (0251-0254, 2026-07-06) - status `accepted`

Three rounds in the independent-build-wave session, run after a 7-agent research fan-out
(briefs: `outputs/research/kickoff-e-research-2026-07/`). One operator pick above the tabled
rec (0252's badge+email), one custom-answer lock (0254's PAYG-only tracker direction).

| #                                                                                     | Title                                                                                                                                                                                                                                                          | Domain  | Status   | Relations                                                     |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------- | ------------------------------------------------------------- |
| [0251](../knowledge/decisions/ADR-0251-updates-window-enforcement-renewal-skus.md)    | Updates-window enforcement: signed `updatesUntil` claim + Worker/npm per-version filter (dist-tags recompute, /issue re-mint, absent=unbounded) · ONE renewal product w/ per-SKU prices + RENEWAL_BOOK + per-(account,entitlement) window · mixed copy posture | Billing | accepted | extends 0244/0136/0223/0110/0113; respects 0010/0106          |
| [0252](../knowledge/decisions/ADR-0252-credit-expiry-fifo-implementation.md)          | Credit expiry impl: expires_at on credit_event + append-only grant_consumption · FIFO created_at/expires_at/id · sandbox backfill +12mo · badge AND T-30d email (operator pick)                                                                                | Billing | accepted | extends 0245/0007/0024/0218                                   |
| [0253](../knowledge/decisions/ADR-0253-build-state-generated-counts-sot-check.md)     | build-state rework: generated per-package counts via 7th sot check (checkPackageCountParity, --update) + banner squash; prose hand-written                                                                                                                     | Docs    | accepted | closes ledger 3aa54d29/0d5291a4/f5d1a436; extends bun-run-sot |
| [0254](../knowledge/decisions/ADR-0254-measurement-pair-citation-loop-docs-funnel.md) | Measurement pair: PAYG-only citation probe loop (OpenRouter monthly cron; repo doc + PostHog; 18-question canonical set) · docs funnel split-C (Plausible top-of-funnel + PostHog account_created; F8 dashboard-only intact)                                   | GTM     | accepted | closes gaps #9/#12; extends 0237-F8/0118; respects 0236       |

---

## Accepted is not the same as shipped

An ADR status of `accepted`/`locked`/`proposed` records a **locked decision**, not a built
feature. Per the authoritative build-reality note (`knowledge/decisions/ADR-0082-go-live-site-posture.md`
section 3) only the **base substrate** (`kernel`, `tenancy-rls`, `field-crypto`, `auth`,
`billing`, `credits`) plus **`create-caisson`** (`cli`) are considered genuinely built; the
edition packages are "structure only" relative to a shippable product.

**Filesystem spot-check (2026-06-28)** qualifies that: the edition packages do carry real
`src/` + tests on disk, not empty stubs - e.g. `packages/compliance` (16 src .ts / 11 tests),
`packages/local-ai` (14 / 9), `packages/audit-worm` (7 / 6), `packages/agent-kernel` (8 / 7),
`packages/local-store` (8 / 7). So "structure only" understates the on-disk code, but the
edition product surfaces are not feature-complete. Treat ADR-0082 section 3 as the authority on
product readiness and this index purely as the decision catalog. Do **not** read an `accepted`
row here as "this edition is fully built".

## Accuracy flags

- **Stale "proposed" headers.** ADRs 0001-0019 and 0024 still read `Status: proposed` in their
  own header text (written at the Phase-5 spec, pending "Gate 4"). The board
  (`docs/state/decisions-and-forks.md` line 90) treats the whole 0001-0024 range as locked / in
  force. This index prints the literal header value and flags the gap here rather than silently
  promoting them.
- **ADR-0024 internal renumber note** in its own header reads "Renumbered 0020->0023"; the file
  is on disk as `ADR-0024`. Treated as a stale drafting artifact; its substance (amends 0007
  idempotency) is unaffected.
- **Number gap 0025-0039** is unused (reserved block before the 0040 brand set); not a missing
  file.
- **Domains** in the table are this index's own one-word synthesis for scanning, not a field
  in the ADR files (unverified as a canonical taxonomy - the ADRs carry no `domain:` header).
