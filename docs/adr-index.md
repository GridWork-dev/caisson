# ADR index

Canonical catalog of every Architecture Decision Record in `knowledge/decisions/`. This
file is a **synthesized view** (number -> title -> domain -> status -> supersession). It does
not own decision content: the ADRs themselves are the source of truth, and the live board
`docs/state/decisions-and-forks.md` (CLAUDE.md SoT #1) owns "locked vs open". On any
conflict, the ADR file and the board win over this index.

- ADRs are append-only and immutable (ADR-0006). A later ADR _supersedes_ a clause; it
  never edits the prior file. So most rows below are **partial** supersessions (one clause),
  not a wholesale replacement.
- 87 ADR files on disk (`ls knowledge/decisions/ | wc -l` = 87). Numbering is **not**
  contiguous: present are **0001-0024** and **0040-0102**; **0025-0039 are an unused gap**
  (no files). The 0040 jump was a deliberate block reservation for the brand/positioning set.
  **0089-0093** = the 2026-06-28 picker-round locks (billing X-2 / migrate / mig-bundle / bin / local-debit);
  **0094-0096** = the 2026-06-29 GTM-report locks (open-core Base / GTM offer / services-docs);
  **0097-0102** = the 2026-06-29 design-system-harden track locks (component-recipe+kit / token+theming / gates / signature-animation / brand-mark "Pressure vessel" / Phase-2 hero static-code-as-proof).
- Status tokens read from each ADR's own header line:
  - `proposed` = literal header value on the founding + foundations sets (0001-0019, 0024).
    Per the board (line 90) these are **in force / locked** despite the stale "proposed"
    header text written during the Phase-5 spec; the header was never updated. See accuracy
    flags at the bottom.
  - `locked` = D9 module-pipeline set (0020-0023).
  - `accepted` = brand/wave-0/wave-1/design/gtm sets + picker-round locks (0040-0093).

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
  self-serve). Current: `0082`.
- **Field-crypto:** `0006` (compliance data layer, base "env-key") -> `0043` (per-tenant key
  derivation, amends the base-tier key clause) -> `0055` (P2: crypto-shred granularity +
  row-level AAD). Cipher/envelope implemented by `0045`/`0046`.
- **Go-live site posture:** `0085` + `0087` (pre-launch waitlist CTA) + `0081` (indicative
  prices) all superseded by `0082` (live self-serve, committed prices, true-to-built claims).

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

| #                                                                      | Title                                              | Domain     | Status   | Relations                       |
| ---------------------------------------------------------------------- | -------------------------------------------------- | ---------- | -------- | ------------------------------- |
| [0013](../knowledge/decisions/ADR-0013-testing-golden-file-harness.md) | Testing strategy + golden-file harness (PGlite)    | Testing    | proposed | -                               |
| [0014](../knowledge/decisions/ADR-0014-database-orm-migrations.md)     | Database, ORM (Drizzle), migration strategy (Neon) | Database   | proposed | migration assembly -> 0070      |
| [0015](../knowledge/decisions/ADR-0015-auth-session-rls-seam.md)       | Auth (better-auth), session shape, auth->RLS seam  | Auth       | proposed | -                               |
| [0016](../knowledge/decisions/ADR-0016-ci-cd-standards-gate.md)        | CI/CD pipeline + the standards gate                | CI/CD      | proposed | + eval gate 0062                |
| [0017](../knowledge/decisions/ADR-0017-billing-stripe-mor.md)          | Billing (Stripe), tax, webhook verification, MoR   | Billing    | proposed | -                               |
| [0018](../knowledge/decisions/ADR-0018-jobs-email.md)                  | Background jobs (Trigger.dev) + email (Resend)     | Jobs/Email | proposed | Resend reused by 0085           |
| [0019](../knowledge/decisions/ADR-0019-error-model.md)                 | Typed error model + 402 credit-gate response       | Errors     | proposed | extends 0002; -> 0075 EventSink |
| [0024](../knowledge/decisions/ADR-0024-credit-idempotency-index.md)    | Credit idempotency index                           | Credits    | proposed | amends 0007                     |

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

| #                                                                          | Title                                                        | Domain       | Status   | Relations                                    |
| -------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------ | -------- | -------------------------------------------- |
| [0078](../knowledge/decisions/ADR-0078-brand-foundation-expansion.md)      | Brand foundation expansion: mark, icon, illustration, motion | Brand/Design | accepted | supersedes 0042 (widens; keeps token center) |
| [0079](../knowledge/decisions/ADR-0079-seo-strategy.md)                    | SEO strategy: dev-kit long-tail + programmatic engine        | SEO          | accepted | relates 0040, 0084, 0086, 0087->0081         |
| [0080](../knowledge/decisions/ADR-0080-copy-messaging-expansion.md)        | Copy & messaging: per-surface laws over specs/04 voice       | Copy         | accepted | extends specs/04                             |
| [0081](../knowledge/decisions/ADR-0081-pricing-indicative-placeholders.md) | Pricing display: indicative placeholder prices (pre-launch)  | Pricing      | accepted | supersedes 0087; **superseded by 0082**      |

### Go-live (0082-0083) - status `accepted` (current authority)

| #                                                                       | Title                                                      | Domain      | Status   | Relations                                                       |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- | ----------- | -------- | --------------------------------------------------------------- |
| [0082](../knowledge/decisions/ADR-0082-go-live-site-posture.md)         | Go-live: live self-serve, committed pricing, true-to-built | GTM/Pricing | accepted | supersedes 0085/0087 waitlist stance + 0081 placeholder pricing |
| [0083](../knowledge/decisions/ADR-0083-local-first-fully-commercial.md) | Local-first AI is fully commercial (removes AGPL flank)    | Licensing   | accepted | supersedes 0023 flank + 0010 open-core carve-out                |

### GTM site (0084-0087, renumbered from 0045-0048) - status `accepted`

| #                                                                  | Title (was)                                                   | Domain             | Status   | Relations                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------ | -------- | ------------------------------------------------------------- |
| [0084](../knowledge/decisions/ADR-0084-gtm-site-stack.md)          | GTM site stack: Fumadocs + MDX -> CF Pages (was 0045)         | GTM-site           | accepted | renumbered per 0088                                           |
| [0085](../knowledge/decisions/ADR-0085-waitlist-capture-seam.md)   | Waitlist capture seam: CF Function -> Resend (was 0046)       | GTM-site           | accepted | renumbered per 0088; pre-launch CTA stance superseded by 0082 |
| [0086](../knowledge/decisions/ADR-0086-web-analytics-plausible.md) | Web analytics: Plausible, cookieless (was 0047)               | GTM-site/Analytics | accepted | renumbered per 0088                                           |
| [0087](../knowledge/decisions/ADR-0087-hero-sku-surface.md)        | Hero SKU surface: structure shown, prices deferred (was 0048) | GTM-site/Pricing   | accepted | renumbered per 0088; **superseded by 0081 -> 0082**           |

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

### GTM-report locks (0094-0096, 2026-06-29) - status `accepted`

| #                                                                   | Title                                                                                            | Domain       | Status   | Relations                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------ | -------- | ------------------------------------ |
| [0094](../knowledge/decisions/ADR-0094-open-core-base-apache2.md)   | Open-core Base: Apache-2.0 base substrate (editions stay commercial)                             | Licensing    | accepted | amends 0023/0050/0083; re-license W1 |
| [0095](../knowledge/decisions/ADR-0095-gtm-offer-structure.md)      | GTM offer structure: free EU-AI-Act sample · Enterprise tier · annual cadence · pricing deferred | GTM/Pricing  | accepted | extends 0012/0081/0082/0089          |
| [0096](../knowledge/decisions/ADR-0096-services-docs-standalone.md) | `services/docs` standalone AI-native docs service                                                | Docs/Support | accepted | composes 0009/0084; build at P6      |

### Design-system-harden track (0097-0102, 2026-06-29) - status `accepted`

Eight forks (F1-F8) from `outputs/kickoffs/design-marketing-rebuild.md`, locked on a 7-agent code-grounded
fanout. Adopts the _mechanism_ of `outputs/research/wardfile-frontend-playbook.md` (token/brand VALUES stay
Caisson's). The track is harden-not-build (Caisson already owned the token foundation).

| #                                                                             | Title                                                                            | Domain           | Status   | Relations                                                                  |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------- | -------- | -------------------------------------------------------------------------- |
| [0097](../knowledge/decisions/ADR-0097-component-recipe-kit-packaging.md)     | Component recipe + framework-agnostic kit packaging (F1/F2/F7/F8)                | Design/UI        | accepted | adopts wardfile playbook; Lucide per DESIGN.md §4; ADR-0078/0042/0003/0044 |
| [0098](../knowledge/decisions/ADR-0098-token-theming-hardening.md)            | Token & theming hardening: breakpoint ladder · scrim · 3-prong dark mode (F4/F3) | Design/Tokens    | accepted | extends 0042/0078; ThemeToggle per 0097                                    |
| [0099](../knowledge/decisions/ADR-0099-deterministic-design-quality-gates.md) | Deterministic design-quality gates (staged) + advisory critic (F5)               | Design/CI        | accepted | extends 0016/0022/0062; enforces 0097/0098                                 |
| [0100](../knowledge/decisions/ADR-0100-signature-animation-css-svg.md)        | Marketing signature animation: tokenized CSS/SVG, video deferred (F6)            | Design/Marketing | accepted | adopts hero-concepts; under 0078 §6 / 0080 §3                              |
| [0101](../knowledge/decisions/ADR-0101-brand-mark-pressure-vessel.md)         | Brand mark: the "Pressure vessel" (operator pick); signature sketch deferred     | Design/Brand     | accepted | supersedes 0078 §2 glyph; defers 0100 sketch; under 0078 §8 / 0097         |
| [0102](../knowledge/decisions/ADR-0102-phase2-hero-static-code-as-proof.md)   | Phase-2 hero: static code-as-proof (operator pick); three.js spike deferred      | Design/Marketing | accepted | amends 0100/0101 hero plan; under 0080/0079/0078 §6 §8; ADR-0082           |

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
