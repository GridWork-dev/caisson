---
updated: 2026-07-09
status: live
adr_ceiling: 0305
---

# Decisions & Forks — live board

The single live board (CLAUDE.md source-of-truth #1). Locked → an ADR; open → waits for the
operator. Never auto-decide a fork.

## Locked (→ ADRs / specs)

| #                                 | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Where                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Architecture                      | Monorepo, **Option C** (composable packages + generator/registry)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | ADR-0003, ADR-0004                                                     |
| v1 scope                          | Base + **all 4 editions** (Compliance · AI Kit · Local-first · Agentic-Dev)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | specs/00                                                               |
| Lead edition                      | **Compliance** — broad base + SOC2/HIPAA evidence kit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | specs/00, ADR-0006                                                     |
| Generic boilerplate               | Included as table-stakes base, framed under differentiators                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | specs/00                                                               |
| Tooling                           | Bun + Turborepo (`~2.5.x`; 2.10 SIGBUS-crashes locally) + changesets; one `tooling/` standards gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | ADR-0001, ADR-0002                                                     |
| Tenancy                           | Fail-closed multi-tenant RLS (FORCE + test)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | ADR-0005                                                               |
| Compliance data layer             | WORM + append-only audit chain + field-crypto                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | ADR-0006                                                               |
| Credits                           | Integer wallet + append-only ledger + debit-before-spend (402)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | ADR-0007                                                               |
| Buyer MCP                         | Auth-gated, entitlement-scoped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | ADR-0008                                                               |
| Support                           | Custom: Discord + Python RAG + hosted inference + cloud runners                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | ADR-0009                                                               |
| Support-bot impl                  | **BUILT** (P6 Bucket C item 2): discord.py 2.x · OpenRouter (one key) · RAG via `services/docs` `/query` · thread+Postgres `support_ticket.ai_brief` escalation · full-build, live secrets+cloud deploy (Railway rec) = operator-gated seam                                                                                                                                                                                                                                                                                                                                                                                                                                                                | ADR-0105 (implements 0009)                                             |
| Licensing (offline)               | Ed25519 offline license + pro-private firewall (licensing _model_ now fully-commercial, below)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | ADR-0010 (super. 0023)                                                 |
| License issuer impl               | **BUILT** (P6 Bucket C item 1): private `@caisson/license-issue` (never published) · `node:crypto` PKCS8 Ed25519 `Signer` port over `CAISSON_LICENSE_SIGNING_KEY` (KMS un-wired seam) · signs exactly `canonicalize(parse(claims))` (reuses license-verify schema/codec) · lazy bearer-gated `POST /issue` (services/license app+server) resolving entitlements via `resolveAccountEntitlements`; **PRODUCTION verify key baked** into license-verify (rotated ×2 per ADR-0226, 2026-07-05 — active fp `a170f7a0ab89bab0`, the original ADR-0107 `0ae7d2abb886ca3d` key retired), tests use runtime-minted dev keys via the `verifyLicenseWithKey` seam (prod-signed goldens retired — they were the leak) | ADR-0108 (implements 0010, reconciled to 0107)                         |
| AI config                         | Provider-agnostic + agent-assisted setup                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | ADR-0011                                                               |
| Commerce                          | One-time editions + bundle + per-module + subscription/credits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | ADR-0012                                                               |
| Testing                           | `bun test` + PGlite integration + golden-file harness (`BLESS=1`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | ADR-0013                                                               |
| Database / ORM                    | **Drizzle**; host **Neon** (swappable); numbered+idempotent migrations + `schema_version` checksum ledger                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | ADR-0014                                                               |
| Auth                              | **better-auth** (self-hosted, owns Drizzle tables); EdDSA-JWT+JWKS cross-plane seam; `withTenant` = sole RLS entry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | ADR-0015                                                               |
| CI/CD                             | GitHub Actions; 6 required jobs (build·lint·unit·integration·standards-gate·golden-file); gate = sole registry ingress                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | ADR-0016                                                               |
| Billing / payments                | **Stripe + Stripe Tax** (PSP, operator=MoR); `BillingProvider` port; HMAC-raw-body webhook verify; P1 seam / P6 orchestration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | ADR-0017                                                               |
| Jobs / email                      | **Trigger.dev** (self-hostable) + **Resend**; ports w/ test drivers; billing/credit side-effects enqueued not inline                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | ADR-0018                                                               |
| Error model                       | Typed `CaissonError` hierarchy in `kernel`; 402 credit-gate shape; tenancy denial = 404 (no existence leak)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | ADR-0019                                                               |
| Module production pipeline (D9)   | manifest · publish flow (one ingress) · lint gates — **LOCKED** (operator sign-off after 2 adversarial passes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | ADR-0020–0022                                                          |
| Private registry host             | **`registry.caisson.sh`** — self-hosted CF Worker serving the npm install protocol (packuments + tarballs from R2), license-token-authed; supersedes the dead pre-2026-07-02 GH-Packages-based buyer channel. Built, dormant behind `CAISSON_PUBLISH_DRY_RUN=true` pending operator DEPLOY (wrangler route + R2 bucket)                                                                                                                                                                                                                                                                                                                                                                                    | ADR-0021 super. by ADR-0223 (built)                                    |
| Boundary enforcement              | **Both**: ESLint `no-restricted-imports` + Bun standards-gate + dependency-cruiser                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | ADR-0022                                                               |
| **Licensing model**               | **Fully commercial** — every module `LicenseRef-Caisson-Commercial` (proprietary EULA: use in products, no resale); ~~AGPL Local-first the sole open flank~~ → **AGPL flank killed; Local-first now commercial too (ADR-0050)**. Supersedes ADR-0010's open-core base                                                                                                                                                                                                                                                                                                                                                                                                                                      | ADR-0023 (flank super. 0050)                                           |
| Credit idempotency                | partial-unique `(source_event_id, event_type)` + `(account_id, idempotency_key)` + one-of-two CHECK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | ADR-0024 (amends 0007)                                                 |
| **Hero positioning**              | **Compliance wedge under a production-rigor umbrella**; ICP buyer-firewall; compliance-update SKU split; EU-AI-Act gated add-on; sequenced launch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | ADR-0040                                                               |
| **Product name**                  | **Caisson** · `@caisson/*` · `caisson.sh` (closes the name fork; supersedes working name `stack`/`Forge`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | ADR-0041                                                               |
| **Design-system foundation**      | Palette **A** (cold-steel teal) + type **2** (Structural: Hubot Sans + Martian Mono); OKLCH token objects → generated `tokens.css`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | ADR-0042                                                               |
| **Site hosting**                  | **Cloudflare Pages** (DNS+host one vendor); `caisson.sh` zone + records via Terraform (`infra/`); Neon over HTTP for data                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | this session (board)                                                   |
| **Docs tooling**                  | **Single Next site + MDX** (marketing + docs, one deploy target/brand)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | this session (board)                                                   |
| Reference-app stack               | Framework-agnostic core (packages never import a framework); **edition reference apps standardize on Next.js (App Router)**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | ADR-0044                                                               |
| **Field-crypto keys**             | **Per-tenant HKDF derivation** at base tier (closes shared-key cross-tenant breach) + pluggable `FieldKeyProvider` KMS port (AWS adapter, GCP/Azure/Vault seam)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | ADR-0043 (amends 0006)                                                 |
| **Build sequencing**              | **Shared-first → parallel editions**: Wave 0 shared substrate (field-crypto · registry runtime · cli skeleton) → Wave 1 P2/P3/P4 editions in isolated worktrees → Wave 2 GTM                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | this session (board)                                                   |
| **GTM buildout (now)**            | **Marketing site + docs site** queued as parallel session buckets; support-bot + commerce/license deferred to a later wave                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | this session (board)                                                   |
| **Field-crypto AEAD cipher**      | **AES-256-GCM via native `node:crypto`** (zero-dep, FIPS-approved; 2^32 nonce ceiling is per-tenant via ADR-0043) behind an `AeadCipher` seam; fresh CSPRNG IV/write + AAD = `tenant∥kv∥column`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | ADR-0045 (Wave-0 Fork 1)                                               |
| **Ciphertext envelope**           | **Self-describing binary** `[ver∣alg∣key_version∣nonce∣ct∣tag]` base64→`text`; decrypt reads ver/alg/kv from the value (AWS-ESDK/Tink-style); JSON only as the golden representation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | ADR-0046 (Wave-0 Fork 2)                                               |
| **Registry read-path**            | **Static CI-built `index.json` = source of truth + allowlist** (parse-or-throw); a thin Cloudflare Worker read handler ships as an **un-deployed, unit-tested seam**; entitlement filtering = P6 (seam since DEPLOYED LIVE — caisson-registry.broken-wood-97a9.workers.dev; see docs/build-state.md)                                                                                                                                                                                                                                                                                                                                                                                                       | ADR-0047 (Wave-0 Fork 4)                                               |
| **Generator engine**              | **In-repo template copy + typed token/JSON-merge transform** (degit-pattern, no network) behind a generator seam; allowlist-validated before any path/subprocess; ts-morph deferred behind seam                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | ADR-0048 (Wave-0 Fork 5)                                               |
| **Codegen credit-debit**          | **Debit-before-spend at the generation entry**, caller `idempotency_key` (UUID), inside `withTenant` before any file write; 402 aborts with nothing written; same-key retry debits once                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | ADR-0049 (Wave-0 Fork 6)                                               |
| **HKDF salt (Fork 3)**            | **Confirms ADR-0043** — single per-deployment non-secret `FIELD_CRYPTO_SALT`; tenant separation lives in HKDF `info` (not the salt). No new ADR; recorded here per the kickoff (operator did not deviate)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | ADR-0043 (confirmed)                                                   |
| **Local-ai licensing (W1)**       | **Fully-commercial — AGPL killed.** Local-first AI ships `LicenseRef-Caisson-Commercial` like every edition; uniform licensing; collapses the copyleft-downward forks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | ADR-0050 (super. 0023 flank)                                           |
| **WORM retention mode (W1)**      | GOVERNANCE default everywhere + buyer-opt-in per-evidence-class COMPLIANCE escalation behind an irreversible-opt-in guard; never COMPLIANCE local/test                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | ADR-0051                                                               |
| **Audit-chain persistence (W1)**  | Entries in append-only Postgres (missing-GRANT immutability); anchor minted per-append into WORM (length-keyed); advisory-lock serialization; RFC-3161/Rekor = premium                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | ADR-0052                                                               |
| **Version-table schema (W1)**     | Append-only; REVOKE UPDATE/DELETE immutability; `current` derived (no-successor predicate); Zod-strict JSONB provenance parsed pre-INSERT                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | ADR-0053                                                               |
| **WORM ArtifactStore (W1)**       | Standalone paid primitive owns its store; `ArtifactStore` port (S3 Object-Lock prod / Local dev; S3 test-doubled in CI); per-tenant key-prefix isolation + retention floor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | ADR-0054                                                               |
| **field-crypto P2 (W1)**          | Hybrid: derived default + stored-DEK crypto-shred upsell (GDPR Art.17, chain commits to ciphertext); transparent column + explicit `encryptField(…,rowId)` AAD for SEC/HIPAA; randomUUID PKs. **Closes Wave-0 TM2**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | ADR-0055 (amends 0043/0006)                                            |
| **Evidence-pack signing (W1)**    | Per-tenant Ed25519 (@noble) over canonical manifest + chain anchor; RFC-3161 timestamp; DSSE/Sigstore = premium tier                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | ADR-0056 (amends 0006)                                                 |
| **Control model (W1)**            | Clean-room own-authored SOC2/HIPAA catalog, SCF-parity for coverage only (**never ingest SCF CC-BY-ND JSON**); canonical-catalog + per-framework crosswalk; EU-AI-Act slot                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | ADR-0057                                                               |
| **Evidence-pack generator (W1)**  | Deterministic golden-fixturable pack (timestamp/sig injected at edge), OSCAL seam; **flag-never-guess** on missing evidence; output-copy guardrail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | ADR-0058                                                               |
| **AI-Kit gateway (W1)**           | Single metered-inference gateway (the enforced chokepoint) backed by **Vercel AI SDK v5**; provider-SDK calls confined to the gateway (ADR-0022 Gate-2 carve-out)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | ADR-0059                                                               |
| **AI-Kit metering (W1)**          | estimate→reserve→reconcile vs append-only credit_event; PG-atomic spend; integer credit units; soft/hard caps + circuit breaker                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | ADR-0060                                                               |
| **Prompt registry (W1)**          | Append-only versioned prompts; name+version addressing + mutable production pointer; typed injection-safe templating; prompt→usage→eval linkage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | ADR-0061                                                               |
| **Eval harness + CI gate (W1)**   | Grader taxonomy + datasets bound to prompt versions; **regression-vs-committed-baseline** gate (BLESS-style) as a distinct turbo task; Caisson-monorepo only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ADR-0062                                                               |
| **Guardrails (W1)**               | Gateway in/out points; pluggable moderation port; PII redaction reuses field-crypto; **fail-closed** default + per-policy opt-out; `GuardrailError`; emits to observability                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | ADR-0063                                                               |
| **Local-first edition (W1)**      | **Two-way sync BUILT in-house** (CRDT/LWW + tombstones on SQLite, SyncEngine port); sqlite-vec + dim lock; InferenceBackend port; FTS5+RRF hybrid exit gate; DB-file-per-tenant                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | ADR-0064                                                               |
| **agent-kernel base (W1)**        | New base `@caisson/agent-kernel` (schema + lifecycle FSM + hooks dispatcher) consumed by the edition + cli/mcp-server; edition = composition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ADR-0065                                                               |
| **Agentic-Dev edition (W1)**      | Governed TS kernel (reuses audit-chain + versioning) + **engine-neutral** multi-harness emitter (.claude · Codex AGENTS.md · Cursor from one schema); not vendor-coupled                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | ADR-0066                                                               |
| **local-store base (W1)**         | New base `@caisson/local-store` (vec+FTS+RRF) composed by local-ai + agent-dev; clean down-only (AGPL gate moot post-0050)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | ADR-0067                                                               |
| **Generator engine (W1)**         | Real `templates/` tree + token/JSON-merge transform (no network); FileSetWriter re-asserts path safety + atomic write; disk write inside the debit txn                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | ADR-0068                                                               |
| **Publish flow (W1)**             | `GITHUB_TOKEN` + `packages: write` (no stored secret); changesets orchestration; **incremental backfill** (publish-what-exists; editions publish as they land); `--edition` degrades gracefully                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | ADR-0069                                                               |
| **Migration assembly (W1)**       | Per-package numbered migrations + a compose-time assembler → ONE ordered sequence + single `schema_version` ledger (ADR-0014)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | ADR-0070                                                               |
| **Entitlement expansion (W1)**    | Registry-derived membership graph: resolver expands edition/bundle purchase → member-module slug set at the gate; registry = source of truth                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ADR-0071                                                               |
| **Buyer-repo boundary (W1)**      | Generated repo gets a standalone harness (trimmed CI + golden + AGENTS.md, commercial); Caisson-internal = registry/publish + standards-gate authoring + eval gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | ADR-0072                                                               |
| **Local tenancy (W1)**            | **One SQLite DB file per tenant** (path = boundary); ADR-0005 boundary is per-tier (Postgres=RLS, local=DB-file); local editions multi-tenant-capable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | ADR-0073                                                               |
| **Credit event-types (W1)**       | Base generic `feature_debit`/`feature_grant` + validated editions-supplied `feature` tag; no base-enum change per edition (down-only safe)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | ADR-0074 (amends 0007/0024)                                            |
| **Observability (W1)**            | Base `EventSink` port (OTel/Postgres) + shared evidence/usage/eval schemas; WORM audit-chain stays strictly separate; redaction at the sink                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | ADR-0075                                                               |
| **Buyer MCP extensibility (W1)**  | Tool-registration seam + per-tool entitlement gating; editions ship buyer tools **in v1**; MCP = product surface, not just a generator RPC                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | ADR-0076 (extends 0008)                                                |
| **Edition versioning (W1)**       | Independent module versions + edition manifest pins an exact member-version set; reproducible `install <edition>@x.y.z`; subscription update target                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | ADR-0077                                                               |
| **Brand foundation expansion**    | Mark (waterline-over-chamber glyph) + favicon kit · line-icon system (Lucide/Phosphor + bespoke domain glyphs) · blueprint + animated-waterline illustration · **expressive** tokenized motion · **elevation + glow scale (supersedes shadowless)** · brand laws + DESIGN.md. Keeps palette A + Structural type (widened, not changed)                                                                                                                                                                                                                                                                                                                                                                     | ADR-0078 (supersedes 0042)                                             |
| **SEO strategy**                  | Own the dev-kit long-tail (cede head terms) + programmatic frameworks×control engine (pilot SOC2/HIPAA, 90-day gate) + root @graph JSON-LD · buildMetadata() helper · self-host fonts · CWV/a11y CI baseline                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ADR-0079                                                               |
| **Copy & messaging expansion**    | Dev-kit-noun register (never "platform"/"automate compliance") · code-as-proof + CI green-checks strip · technical-vs-administrative honesty boundary · CTA-by-tier · CISO/procurement path                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | ADR-0080 (extends specs/04)                                            |
| **Pricing display**               | **Indicative placeholder prices** shown with a "subject to change before launch" frame (Compliance from $1,299 · AI-Kit from $599 · Bundle $2,499 · Compliance-Updates $199/mo · Developer $99/mo · Local-first free). Final numbers stay the open fork. **Superseded by ADR-0082/0083** (go-live: committed pricing + Local-first now commercial, not free)                                                                                                                                                                                                                                                                                                                                               | ADR-0081 (super. 0087; super-by 0082/0083)                             |
| **Go-live site posture**          | Site copy reads as a **live, finished product**: live self-serve checkout CTAs (not waitlist-capture), committed pricing shown, claims true-to-built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | ADR-0082 (super. 0085/0087/0081 stances)                               |
| **Local-first fully commercial**  | Local-first AI is a regular commercial edition — **AGPL flank removed entirely** (no free/copyleft tier anywhere); reaffirms + finalizes the ADR-0050 reversal at the licensing/site level                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | ADR-0083 (super. 0023 flank / 0010 open-core)                          |
| **GTM site stack**                | Single **Next 16 + Fumadocs MDX** app (`apps/site`, marketing+docs); `--cs-*` token contract. **Deploy mode (static-export → Cloudflare Pages direct-upload) superseded by ADR-0114** (Node `standalone` → Railway); the Fumadocs/MDX/Next-16 framework choice is unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                | ADR-0084 (was 0045; renum. ADR-0088; deploy mode super. 0114)          |
| **Waitlist capture seam**         | Cloudflare Pages Function → Resend **Segments**; Zod-`.strict()` + `fetchWithTimeout` + in-function security headers; inert until wired. **Retired as the conversion model by ADR-0082** (now low-key product-updates capture)                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | ADR-0085 (was 0046; renum. ADR-0088)                                   |
| **Web analytics**                 | **Plausible** — cookieless, no consent banner; direct cloud script via `next/script`; CSP names only `plausible.io`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | ADR-0086 (was 0047; renum. ADR-0088)                                   |
| **Hero SKU surface**              | SKU structure shown, prices deferred to the waitlist. **Superseded** by ADR-0081 (indicative prices) → ADR-0082 (committed pricing + live self-serve)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | ADR-0087 (was 0048; renum. ADR-0088)                                   |
| **ADR-number collision fix**      | Renumbered the GTM `0045–0048` set → `0084–0087` (Wave-0 substrate keeps `0045–0048`); one-time, operator-sanctioned append-only exemption of ADR-0006                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | ADR-0088                                                               |
| **Open-core Base**                | **Apache-2.0 base substrate** (kernel·auth·tenancy-rls·ui·billing·credits·jobs·email·ai-config·mcp-server); editions + field-crypto + audit-worm + generator + registry + updates stay **commercial**. Amends the all-commercial stance of 0023/0050/0083 for the BASE tier only. Re-licensing scheduled (own PR, W1)                                                                                                                                                                                                                                                                                                                                                                                      | **ADR-0094** (amends 0023/0050/0083)                                   |
| **GTM offer structure**           | Free Apache-2 EU-AI-Act eval sample (create-caisson-emitted) · Enterprise "Contact us" no-price tier · **annual** update cadence (super. 0081 monthly) · final pricing numbers **deliberately deferred** to P6 (reports' $2,999–4,999 anchor = the input)                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **ADR-0095** (extends 0012/0081/0082/0089)                             |
| **`services/docs` scope**         | **Standalone AI-native docs service** (separate from `apps/site` Fumadocs) feeding the support-bot RAG + buyer agents + `llms.txt`; build at P6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **ADR-0096**                                                           |
| **Registry schema/service split** | **W1 impl lock.** Open `@caisson/registry-schema` (Apache-2.0) holds the pure contract (manifest+index schema · allowlist helpers · feature-tags · entitlement-expansion, `zod`/`fs`-only); commercial `@caisson/registry` keeps the SERVICE (worker · index-builder · publish) + re-exports the schema. Resolves the open↔commercial conflict ADR-0094 left under-specified (credits/mcp-server depended "up" on the commercial registry). Open set = the 0094 ten **+ registry-schema**                                                                                                                                                                                                                  | **ADR-0097** (amends 0094)                                             |
| **Credit-denomination home (B1)** | **`@caisson/kernel`** owns the single credit denomination (`CREDIT_CONVERSION` `microUsdPerCredit:1000` + `centsToCredits` round-DOWN grant); `ai-meter` (cost, rounds up) + `pricebook` (commerce, rounds down) both import it (down-only). Resolves the **ADR-0089 SD-3** open sub-decision (denomination home), implemented in code-wiring **B1**                                                                                                                                                                                                                                                                                                                                                       | **ADR-0098** (refines 0089)                                            |
| **Component recipe + kit**        | F1 adopt the Wardfile recipe (Radix behavior + co-located per-component CSS + `data-*` variants + local-indirection vars; retires global-BEM + inline-style) · F2 move primitives → `@caisson/ui` **framework-agnostic** (raw-`.tsx` `./components/*`, Link injected via `asChild`, `lucide-react` peer-dep; studio consumes the same kit) · F7 studio → Next 16 · F8 keep **Lucide** (cite DESIGN.md §4, reject playbook Phosphor)                                                                                                                                                                                                                                                                        | **ADR-0099**                                                           |
| **Token & theming hardening**     | F4 add rem breakpoint ladder `xs30…2xl90` + `scrim` semantic token; **keep** `surface1`/`surface2` (no rename) · F3 **3-prong dark mode** (operator override of the 2-prong rec): dark `:root` default + `prefers-color-scheme:light` OS-seed + manual `[data-theme]` override-wins; ThemeToggle follows OS until first click then pins, **icon not text**                                                                                                                                                                                                                                                                                                                                                 | **ADR-0100**                                                           |
| **Design-quality gates**          | F5 wire all 6 deterministic gates staged (token-drift CI byte-compare → derived contrast-matrix in `packages/ui` → anti-slop AST guard in eslint-config → TS-compiler copy-guard in standards-gate → breakpoint guard → **axe at SHIP, not in `bun run check`**) + a non-blocking `findings.toml` advisory critic; replaces+deletes the duplicated hand-copied contrast tests                                                                                                                                                                                                                                                                                                                              | **ADR-0101**                                                           |
| **Signature animation**           | F6 v1 = tokenized **CSS/SVG** four-beat signature (deny→chain→hold→sign; Concept A evolves `home-hero-motion.tsx`); **video pipeline deferred** to a fast-follow (real product capture only). **Sketch execution now deferred-for-rework (ADR-0103) — the one deferred design surface; blank slot reserved on the site.**                                                                                                                                                                                                                                                                                                                                                                                  | **ADR-0102** (sketch defer → 0103)                                     |
| **Brand mark**                    | **"Pressure vessel"** — the chamber head-on as a sealed steel port, one instrument light. Operator pick over A (diving-bell cross-section) / C (steel iris) on the 16px-favicon test. app-icon/favicon carries the accent light; in-product `Glyph` stays monochrome (≤10% budget). **Supersedes the ADR-0078 §2 waterline-over-chamber placeholder glyph.** Bespoke `caisson` domain icon stays distinct.                                                                                                                                                                                                                                                                                                 | **ADR-0103** (super. 0078 §2 glyph)                                    |
| **Phase-2 marketing hero**        | **Static code-as-proof (option 1)** — real-HTML headline + CTA + kit `Terminal`/`CodeBlock` rendering the fail-closed RLS denial; text/code win LCP; **blank signature slot reserved**. three.js **deferred to a future studio-candidate spike** (caisson / audit-chain / field-crypto scene; its own future fork vs the ADR-0102 CSS/SVG four-beat). Amends the kickoff's four-beat-motion hero plan.                                                                                                                                                                                                                                                                                                     | **ADR-0104** (amends 0102/0103 hero plan)                              |
| **Dashboard host/app topology**   | **One dynamic Next 16 App Router app** (`apps/site`) deployed as a Node `standalone` server on **Railway** (project `caisson-prod`) — not a static export to Cloudflare Pages. Marketing + docs stay statically generated (SSG); the buyer dashboard is a `/dashboard` route group, `force-dynamic` + authed, **not** a separate app or host. Required because the fail-closed RLS `withTenant` read opens a transaction-scoped DB connection, which a static export (no server) and Cloudflare Workers/`workerd` (no transactional Postgres driver) both cannot serve.                                                                                                                                    | **ADR-0114** (supersedes 0084 deploy mode; amends 0079; re-homes 0107) |
| **Platform DB host**              | **Railway managed Postgres**, co-located with the Railway app (ADR-0114) + `services/docs`/`services/support-bot`, replaces **Neon** as the default platform `DATABASE_URL`. Driver flips to `drizzle-orm/node-postgres` (full TCP transactions); PGlite stays the test/dev driver; migrations/RLS-in-migration/checksum-ledger unchanged; Neon remains a supported (non-default) driver target. Connection-string-only swap, no code change.                                                                                                                                                                                                                                                              | **ADR-0115** (amends 0014)                                             |
| **Billing driver scope**          | **Paddle is the platform MoR** (ADR-0108) — and only the platform path. `@caisson/billing` (the buyer-facing package) **keeps Stripe** and **adds a Paddle driver**, both behind the unchanged `BillingProvider` port; the buyer picks either rail. No Stripe on the platform's own revenue path.                                                                                                                                                                                                                                                                                                                                                                                                          | **ADR-0116** (extends 0108; clarifies 0017)                            |
| **Observability**                 | **Vendor-neutral OpenTelemetry** instrumented across the platform (unified app + `services/docs`/`license`/`support-bot`), exported via OTLP to a **self-hosted SigNoz** co-located on Railway. The instrumentation is the asset; the backend is a config swap behind `OTEL_EXPORTER_OTLP_ENDPOINT`.                                                                                                                                                                                                                                                                                                                                                                                                       | **ADR-0117** (supports 0114/0115)                                      |
| **Web analytics**                 | **Plausible** — cookieless, no consent banner, env-gated on `PLAUSIBLE_DOMAIN` (inert when unset). Kept as a deliberately separate sink from OTel/SigNoz observability (usage vs system health).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | **ADR-0118** (complements 0117)                                        |

**ADR numbering (post-reconcile):** 0001–0012 founding · 0013–0019 substrate (testing/db/auth/CI/billing/jobs/error) · 0020–0023 module pipeline + fully-commercial licensing · 0024 credit-idempotency · 0040–0042 brand block (hero/name/design) · 0043 field-crypto per-tenant keys (amends 0006) · 0044 app-framework (Next.js) · 0045–0049 Wave-0 shared-substrate forks (AEAD cipher · envelope · registry read-path · generator engine · codegen debit; Fork 3 confirmed 0043, no new ADR) · **0050–0077 Wave-1 editions forks** (0050 local-ai-commercial/AGPL-killed · 0051–0058 compliance: WORM-mode/chain/version/store/field-crypto-P2/signing/control-model/evidence-gen · 0059–0063 ai-kit: gateway/metering/prompt-registry/eval/guardrails · 0064 local-first built-sync · 0065–0067 agent-kernel/agent-dev/local-store · 0068–0069 generator/publish · 0070–0077 cross-cutting: migration-assembly/entitlement/buyer-repo-boundary/local-tenancy/credit-events/observability/MCP-extensibility/edition-versioning) · **0078–0081 design/brand block** (0078 brand-foundation-expansion super. 0042 · 0079 SEO · 0080 copy · 0081 pricing-display-indicative super. 0087) · **0082–0083 go-live** (0082 live-self-serve posture super. 0085/0087/0081 stances · 0083 local-first-fully-commercial super. 0023-flank/0010-open-core) · **0084–0087 GTM site** (renumbered from the colliding GTM 0045–0048 set per ADR-0088 — site-stack/waitlist/analytics/hero-sku; Wave-0 substrate keeps 0045–0048) · **0088** ADR-number-collision renumber record · **0089–0093** 2026-06-28 picker-round locks (billing credit-grant / @caisson/migrate base / compose-time migration bundling / create-caisson bin runtime / local-CLI debit scope) · **0094–0096** 2026-06-29 GTM-report picker-round locks (open-core Base Apache-2 amends 0023/0050/0083 / GTM offer structure extends 0012/0081/0089 / services-docs standalone) · **0097** registry schema/service split (W1 impl lock, amends 0094 — open `@caisson/registry-schema` + commercial registry service) · **0098** credit-denomination home → `@caisson/kernel` (code-wiring B1, refines 0089 SD-3). Cross-track collisions on 0013/0014/0023 were renumbered at integration (see `outputs/archive/research/decisions-log.md` D22); the 0045–0048 GTM/Wave-0 collision was renumbered 2026-06-28 (ADR-0088); the design-system-harden track originally drafted 0097–0102 and was renumbered +2 → **0099–0104** when W1/B1 took 0097/0098 on main first (per the ADR-0088 second-merger-renumbers convention). · **0099–0102** = the 2026-06-29 design-system-harden track locks (component-recipe+kit / token+theming hardening / design-quality gates / signature-animation), resolving forks F1–F8 from `outputs/archive/kickoffs/design-marketing-rebuild.md` (F3 dark-mode = operator override to 3-prong; F4 keep surface1/2; F5/F6/F7/F8 per rec). · **0103** = the 2026-06-29 brand-mark lock (the "Pressure vessel" mark, operator pick; supersedes the ADR-0078 §2 placeholder glyph; defers the ADR-0102 signature sketches for rework). · **0104** = the 2026-06-29 Phase-2 hero lock (static code-as-proof, operator pick over a three.js hero; three.js deferred to a future studio-candidate spike; amends the kickoff's four-beat-motion hero plan). · **0105** = support-bot implementation locks (discord.py · OpenRouter one-key · thread+Postgres escalation; implements ADR-0009). · **0106–0107** = the 2026-06-29 **P6 operator-gates** picker round (0106 final pricing numbers + grandfathering — executes ADR-0095 §4, supersedes the ADR-0082 §2 display point-values; 0107 CF-Access go-live gate — formalizes the keep-gated board decision + the go-live checklist). · **0108** = the 2026-06-30 Paddle-MoR payment-provider switch (supersedes the Stripe-as-MoR assumption; amends ADR-0089 cycle→grant event source). · **0109** = the 2026-06-30 support-bot member-management lock (extends 0105). · **0110–0113** = the 2026-06-30 P6 **code-track** locks (0110 license-issuer impl + baked verify-key · 0111 publish-readiness flip · 0112 buyer-MCP rate-limit · 0113 entitlement-revoke + one-time + refund-clawback); issuer + entitlement were **renumbered 0108→0110 / 0109→0113 at the P6 integration merge** (second-merger-renumbers, ADR-0088 convention) so the go-live operator block stays contiguous at 0106–0109. **0114–0115** = the 2026-06-30 dashboard host/DB picker round (0114 unified dynamic Next 16 app on Railway, **supersedes the ADR-0084 static-export deploy mode**, amends ADR-0079's CWV/SEO delivery mechanism, re-homes the ADR-0107 pre-launch gate off CF-Pages Access; 0115 Railway managed Postgres as the platform DB host, **amends ADR-0014**'s Neon default — both close the dashboard host/URL + DB-host forks opened by the buyer-dashboard build). **0116–0118** = the same 2026-06-30 unified-app build session's follow-on picker round (0116 billing driver scope — Paddle platform-only, Stripe retained as a buyer `@caisson/billing` driver, extends ADR-0108 + clarifies ADR-0017; 0117 observability — vendor-neutral OpenTelemetry to a self-hosted SigNoz, supports ADR-0114/0115; 0118 web analytics — Plausible, cookieless, env-gated, complements ADR-0117). **0129–0135** = the same-day 2026-06-30 pricing + store-rework and harvest grill sessions (0129 value-based per-module pricing + edition-bundle math, supersedes ADR-0106's Local-first/bundle point-values · 0130 store-front as-if-built availability, supersedes ADR-0082 §3/§4 · 0131 on-site cart + multi-item Paddle checkout, extends ADR-0116 · 0132 buyer sign-in — magic-link + OAuth via better-auth · 0133 AI/agent-infra harvest initiative — 11 gridwork-core packages + 6 Wardfile lifts, post-go-live, spec-gated · 0134 cross-domain audit/validate harness, full build, generalizes ADR-0101 · 0135 two new commercial Compliance modules — `@caisson/alerting` + `retention-runner`, from the 6-repo lift sweep). Numbered above the highest number used-or-proposed at authoring time (0128, `docs/state/adapter-expansion.md`'s Tier-3 proposals) per that doc's own by-meaning-collision convention. The store-rework build wave then added **0136** (license-keyed registry gating + tooling-open) and **0137** (Q4 edition reprice); the admin-control-plane picker added **0138** (admin.caisson.sh operator control-plane + full-fleet observability charter). Stage-2 Stream-D added **0170–0176** (0170 email-multi-driver · 0171 field-crypto-AWS-KMS · 0172 WorkOS-SSO · 0173 pg-boss-jobqueue · 0174 Supabase-transactor · 0175 LemonSqueezy/Polar-billing · 0176 org-account-model — retiring the advisory `adapter-expansion.md` "0119+" placeholders). The **2026-07-01 provider picker** took **0177–0178** (Grafana-sole-OTLP/PostHog/Linear+Cookiy/Greptile · edition members-fold), and the **2026-07-01 edition seam-completion picker** took **0179–0185** (OSCAL export 0179–0181 · BYOK buyer 0182–0183 · live-transports-defer 0184 · Bun-OTel 0185 — resolved below; 0179 reassigned off its D6-harvest advisory reservation). The **2026-07-01 LIFT slice-1 picker** then took **0186–0188** (agent-runner boundary+config+pricing · support-impersonation fold into `@caisson/compliance` · audit-harness reconcile scope+driver-home — resolved below). The **2026-07-01 site-marketplace-rework session** took **0189–0196** (accent lock · primary-nav disclosure panel · marketplace routes · buy verb · checkout surfaces · accessibility floor · design-system codify · ⌘K search — D-8 hero cursor-glow dot closed no-op, no ADR — resolved below). The **2026-07-01 whole-repo-audit remediation picker** took **0197–0199** (AWS-KMS per-tenant crypto-shred build-now · BYOK per-action metering allowlist · tool-exec members-fold wiring). The **2026-07-01 editions-go-live session** took **0187 + 0201–0202** (support-impersonation from its LIFT reservation · live-transports-go-live · WORM retention-escalation), and the **2026-07-01 commerce-goes-live session** took **0200 + 0203** (Paddle-only buyer-purchase webhook mount · purchase-to-Discord edition-role link+push — the Discord ADR renumbered from a drafted 0201 to 0203 at merge, editions having taken 0201 first, per the ADR-0088 second-merger-renumbers convention). The **2026-07-02 edition-tails-ops picker** took **0205–0209** (0205 Compliance runtime composition of alerting+retention-runner · 0206 support-bot→Linear-Triage escalation sink · 0207 admin-/ops Grafana query rebuild · 0208 ops-hardening locks: owner-only BYOK/attest writes + branch-protection extras + TF-state defer-with-reason + OSCAL-rlink won't-fix + ledger/index-only republish scope · 0209 local-ai rented-transport drivers Azure+Bedrock, Ollama out-of-scope — drafted 0204 and renumbered to 0209 at merge, the Strix remediation ADR having claimed 0204 on main first, per ADR-0088 second-merger-renumbers). Both PR #45 (Strix, ADR-0204) and PR #46 (edition-tails-ops, ADR-0205–0209) are merged to main. The numbering continues in the per-session "Closed by …" sections below (0210–0238); the live ceiling is tracked in `CLAUDE.md`'s SoT-hierarchy header + `docs/adr-index.md` — **0242** as of 2026-07-05.

## Closed by the 2026-06-30 dashboard host/DB picker round (operator-locked)

The dashboard build surfaced two forks the existing ADRs didn't resolve: the buyer dashboard is
dynamic + authed (reads through the transaction-scoped fail-closed RLS `withTenant` entry), which a
static-export Next app (ADR-0084) and a Cloudflare Workers/`workerd` runtime cannot host — no server,
and no transactional Postgres driver on `workerd` respectively. The operator locked both in one round:
**one dynamic Next 16 App Router app** (`apps/site`) on **Railway** as a Node `standalone` server
(`/dashboard` a `force-dynamic` authed route group inside the existing app, not a second app/subdomain;
marketing+docs keep SSG) — supersedes ADR-0084's deploy mode (the docs framework, single-app topology,
and Next/Fumadocs version line are kept) — plus **Railway Postgres** as the platform DB host
(amends ADR-0014's Neon default; PGlite stays the test driver; `drizzle-orm/node-postgres` over TCP
gives `withTenant` real transactions). Both are buildable now (in-repo, autonomous); provisioning the
Railway services + DNS cutover + DB migration run are DEPLOY-class, operator-gated
(`docs/state/p6-deploy-runbook.md`).

| Fork                            | Decision                                                                                                                                                                                                                                                                             | Record       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| **Dashboard host/app topology** | **One dynamic Next 16 app on Railway** (Node `standalone`, `caisson-prod`), `/dashboard` as a route group, not `app.caisson.sh` as a second app (the rejected alternative) and not Cloudflare Workers (transaction-incompatible). Supersedes the ADR-0084 static-export deploy mode. | **ADR-0114** |
| **Platform DB host**            | **Railway managed Postgres**, co-located with the app; replaces Neon as the default `DATABASE_URL`; Neon stays a supported, non-default driver target. Amends ADR-0014.                                                                                                              | **ADR-0115** |

## Closed by the 2026-06-30 unified-app build session (operator-locked)

Building the unified Railway app (ADR-0114/0115) surfaced three more operator-picked forks — the
buyer-facing `@caisson/billing` package's Stripe scope post-Paddle-MoR, the observability vendor,
and web analytics — plus the Railway provisioning topology itself, all locked in one operator-picker
round.

| Fork                              | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Record                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Billing driver scope**          | **Paddle is the platform MoR only** (ADR-0108); `@caisson/billing` (buyer-facing) keeps Stripe and adds a Paddle driver, both behind the unchanged `BillingProvider` port. No Stripe on the platform's own revenue path.                                                                                                                                                                                                                                                                                                                                                                                             | **ADR-0116** (extends 0108)      |
| **Observability vendor**          | **Vendor-neutral OpenTelemetry** → OTLP → a **self-hosted SigNoz**, co-located on Railway; the backend is a config swap behind `OTEL_EXPORTER_OTLP_ENDPOINT`.                                                                                                                                                                                                                                                                                                                                                                                                                                                        | **ADR-0117**                     |
| **Web analytics**                 | **Plausible** — cookieless, env-gated on `PLAUSIBLE_DOMAIN`; kept as a separate sink from OTel/SigNoz observability.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **ADR-0118**                     |
| **Railway provisioning topology** | **One-service-each** — 6 Railway resources: the unified app, `services/docs`, `services/license`, `services/support-bot`, the platform Postgres, and the self-hosted SigNoz stack. **Railway Pro** plan, **~512MB–1GB autoscale per service**. SigNoz is self-hosted now (not deferred), its UI locked behind **Cloudflare Access** (operator-only, like cockpit). Extends ADR-0114/0115/0117. A formal **ADR-0119** will record this topology lock at DEPLOY time (not yet filed — this board entry is the interim record; the slug may renumber by-meaning if it collides with the adapter-expansion queue below). | board (→ **ADR-0119** at deploy) |

**Tracked/queued, NOT done.** Two roadmap docs were authored this session recording **future** work,
not built work: **`docs/state/adapter-expansion.md`** — the driver-expansion roadmap (email
SMTP/SES/Postmark, KMS wiring, SSO, R2, pg-boss, Bedrock/Azure/Ollama inference, LemonSqueezy/Polar,
Slack/Telegram, MCP HTTP/SSE transport — each port-family expansion proposes its own ADR starting at
**0119+**, assigned sequentially at lock time); and **`docs/state/services-hardening-audit.md`** —
the go-live hardening punch-list (docs per-IP rate-limit, MCP rate-limit wiring, **the Paddle webhook
binding**, support-bot RAG context-fencing, HSTS/cache-control gaps). Neither is implemented — both
are queued, operator-gated follow-on work, not part of this session's build.

## Closed by the 2026-06-30 Stage-2 Stream-D fork lock (operator-locked)

Stream D (`stream/base-golive` — base-substrate drivers + go-live surface + CI) surfaced four operator picks at
SPEC time (`outputs/archive/specs/stream-d-base-golive/SPEC.md`), locked in one round. The six firm base-adapter
port-families were recorded as **ADR-0170–0175** (retiring the advisory `adapter-expansion.md` "0119+"
placeholders — real numbers from the reserved 0170–0179 range).

| Fork                     | Decision                                                                                                                                                                                                                                                                                                                          | Record                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **D4 buyer account**     | **Org model** — multi-user tenant via a new `account_member(account_id,user_id,role)` table; opaque `account_id` stays the tenant key (zero downstream schema change); `role∈{owner,seat}` gates member/billing mgmt. Chosen over the smaller personal default (sell-to-teams at launch).                                         | **ADR-0176**               |
| **D7 signature slot**    | **Leave blank this stream** — no signature built in Stream D; the reserved blank slot stays (ADR-0104-compliant). three.js remains a _future_ studio-candidate fork, not Stream-D work; the CSS/SVG four-beat (ADR-0102) is available to fill it in a later design initiative.                                                    | board (ADR-0102/0104 hold) |
| **D8 SEO scaffold**      | **Option (a) targeted wins** — a `<Faq>` (native `<details>`) + a `<FeatureGrid>` primitive, killing the FAQ-render inconsistency + the duplicated `cs-grid`/inline-style boilerplate. The rigid IntentLadder / union renderer (b/c) rejected as over-build at ~6 hand-crafted pages. No new ADR (refactor within ADR-0079/0101). | board (→ Stream-D §5)      |
| **D5 license KmsSigner** | **Excluded** — field-crypto's in-tree `KmsClient` gets a real AWS driver (ADR-0171); the license `KmsSigner` (`license-issue`/`services/license`, no-stream-owner) stays a P7 seam.                                                                                                                                               | ADR-0171                   |

**Firm base-adapter port-families (six, all env-gated / dormant until creds):** email SMTP/SES/Postmark
(**ADR-0170**) · field-crypto AWS KMS + DB wrapped-key store (**ADR-0171**) · WorkOS SSO sign-in (**ADR-0172**) ·
pg-boss JobQueue (**ADR-0173**) · Supabase Transactor session-mode/TCP (**ADR-0174**) · LemonSqueezy/Polar
buyer billing (**ADR-0175**). Out-of-tree D5 items deferred by the partition: R2 `ArtifactStore` → Stream C
(`audit-worm`); chat Slack/Telegram → Python `services/support-bot` (no `ChatPlatform` port yet).

## Open (waiting on operator — DO NOT auto-decide)

_The Phase-2 hero fork is locked → **ADR-0104** (static code-as-proof, option 1)._

| Item                                                         | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~**Edition members-fold (Stage-2)**~~ **CLOSED — ADR-0178** | The three new commercial primitives — `@caisson/alerting` + `@caisson/retention-runner` (Compliance) and `@caisson/tool-exec` (Agentic-Dev) — are PUBLISHED standalone in the registry (index 27→32). Whether to **fold them into the edition `members` bundle** (buyer gets them with the edition price) was **NOT auto-decided at integration** — it changes edition-bundle economics (ADR-0137 repriced below module-sum without these). Their manifests already note "membership added by the edition at integration." **LOCKED 2026-07-01 → ADR-0178: FOLD into edition bundles** (Compliance `members` += alerting + retention-runner; Agentic-Dev += tool-exec). Source manifests edited on **PR #34**; realized at the next gated edition republish (`resolveEditionMembers` reads the index snapshot). |

### Provider-optimization forks (2026-07-01 — Exa-research-backed, verified pricing, DO NOT auto-decide)

Full ledger + verified pricing + cited sources: [`docs/state/providers.md`](providers.md). Research: workflow
`wf_6a5ae3a3-9f5` (7 Exa-backed agents + synthesis, all pricing verified against vendor pages 2026-07-01).
Surfaced for the operator picker; **nothing locked**.

| Fork                                                                                                                                                              | Options (verified)                                                                                                                                                                                                                                                                                        | Research rec + confidence                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ~~**PF-1 Observability backend**~~ RESOLVED same-day → ADR-0177 (Grafana Cloud sole OTLP sink; see the resolution block below — row kept for the research record) | Keep self-hosted SigNoz (~$45-70/mo Railway, brand data-custody, $0 vendor) · Grafana Cloud Free ($0, 50GB logs+50GB traces/14-day) · Axiom Free ($0, 500GB/mo/30-day) · **SigNoz Cloud Teams $49/mo** (same UI + SOC2/HIPAA, ~cost-neutral). ADR-0117 = OTLP export → backend is a **one-env-var swap**. | **Split verdict — the ONE decision needing an explicit operator call.** Cost lens → Grafana/Axiom Free (−$45-70/mo). Brand lens → keep self-hosted (custody proof). "want hosted signoz" leans SigNoz Cloud but that offloads *ops*, not *$*. `medium` |
| **PF-2 Product analytics (PostHog)**                                                                                                                              | Keep Plausible only · **ADD PostHog Cloud (hosted, EU) on dashboard routes only, $0** · PostHog replaces Plausible (**REJECT** — breaks ADR-0086/0118 cookieless).                                                                                                                                        | **ADD PostHog dashboard-only, keep Plausible on marketing, leave PostHog error-tracking OFF** (OTLP owns errors). $0. Decide now, defer wiring to launch (no users pre-launch). `high`                                                                 |
| **PF-3 Linear (project ops)**                                                                                                                                     | Skip (github-mcp already does issue CRUD; git-native ADR board = SOT) · Add Linear Free ($0, 250-issue cap) · Add Linear Business ($16/mo, the agent-automations). Operator leaned "want to add."                                                                                                         | **Research: skip for now** — Linear's 2026 agent-native thesis solves multi-person handoffs + inbound triage, neither exists solo; revisit at first hire / first inbound bug volume. Free tier = $0 trial if wanted. `high`                            |
| **PF-4 2nd AI code reviewer**                                                                                                                                     | Keep Greptile+TREX only · Add Macroscope (Opus-4.5 AST + $100 one-time free, usage-based, separate check) · Add CodeRabbit ($24/mo private repo). TREX free window ended 2026-06-30 → now $2/run.                                                                                                         | **Keep Greptile+TREX only** (free Starter covers solo volume; already catches real P1s here). If a 2nd signal ever wanted → **Macroscope, not CodeRabbit** (different class vs redundant). `medium`                                                    |
| **PF-5 User-research tool (Cookiy)**                                                                                                                              | Defer (interview design partners directly) · **Cookiy MCP $0 legs** (screener/guide/synthetic-persona copy tests + transcript synthesis; real recruiting = wallet top-up) · Perspective AI (free 250 credits, later) · Maze (usability, later) · Listen Labs (**REJECT** ~$2.5K/mo).                      | **Optional/low-stakes.** If wanted: Cookiy MCP $0 legs now (treat synthetic as hypothesis-shaping, NOT validation) + a security-surfaces ledger row (new egress sink). Else defer. `medium`                                                            |
| **PF-6 Firecrawl (scrape)**                                                                                                                                       | Keep Exa + crawl4ai · Add Firecrawl MCP ($19-99/mo).                                                                                                                                                                                                                                                      | **Skip — redundant** with crawl4ai ($0 local, already wired) + Exa; sole differentiator (managed anti-bot proxies) not needed. Close, no spend. `high`                                                                                                 |
| **PF-7 Hosting (Railway, LOCKED)**                                                                                                                                | Railway ~$65-90/mo (LOCKED ADR-0114/0115) vs Fly ~$50-65 · Render ~$180-220 · Fargate ~$220-260 (informational).                                                                                                                                                                                          | **No change** — Railway cheapest-for-fit for the many-small-idle topology + SOC2. Switching math never clears. Real cost lever = PF-1 (SigNoz block ≈ half the bill), not the host. `high`                                                             |

**Resolved 2026-07-01 (operator picker — LOCKED as ADR-0177 (provider stack) + ADR-0178 (members-fold)):**

- **PF-1 → DROP self-hosted SigNoz; Grafana Cloud (`caisson.grafana.net`, US-West) is the SOLE OTLP sink**
  (reverses the earlier same-day "keep"; −$45-70/mo → new floor ≈$30-55/mo). `grafanactl` connected (Grafana
  13.2). **Cutover BLOCKED on an OTLP credential:** the `glsa_` service-account token can't auth the OTLP
  gateway (probe 401) — needs a `glc_` Cloud Access Policy token (`metrics/logs/traces:write`) or the stack's
  OTLP env snippet. Runbook + gate: [`providers.md` → SigNoz→Grafana cutover](providers.md). Teardown of the
  5 SigNoz services happens only AFTER Grafana OTLP is verified receiving data. **(Resolved same-day:
  `glc_` CAP token obtained, all 5 services repointed via env, probe span verified in Tempo, SigNoz
  services deleted 2026-07-01 — the cutover is DONE; see `providers.md`.)**
- **PF-2 → PostHog ADDED + LIVE** — dashboard-only (US Cloud), Plausible stays on marketing, error-tracking
  OFF. Site key `NEXT_PUBLIC_POSTHOG_KEY` set on `caisson-site` + redeployed; MCP connected.
- **PF-3 → Linear ADDED + fully wired** — MCP connected (`lin_api_` Bearer), full surface. Business plan
  ($16/mo, agent-automations) = operator billing action; CRUD works on any plan now.
- **PF-5 → Cookiy ADDED** — MCP connected (`cky_` headless Bearer). Positioning research only, no customer PII.
- **Greptile review gate** — pre-push advisory hook **removed** (`.githooks/pre-push` deleted); Greptile is now
  the **PR required check only** + `/greptile` skill for on-demand local review of large/uncommitted work.
- **PF-4 → Keep Greptile+TREX only** (no 2nd AI reviewer; free Starter covers solo volume). **PF-6 → Skip
  Firecrawl** (crawl4ai + Exa cover it). **Edition members-fold → FOLD into bundles** (ADR-0178, PR #34).
  PF-7 (hosting) stays LOCKED Railway (no change). All open provider forks now closed.

_Flip-back trigger if Grafana ever proves insufficient: HIPAA/BAA or PHI-in-telemetry customer → self-hosted
SigNoz or SigNoz Cloud Teams ($49). PostHog error-tracking stays OFF (OTLP owns errors)._

**Resolved 2026-07-01 (whole-repo-audit remediation picker — LOCKED as ADR-0197 + ADR-0198):**

- **AWS KMS per-tenant crypto-shred → BUILD NOW** (was: build vs defer-to-first-AWS-customer). The
  `kms-aws.ts` driver honors the per-call tenant `keyId`; `scheduleKeyDeletion` refuses without an
  explicit keyId; tenant bound into `EncryptionContext` → **ADR-0197**.
- **BYOK 0-credit metering → per-action allowlist, default metered** (refines ADR-0182, does not
  reverse it: inference-class actions under a tenant key stay $0) → **ADR-0198**.
- **Audit remediation packaging → ONE PR** (all round-1+2+3 findings on `audit/whole-repo-2026-07-01`,
  PR #40), Greptile forced via `@greptileai`; **round 3 runs before final ship** (7 new domains:
  generator-templates, auth-boundary, email-egress, ai-evals-integrity, mcp-transport,
  agent-governance, guardrails-prompts).

**Resolved 2026-07-01 (round-3 picker — second remediation round):**

- **Round 4 → RUN SLIM NOW** (the 4 never-audited risk-bearing surfaces the round-3 critic named:
  admin-plane, metering-byok, destructive-jobs, composition-roots — then fix everything before
  shipping PR #40). Round 4's critic then surfaced a name-collision (round-3 critic wrote
  `audit-harness` meaning `packages/audit-worm`) → a slim round 5 (`worm-integrity`) ran to correct
  the audit's own scoping error under the same lock.
- **tool-exec members-fold gap → WIRE IT** (honor ADR-0178, do not de-scope) → **ADR-0199**.

**Resolved 2026-07-01 (commerce-goes-live session — operator picker):**

- **Buyer-purchase webhook mount → PADDLE ONLY** → **ADR-0200**. Recon found the mount already built
  (PR #40 audit remediation: `services/license` `POST /webhook`, raw-body Paddle-Signature HMAC,
  one-RLS-tx grant) — the ADR codifies it; the Stripe driver stays dormant per ADR-0116 (no platform
  Stripe webhook route, no Stripe webhook secret).
- **Purchase → Discord edition-role (the ADR-0109 deferral) → LINK + PUSH** → **ADR-0203**. `discord`
  joins the env-gated better-auth social providers (dashboard Connect button); services/license
  fire-and-forgets `POST /billing-grant` on the bot after a grant commits (never blocks the webhook
  2xx); the site backfills on link for buy-then-link ordering; the BOT owns entitlement→role expansion
  (canonical ids `local-ai`/`agent-dev`; `bundle` ⇒ all four; `Customer` umbrella always). Role removal
  on refund/cancel stays manual (deliberate non-goal).

**Resolved 2026-07-02 (edition-tails-ops picker — LOCKED as ADR-0205–0209; the transports ADR
was drafted 0204 and renumbered to 0209 at merge, the Strix remediation ADR having claimed 0204
on main first — ADR-0088 second-merger-renumbers):**

- **C5 local-ai RentedTransport drivers → BUILD BOTH Azure + Bedrock now** (over the Azure-first rec);
  Bedrock SigV4 hand-rolled on `node:crypto` (no `@aws-sdk`/`@smithy` dep — Gate-2 boundary); **Ollama
  declared out-of-scope for the rented seam** (self-hosted ≠ rented; ai-kit's `ollama` case owns it) →
  **ADR-0209**. Closes ADR-0160's deferred Surface-B bullet.
- **Compliance edition runtime composition → COMPOSE like ADR-0199** (over the manifest-only rec):
  `@caisson/alerting` + `@caisson/retention-runner` become real deps, re-exported + factory-composed
  through `packages/compliance/src/index.ts` → **ADR-0205**.
- **CAISSON-3 support-bot escalations → Linear Triage → BUILD NOW**: third best-effort `IssueTracker`
  sink on `Escalator`, explicit Triage `stateId` (no Business-plan dependency), log-only issue URL in
  v1 (no schema migration), env-gated off; **credential = the operator's existing `lin_api_` key**
  (over the dedicated-bot-key rec; swap later is env-only) → **ADR-0206**.
- **Orphaned admin /ops cockpit → FULL REBUILD on the Grafana Cloud query API** (over the
  deep-link-and-delete rec): traces-only fleet ⇒ Tempo/TraceQL widgets, same env-gated empty-state
  pattern, stale SigNoz labels fixed → **ADR-0207**.
- **Ops-hardening bundle → ADR-0208**: Strix **vuln-0006 CONFIRMED REAL** and fixed owner-only
  (BYOK + attestation writes gate on `session.role === "owner"`; reads stay seat-visible) · branch
  protection gains `oscal-conformance` required check + `enforce_admins` + `strict` · **TF-state
  migration deferred-with-reason** (research: R2 ignores S3 conditional writes ⇒ `use_lockfile` is a
  silent no-op; trigger = 2nd operator or CI apply) · OSCAL back-matter `rlink` hosting = won't-fix ·
  the ADR-0178 republish executes **ledger/index-only** (`CAISSON_PUBLISH_DRY_RUN` stays `"true"`;
  Worker redeploy rides the standing P0 act).

### Parked / deferred (non-blocking — revisit later, do NOT auto-decide)

| Item                                                                                                                                                                   | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Marketing signature slot**                                                                                                                                           | **Stream-D lock 2026-06-30: leave the slot blank this stream** — no signature built in Stream D; three.js stays a _future_ studio-candidate fork, not Stream-D work. Deferred-for-rework (ADR-0103); the site reserves a **blank slot** — no signature ships in this track. Future fork: **three.js studio-candidate spike** (caisson / audit-chain / field-crypto authored scene) **vs** the locked ADR-0102 CSS/SVG four-beat. Operator steer 2026-06-29: "in future will spike three.js studio candidates." Gated by the ADR-0079 CWV/a11y baseline + the ≤10% accent budget.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ~~**SEO IntentLadder + per-page data files**~~ (kickoff Phase-2) — **CLOSED — ADR-0232** (trigger-gated SPEC governs; glossary program pre-committed as first trigger) | **Stream-D lock 2026-06-30: option (a) — `<Faq>` (native `<details>`) + a `<FeatureGrid>` primitive; the rigid ladder / union renderer (b/c) rejected as over-build at ~6 hand-crafted pages.** Prior: deferred (operator, 2026-06-29). Recon (7-page grammar map) found the kickoff's rigid fixed-scaffold IntentLadder is a **poor fit**: all 8 marketing pages rate "mostly" not "clean" — each carries per-page bespoke sections (wedge/honesty/CSP/pull-quote/config), 1–3 hand-authored **colorized-`cs-tok` Terminal/CodeBlock artifacts** that don't reduce to flat data, and FAQ rendered as Card grids (not native `<details>`); no two share a section sequence. The Wardfile IntentLadder pays off at N≈50 near-identical keyword pages — Caisson has ~6 hand-crafted pages that are **already** SEO-complete (metadata/jsonld/FAQ/breadcrumbs present) with content **already** typed-const-externalized in-file, so marginal value is low. Forward options when revisited: **(a)** targeted wins — shared native-`<details>` FAQ + a `FeatureGrid` primitive to kill the inline-style heaviness (low risk); **(b)** a **flexible discriminated-union `<PageSections>`** renderer + per-page data files (NOT the rigid ladder); **(c)** lock the section-union for NEW pages only. Do NOT force the literal rigid ladder (fidelity loss). Recon: workflow `wf_3045febd-43a`. **2026-07-03 LOCK (ADR-0232, fourth picker round): SPEC `outputs/archive/specs/deferred-respec/SPEC-seo-section-union-renderer.md` governs — trigger N ~ 20+ pages, single committed initiative; the GLOSSARY PROGRAM is PRE-COMMITTED as the first triggering program (operator override of wait-for-demand) and gets its own product SPEC with the renderer as its implementation detail.** |

_All technical forks from the P5 build + the 2026-06-28 + 2026-06-29 picker
rounds are locked (below). Final pricing numbers + grandfathering are **deliberately deferred** to
P6/checkout (now a closed decision, ADR-0095 §4 — not an open fork), with the reports' $2,999–$4,999
anchor + validation tasks recorded as the input. The **design-system-harden + marketing-rebuild track**
(kickoff `outputs/archive/kickoffs/design-marketing-rebuild.md`) had its 8 forks (F1–F8) locked 2026-06-29 →
**ADR-0099–0102** (below) + the brand mark locked → **ADR-0103**; it is now in EXECUTE (Phase 1 = kit +
gates + brand-lock **DONE**; Phase 2 = site rebuild — hero locked → **ADR-0104**, now building). The
**code/wiring track** remains queued (kickoff in `outputs/kickoffs/`); the two run as disjoint-tree
worktree streams (design = `packages/ui` + `apps/site` + `apps/studio`; code = `services/*` +
`packages/{migrate,cli,…}` + `tooling/`)._

## Closed by the 2026-06-28 picker round (operator-locked)

Eight forks decided in a two-round picker, on research-backed recommendations from a 12-agent workflow
(VERIFY-debt backfill + worker deploy-prep + billing design + 6 fork-research agents). Locks recorded as
append-only ADRs; deferrals scheduled to P6.

| Fork                                         | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Record                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **X-2 billing: cycle → grant + price-book**  | Grant on `invoice.paid` (idempotent on the Stripe invoice id); new base `@caisson/pricebook` (`stripePriceId → creditsPerCycle`) reusing ai-meter's `microUsdPerCredit`; cycle→grant mapper in `services/license`. Build at P6.                                                                                                                                                                                                                                                   | **ADR-0089** + `outputs/specs/billing-x2/` |
| **`@caisson/migrate` base pkg**              | **Promote now — full extract** (assembler + runner in the base per ADR-0070; a full package bootstrap, not the board's "one-line flip"). Fast-follow.                                                                                                                                                                                                                                                                                                                             | **ADR-0090**                               |
| **Compose-time migration bundling**          | **(a) CLI build-step copy** each module's `src/migrations/*.sql` into the cli `migrations-bundle/` (mirrors the proven `templates/` pattern; `packageDir()` already wired).                                                                                                                                                                                                                                                                                                       | **ADR-0091**                               |
| **`create-caisson` bin runtime**             | **Add `dist/cli.js` + `#!/usr/bin/env node`** for `npx` reach (operator **override** of the keep-Bun rec). Implementation bundled into the P6 publishability flip (npx needs publish).                                                                                                                                                                                                                                                                                            | **ADR-0092**                               |
| **Local `create-caisson` debit**             | **Free-local** — the local CLI never debits (no DB/tenant offline); codegen debit (ADR-0049) scoped to the hosted MCP path; `meter.ts` comment corrected in this change.                                                                                                                                                                                                                                                                                                          | **ADR-0093**                               |
| **Publishability flip + registry coherence** | **Defer to P6/commerce** — keep all 24 pkgs private + publish dry-run; resolve `@caisson/registry` coherence + the changeset/T3 gate as one P6 readiness pass at checkout.                                                                                                                                                                                                                                                                                                        | board (deferred → P6)                      |
| **MCP per-account rate-limit** (T21b)        | **Defer to P6** — `debit-before-spend` is the primary control (financial theft closed by the atomic debit gate); add the PG token-bucket with the entitlement store at P6.                                                                                                                                                                                                                                                                                                        | board (deferred → P6)                      |
| **Final pricing numbers + grandfathering**   | **LOCKED (P6)** — Compliance $2,499 · everything-Bundle $3,499 · Compliance-Updates $1,499/yr · Developer $499/yr · Enterprise "Contact us"; other editions hold at committed display; forward grandfather (zero buyers yet). Code track wires `@caisson/pricebook`. **Edition one-time points later superseded by ADR-0137 (below-sum reprice): Compliance $749 · Bundle $1,499 · AI-Kit $599 · Local-first $349 · Agentic-Dev $249; the recurring SKUs + grandfathering hold.** | **ADR-0106**                               |

## Closed by the 2026-06-29 GTM-report picker round (operator-locked)

Triggered by two Perplexity Computer reports (GTM + market/competitive) imported to
`outputs/research/` + a cross-analysis (`gtm-market-analysis-2026-06.md`). The reports **validated the
whole core strategy**; the divergences became forks. Resolved in two picker rounds on research-backed
recommendations.

| Fork                                       | Decision                                                                                                                                                                   | Record                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **Open-core Base**                         | **Apache-2.0** base substrate (10 pkgs); editions + field-crypto + audit-worm + generator + registry + updates stay commercial. Re-licensing scheduled as its own PR (W1). | **ADR-0094**            |
| **Free EU-AI-Act eval artifact**           | **Ship** a minimal create-caisson-emitted EU-AI-Act evidence-path sample (Apache-2); P6/GTM (W3).                                                                          | **ADR-0095**            |
| **Enterprise / SLA tier**                  | **Add** a "Contact us" no-price founder-assisted tier to the SKU structure (W4).                                                                                           | **ADR-0095**            |
| **Update cadence**                         | **Annual** (supersedes ADR-0081 monthly); X-2 mapper (ADR-0089) is an annual cycle (W5).                                                                                   | **ADR-0095**            |
| **Final pricing numbers + grandfathering** | **NUMBERS LOCKED** (2026-06-29 P6 round) — moderate raise to the research floor; ADR-0095 deferred, ADR-0106 supplies the figures + forward grandfather.                   | **ADR-0095 → ADR-0106** |
| **`services/docs` scope**                  | **Standalone AI-native docs service** (separate from `apps/site` Fumadocs); P6 (W6).                                                                                       | **ADR-0096**            |
| **Open-core re-licensing timing**          | **Schedule** as its own PR + verify (not inline) — the standards-gate + 10 manifests + LICENSE files + site copy (W1).                                                     | board (→ W1)            |
| **CF Access go-live gate**                 | **Keep gated** until real checkout works + Compliance is buyable; flip = the deliberate launch act (DEPLOY-class). Formalized with the go-live checklist.                  | **ADR-0107**            |

Strategy items the reports **validated** (no fork): compliance wedge · production-rigor umbrella ·
own-the-code · update subscription · regulated-AI beachhead · MCP-first generator · evidence path.

## Closed by the 2026-06-29 design-system-harden picker round (operator-locked)

Eight forks (F1–F8) from `outputs/archive/kickoffs/design-marketing-rebuild.md`, decided on a 7-agent grounding
fanout (research docs + token system + site/studio architecture + gate pipeline + locked brand floor, all
verified against code with file:line evidence). Caisson already owned the playbook's token foundation, so
the track is **harden, not build**. Locks recorded as append-only ADRs 0099–0102.

| Fork                                  | Decision                                                                                                                                                                                                                          | Record       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **F1 — component recipe**             | **Adopt** the Wardfile recipe (Radix behavior + co-located per-component CSS + `data-*` variants + local-indirection vars); retires global-BEM + inline-style.                                                                    | **ADR-0099** |
| **F2 — kit packaging**                | Move primitives → `@caisson/ui`, **framework-agnostic** (raw-`.tsx` `./components/*`, Link via `asChild`, `lucide-react` peer-dep; studio consumes the same kit, kit-first rule).                                                 | **ADR-0099** |
| **F3 — dark-mode prongs**             | **Operator override → 3-prong:** dark `:root` default + `prefers-color-scheme:light` OS-seed + manual `[data-theme]` override-wins; ThemeToggle follows OS until first click then pins, **icon not text**.                        | **ADR-0100** |
| **F4 — breakpoint + scrim + surface** | Add rem ladder `xs30…2xl90` + `scrim` token; **keep** `surface1`/`surface2` (rename rejected as pure churn).                                                                                                                      | **ADR-0100** |
| **F5 — deterministic gates**          | **All six staged** (token-drift → contrast-matrix → anti-slop AST → copy-guard → breakpoint → axe), axe at SHIP not in `bun run check`; + non-blocking `findings.toml` critic; deletes the duplicated hand-copied contrast tests. | **ADR-0101** |
| **F6 — video vs CSS/SVG**             | **Tokenized CSS/SVG** four-beat signature (deny→chain→hold→sign; Concept A evolves `home-hero-motion.tsx`); **video pipeline deferred**.                                                                                          | **ADR-0102** |
| **F7 — Next align**                   | `apps/studio` → **Next 16** (match `apps/site`).                                                                                                                                                                                  | **ADR-0099** |
| **F8 — icons**                        | **Keep Lucide** (cite DESIGN.md §4); reject the playbook's Phosphor.                                                                                                                                                              | **ADR-0099** |

## Closed by the 2026-06-29 P6 operator-gates picker round (operator-locked)

The DEPLOY-class operator session (worktree `caisson-ops`, branch `chore/p6-go-live`) locked the two
remaining operator-owned forks before go-live, on a 5-agent grounded research fanout (GTM reports +
pricing/CF-Access ADRs + state board + deploy feasibility, file:line evidence). Locks recorded as
append-only ADRs 0106–0107 (+ 0108 Paddle-MoR and 0109 support-bot member-mgmt added in the 2026-06-30 go-live session). The unattended **code track landed 0110–0113** and was merged into this go-live work in the 2026-06-30 **P6 integration** (issuer + entitlement renumbered 0108→0110 / 0109→0113 at merge to keep the operator block contiguous — see "Closed by the P6 integration" below).

| Fork                                            | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Record                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **A1 — final pricing + grandfathering**         | **Moderate raise to the research floor:** Compliance **$2,499** · everything-Bundle **$3,499** (discount, ~15% off $4,096 parts) · Compliance-Updates **$1,499/yr** · Developer **$499/yr** · Enterprise **"Contact us"**; AI-Kit $599 / Local-first $499 / Agentic $499 hold. **Forward grandfather** (zero buyers yet); MEDIUM confidence (WTP unvalidated). Executes ADR-0095 §4; supersedes ADR-0082 §2 display point-values.                                                                                                                                                   | **ADR-0106**            |
| **A2 — CF-Access go-live gate**                 | **AMENDED 2026-07-10 → ADR-0303:** the gate now scopes to the COMMERCE surface only (`/dashboard*` + `/cart*`); marketing/marketplace/docs/glossary/legal/llms.txt/robots.txt/`/api` serve PUBLIC pre-launch so AI engines + search index the site (the 2026-07-09 AEO audit measured zero citations under the whole-host gate). Purchases stay impossible (buy CTAs → gated `/cart`). APPLIED live + verified (`/dashboard`+`/cart` 302→Access login, `/`+`/marketplace`+`/docs`+llms.txt 200). Go-live still removes the remaining gate. Original keep-gated rationale: ADR-0107. | **ADR-0107 → ADR-0303** |
| **Payment provider (post-kickoff, 2026-06-30)** | **Paddle as Merchant of Record** — supersedes the Stripe-as-MoR assumption (operator carries no tax registration/remittance; Paddle remits + owns the invoice). Code track reworks the ADR-0089 cycle→grant mapper Stripe→Paddle; license/entitlement/registry are provider-agnostic.                                                                                                                                                                                                                                                                                               | **ADR-0108**            |
| **Support-bot member management (2026-06-30)**  | **Extend the one bot** (not a 2nd process) with server ops: on-join auto-role + welcome, persistent self-assign buttons, double-gated mod commands (`/kick`·`/ban`·`/timeout`·`/role-add`·`/role-remove`), `/grant-role` (edition→role). Privileged `members` intent gated on config; billing-webhook grant endpoint deferred to the Paddle phase. Built + DEPLOYED this session.                                                                                                                                                                                                   | **ADR-0109**            |

> Part B of the same session (Paddle · support-bot · docs-service · license keypair deploys) is
> DEPLOY-class + cred-gated — tracked in `readiness-and-backlog.md` §2. **Done in the 2026-06-30
> go-live session:** docs-service redeployed with the live OpenRouter embedder (semantic search live
> at `docs-api.caisson.sh`); support-bot redeployed with member management (● Online); the Discord
> server was fully built out (roles · categories · channels · permissions · icon · name). Remaining
> operator step: enable the two privileged intents in the Developer Portal, then wire
> `SUPPORT_CHANNEL_ID` + `MEMBER_ROLE_ID`. Paddle still awaits the operator's account + sandbox creds.

## Closed by the 2026-06-30 P6 integration (code-track + merge)

The unattended code-track slices (PRs #25–#30) merged onto the go-live branch in one integration
branch (the operator's wave-1 PR#11 convention), conflicts resolved centrally, ADR numbers reconciled
(issuer 0108→0110, entitlement 0109→0113), gate green (`bun run check` 125/125 + kernel gate), all
per-PR Greptile findings folded in. SHIP stops at the merged PR; **DEPLOY of the new license/MCP
surfaces stays operator-gated.**

| Slice                                  | Decision / lock                                                                                                                                                                                                       | Record       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **I1 — license issuer (Ed25519)**      | Private `@caisson/license-issue` signer (PKCS8 env-key Signer port; KMS un-wired seam) + production verify-key baked into `@caisson/license-verify`; lazy bearer-gated `POST /issue` resolves entitlements + signs.   | **ADR-0110** |
| **I4 — publish-readiness**             | Private→public flip across the publishable set (0.1.0); open-base→npm public / commercial→GH-Packages restricted split, tier-driven; `@caisson/cli` ships `dist` + npx bin. Never-published signer stays private.     | **ADR-0111** |
| **I5 — buyer-MCP rate limit**          | Server-side per-account lazy-refill token bucket gating every MCP tool dispatch; port-injected, **fail-open** (a store error never wedges a buyer); int8-overflow-guarded.                                            | **ADR-0112** |
| **I2 — entitlement revoke + one-time** | Reference-counted `entitlement_grant` junction; `subscription.canceled` soft-revokes that sub's grants; one-time `purchase.completed` grants + `refund.completed` claws back ONLY unspent credits (full-refund only). | **ADR-0113** |

> **I3 (deferred — operator's call):** not built this wave. **I6** (Greptile test-hygiene, PR#26) carried
> no ADR. The single never-published package `@caisson/license-issue` is intentionally `private:true` /
> unpublished (the signing key never reaches a buyer tarball) — the publish gate now scopes its flip
> invariants to the published set and guards the never-published set inversely.

## Recently closed (Wave-1 forks round, 2026-06-27)

- **Field-crypto row-level AAD** (was open, Wave-0 TM2) → **LOCKED ADR-0055** (hybrid: transparent column + explicit row-bound `encryptField(…,rowId)` for SEC/HIPAA; randomUUID PKs).
- **Registry index prevention-gate** (was open, Wave-0 TM6) → **DONE** (operator GitHub action, PR #2): real `@GridWork-dev` CODEOWNERS + branch protection on `main` (required checks `check`/`standards-gate`/`registry-index`, force-push/deletion blocked). Code-owner-review intentionally OFF (solo account); re-enable on a second collaborator.

## Design · Brand · SEO · Copy session — open fork board (2026-06-27)

Ultracode research fanout (12 agents → synthesis → completeness critic) produced a **148-fork board**
across the 4 surfaces. Full board with options + recommendation + confidence + evidence:
**`outputs/archive/specs/design-brand-site-seo/FORK-BOARD.md`** (research artifacts: `outputs/research/design-session/`).
Scope: ADR-0040 (hero) + ADR-0041 (name) stay LOCKED; ADR-0042 (palette/type) MAY be widened by a new
append-only ADR. Design ADRs number from **0078+** (Wave-1 reserved through 0077). Spec-first, doc-only.

| Surface    | Forks       | Headline recommendations (all operator-gated until locked)                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Visual** | 43 + critic | split hero w/ framed terminal artifact · terminal chrome + semantic-tint code · evidence proof-lines on cards · featured-lead edition hierarchy · persistent nav CTA · tonal-hover affordance · tokenized restrained motion · inline-style→class extraction · intermediate breakpoints + mobile nav · branded 404/error routes                                                                                                   |
| **Brand**  | 27 + critic | **KEEP** palette A teal + Structural type (widen, don't change) · wordmark + restrained geometric glyph (waterline-over-chamber) · line-icon system (Lucide/Phosphor + bespoke domain glyphs) replacing Unicode · blueprint/waterline illustration motif (no mascot) · tokenized motion as a new pillar · always-dark code · mono numerals · per-edition = icon+label (no rainbow) · DESIGN.md brand book · favicon/app-icon kit |
| **SEO**    | 26 + critic | own the dev-kit long-tail (cede head terms) · programmatic framework×control pages (pilot SOC2+HIPAA) · root @graph JSON-LD (Org+WebSite+per-page) · buildMetadata() helper (per-page OG/canonical/twitter) · self-host fonts (next/font) · favicon kit · AI-crawler allow + content-signals · FAQ schema · legal/privacy/EULA + security.txt · CSP hardening                                                                    |
| **Copy**   | 26 + critic | dev-kit-noun register (never "platform"/"automate compliance") · retrofit $80k/6–9mo figures · CI green-checks proof strip · clause tags on home evidence · named-engineer note · CTA standardization by tier · pricing-deferral why-line · answer-first FAQ blocks · procurement/CISO path · consent microcopy                                                                                                                  |

**Status: LOCKED (2026-06-27).** Operator decided across 3 picker rounds + a pricing confirm. Outcomes →
**ADR-0078** (brand foundation expansion, supersedes 0042) · **ADR-0079** (SEO strategy) · **ADR-0080** (copy &
messaging, extends specs/04) · **ADR-0081** (pricing indicative placeholders, supersedes 0087), all in the
Locked table above. Notable operator overrides of the recommendation: **expressive** motion (not restrained) ·
**add an elevation + glow scale** (not shadowless) · **show indicative placeholder prices** (not no-price) ·
keep palette A but **revise the mono pairing** for code legibility. All 4 launch-gate bundles (legal/privacy ·
security hardening · error-routes/a11y · content-cadence/funnel) are **launch-blocking (P0)**. The remaining
lower-level forks default to their FORK-BOARD recommendation in `outputs/archive/specs/design-brand-site-seo/SPEC.md`
(the build PLAN seed). **Numbering:** design ADRs **0078–0081** (Wave-1 reserved through 0077).

## Closed by the 2026-06-30 admin control-plane + observability picker round (operator-locked)

Four base-level forks locked in an operator picker (`AskUserQuestion`) for the **`admin.caisson.sh`**
operator control-plane + full-fleet observability initiative (**ADR-0138**, charter). Build is
**post-Stage-1**, spec-gated — this closes only the base level; detail forks open at the initiative kickoff.

| Fork                          | Lock                                                                                                                                                                                                                         | ADR          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **admin.caisson.sh app**      | Its own Railway app — a **fresh `apps/admin`**; studio moves in as a section; the **old `apps/studio` is removed**; CF-Access operator-only.                                                                                 | **ADR-0138** |
| **Admin scope (SOT of what)** | **Full internal control-plane** — ops/observability + business admin (tenants/purchases/entitlements/credits over the Railway PG) + design-system (studio) + live architecture diagram + decisions/SOT surface.              | **ADR-0138** |
| **Observability backend**     | **Self-host SigNoz on Railway** (executes ADR-0117) — all services (app · docs · support-bot · license via OTLP; the registry Worker via CF-native logs + a tail→OTLP bridge) report to it; SigNoz + Railway PG = substrate. | **ADR-0138** |
| **Live architecture diagram** | **Hybrid** — auto-derived service/deploy topology (Railway graph + manifests + health probes + graphify) + hand-authored annotations.                                                                                        | **ADR-0138** |

## Closed by the Stage-2 Stream A initiative SPEC (2026-06-30, operator picker)

The ADR-0138 detail forks, locked at the `stream/obs-admin` SPEC (`outputs/specs/stage2-stream-a-obs-admin/`).
Build is local-only on the stream; deploy is the integration session.

| Detail fork                 | Lock                                                                                                                                                        | ADR          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **admin auth**              | **CF-Access alone** — one new Access app for `admin.caisson.sh`, no app-side auth code (single-operator, read-only).                                        | **ADR-0140** |
| **business-admin**          | **Read-only cockpit first** — cross-tenant via a read-only `admin` Postgres role (`buildAdminReadPolicySql` + `withAdminRead`); mutation deferred.          | **ADR-0141** |
| **SigNoz sizing/retention** | **Single-node Foundry template (5 svcs incl. Keeper), 14-day retention, 100% head sampling**; Worker→SigNoz via CF-native `[observability.*]` destinations. | **ADR-0142** |
| **diagram render tech**     | **Client-side interactive React Flow** (hybrid auto-topology + versioned annotation layer).                                                                 | **ADR-0143** |

Per-service OTel wiring resolved in-SPEC: `services/docs` + `services/license` already instrumented;
**support-bot Python OTLP + the Worker CF-native destinations block are the only new OTLP work.**
Still deferred (own future ADR): the **business-admin mutation surface + audit trail**. Studio-removal
migration is Stream A task A1. Sequenced after the Stage-1 PR + Railway/DNS cutover; ordered against the
ADR-0133 harvest at kickoff.

## Closed by the 2026-06-30 pricing + store-rework wave (operator-locked + BUILT)

A two-round operator picker (research-backed price sheet retrieved by a cited research agent) opened
and closed four packaging/pricing forks (round 1) and four mechanics/sequencing forks (round 2), then
a store-rework BUILD wave locked three more forks (Q1 registry gating, Fork A tooling licensing, Q4
reprice) and **built the whole store on `feat/dashboard-unified-and-p6-tail`** — reprice, storefront
catalog grid, cart + multi-item Paddle checkout, better-auth sign-in, and license-keyed registry
gating all landed with gates green. Remaining before the Railway cutover: the customer-facing copy
rewrite (fast-follow) + module Paddle price-ids + the buyer-account/tenant mapping (Stage-2 ops).

| Fork                                      | Decision                                                                                                                                                                                                                                                                                                                                                   | Record                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Module pricing model**                  | Value-based, research-backed price **per module** (not uniform); 12 modules get their own SKU (table in ADR-0129).                                                                                                                                                                                                                                         | **ADR-0129**                     |
| **Edition-vs-module bundle math**         | ~~Fat editions discount vs. module-sum; thin editions stay premiums ABOVE module-sum~~ — **REVERSED by ADR-0137 (Q4):** EVERY edition is now priced below its module-sum (a genuine bundle discount), abandoning the thin-edition-premium thesis.                                                                                                          | **ADR-0129 → ADR-0137**          |
| **Q4 edition reprice (build wave)**       | Full below-sum: Compliance **$2,499→$749** · AI-Kit **$599 hold** · Agentic-Dev **$499→$249** · Local-first **$499→$349** · Bundle **$3,499→$1,499** (savings $447 vs edition-sum $1,946). Supersedes the ADR-0129 edition point-values in full; module sheet holds. **BUILT** (`apps/site/lib/pricing.ts`).                                               | **ADR-0137** (super. 0129 pts)   |
| **Q1 registry gating (build wave)**       | Free floor re-keyed on `license === Apache-2.0` (was `editions[]===[]`) — closes the free-view leak that served ~12 commercial base-kind modules free; edition entitlements expand to member modules; fail-safe to open. **BUILT** (registry-schema + Worker), un-gating takes effect at DEPLOY.                                                           | **ADR-0136** (extends 0047/0071) |
| **Fork A tooling licensing (build wave)** | The ships-with-generator trio `cli`·`migrate`·`license-verify` flips to open **Apache-2.0** Base (every buyer's generated repo embeds them); `pricebook` stays commercial + gated. **BUILT** (license flip + ledger/index regen + standards-gate).                                                                                                         | **ADR-0136** (amends 0094/0111)  |
| **Catalog scope**                         | ALL substantial commercial modules sold individually (~12); thin seams (`ai-config`/`tenancy-rls`/`jobs`/`email`) stay bundle-only.                                                                                                                                                                                                                        | **ADR-0129**                     |
| **Availability / maturity flags**         | ALL 17 SKUs (5 editions + 12 modules) shown fully available, no maturity flags — pure as-if-live. **Supersedes ADR-0082 §3** (true-to-built) **+ §4** (Agentic-Dev roadmap-gating). Site stays CF-Access-gated (ADR-0107), not public.                                                                                                                     | **ADR-0130** (super. 0082 §3/§4) |
| **Checkout mechanics**                    | Custom site cart → ONE multi-item Paddle checkout (primary); sequential single-item overlays (fallback) if Paddle doesn't support multi-item one-time line items — verify before building.                                                                                                                                                                 | **ADR-0131** (extends 0116)      |
| **Copy rewrite**                          | Full research-backed customer-facing rewrite of every product/edition/module page (refero + competitor research + ADR-0080 copy laws); kill internal-doc tone. Copy/design track builds this — not a new ADR. **Status: FAST-FOLLOW** — the storefront ships functional with minimal copy; the deep rewrite is a follow-up before public launch (Stage 4). | board (→ copy/design track)      |
| **Build sequencing**                      | Store rework (SKUs + cart + cards + pricing + as-if-live) ships BEFORE the Railway cutover — one cutover with the finished store already live. **Status: BUILT** on `feat/dashboard-unified-and-p6-tail` (copy rewrite the one fast-follow tail).                                                                                                          | board                            |
| **Grandfathering (extended)**             | One-time buyers locked at purchase price forever, forward-only changes — extends ADR-0106's grandfather policy to the new per-module/per-edition SKUs from ADR-0129.                                                                                                                                                                                       | **ADR-0129** (extends 0106)      |

ADR-0129 was an interim (Local-first $499→$399, Bundle $3,499→$2,999, Compliance held at $2,499); the
**Q4 build-wave reprice (ADR-0137) is the current authority** — every edition below its module-sum:
Compliance **$749** · AI-Kit **$599** · Agentic-Dev **$249** · Local-first **$349** · Bundle
**$1,499**. Module sheet (12 modules + competitive comparables) unchanged: `ADR-0129`. Reprice
rationale + the reversed thin-edition-premium thesis: `ADR-0137`.

## Closed by the 2026-06-30 harvest grill session (operator-locked)

Four forks locked in an operator picker (`AskUserQuestion`) on the harvest initiative — what to
harvest, when, how thoroughly to build the audit tooling, and how buyers sign in. All document-only:
no code lands under any of these locks. Consolidated ranked tracking doc:
`docs/state/harvest-program.md`.

| Fork                             | Decision                                                                                                                                                                                                                                                                                                                           | Record       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **Harvest intent + scope**       | The 11 gridwork-core infra packages become **sellable substrate** for Agentic-Dev + AI Production Kit (a product investment, not internal-only); the 6 Wardfile product-code lifts harden the BASE.                                                                                                                                | **ADR-0133** |
| **Harvest sequencing**           | ALL post-go-live — the store-rework (ADR-0129/0130/0131) + Railway cutover finish first; the harvest is the next initiative, not folded into go-live. Spec-gated per package.                                                                                                                                                      | **ADR-0133** |
| **Audit/validate harness depth** | **FULL build** — audit surface manifest + unified cross-domain reconciling ledger (generalizes `tooling/design-critic`, ADR-0101) + workflow-scope guard + `/validate` multi-provider spine (PAL `challenge` ×2, majority-kills, default-to-refuted).                                                                              | **ADR-0134** |
| **Buyer sign-in**                | Magic-link (primary, Resend-wired) + GitHub/Google OAuth (one-click), both via better-auth (ADR-0015). **Closes the buyer-sign-in-placeholder gap** flagged in `docs/build-state.md`. **Status: BUILT** (`better-auth@1.6.23` wired real on the branch, 71 tests; account/tenant mapping + table migration are Stage-2 ops seams). | **ADR-0132** |

Two NEW commercial Compliance modules from the 6-repo lift sweep's top-15 (`caisson-lift-sweep-REPORT.md`,
ranks #1 and #3) are locked alongside the harvest scope: `@caisson/alerting` (SOC2 CC7.2
dedup→cap→quiet-hours→deliver→audit) and `retention-runner` (CCPA/GDPR erasure) — **ADR-0135**,
document-only, pricing deferred to build time under ADR-0129's methodology.

**ADR numbering (2026-06-30 sessions):** the highest number used or proposed before this session was
**0128** (`docs/state/adapter-expansion.md`'s Tier-3 MCP-HTTP-transport proposal — proposed, not
locked). The pricing/store-rework + harvest locks start **above** that ceiling at **0129** and run
contiguously through **0135** (0129 pricing · 0130 as-if-built storefront · 0131 cart/checkout · 0132
sign-in · 0133 harvest initiative · 0134 audit harness · 0135 new Compliance modules); the
store-rework BUILD wave then added **0136** (license-keyed registry gating + tooling-open) and
**0137** (Q4 edition reprice, supersedes 0129 point-values). The admin-control-plane picker then added **0138** (admin.caisson.sh operator control-plane + full-fleet observability charter, executes ADR-0117). The **2026-07-01 Stage-2 build** then locked four parallel-stream ranges above that: **0140–0143** (Stream A obs-admin detail forks) · **0150–0153** (Stream B harvest modules — parallel ship / all-4-channel alerting / retention-runner scheduling / tool-exec) · **0160–0162** (Stream C edition hardening — inference drivers / MCP Streamable-HTTP / per-tenant BYOK) · **0170–0176** (Stream D adapters + org account_member). The **2026-07-01 provider picker** then used
**0177–0178** (Grafana-sole-OTLP/PostHog/Linear+Cookiy/Greptile-PR-gate · edition members-fold), and the
**2026-07-01 edition seam-completion picker** used **0179–0185** (OSCAL export · BYOK buyer · live-transports
defer · Bun-OTel — resolved below). `0139`/`0144–0149`/`0154–0159`/`0163–0169` stay reserved for per-stream
spillover; **note ADR-0179 had been advisory-reserved for D6 harvest / Stream-D spillover — the operator
reassigned it to the OSCAL version fork.** The 2026-07-01 LIFT slice-1 picker added 0186/0187/0188 (see
the LIFT section below); the site-marketplace-rework session then filed **0189–0196**, the whole-repo-audit
remediation **0197–0199**, the editions-go-live session **0187 (from its reservation) + 0201–0202**, and
the commerce-goes-live session **0200 + 0203** (its Discord ADR renumbered 0201 → 0203 at merge, ADR-0088
second-merger-renumbers) — **ceiling now 0203**. The board's own interim "ADR-0119" placeholder (Railway provisioning topology, recorded above) and
`adapter-expansion.md`'s proposed 0119-0128 range remain unresolved against each other (flagged there
already) — this session's numbers do not touch that range and do not resolve that pre-existing flag.

**2026-07-06 clarification (no renumbering — ceiling stays the current live number in `docs/adr-index.md`):**
`adapter-expansion.md`'s side of this is resolved — its 0119-0128 pencils were retired and shipped under
real numbers (ADR-0170-0176 etc., per `docs/adr-index.md`; see that file's own 2026-07-06 reconcile
block). The board's own "ADR-0119" (Railway provisioning topology, row above) is the only piece still
outstanding — it has never been filed as a real ADR despite the Railway deploy having since happened;
when it is filed it takes whatever number is next off the live ceiling, not literally 0119.

## Closed by the 2026-07-01 edition seam-completion picker (operator-locked)

Seven forks surfaced by the **edition seam-completion** initiative (SPECs under
`outputs/specs/edition-seam-completion/`), all operator-locked 2026-07-01. Two diverge from the draft
recommendation (marked). ADR bodies: `knowledge/decisions/ADR-0179..0185`.

| Fork                                      | Decision                                                                                                                                                                                                                                                                                                                  | Record       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **OSCAL version + catalog binding**       | Emit `oscal-version` **v1.2.2** (latest stable); ship a canonical per-framework Assessment-Plan (AP) fragment so `import-ap` resolves. No 1.0.4 FedRAMP-compat dual-target now.                                                                                                                                           | **ADR-0179** |
| **OSCAL output format**                   | **JSON primary + an oscal-cli XML converter output path** (NIST `oscal_<model>_json-to-xml` XSLT via `oscal-cli convert`, XML first-class alongside JSON); Java/Docker `oscal-cli` dep in the export tooling (not the core lib runtime) + a CI JSON→XML→validate round-trip. Never hand-rolled.                           | **ADR-0180** |
| **OSCAL collector + framework scope**     | **DIVERGES from SOC2-first draft rec:** **all three** frameworks (SOC2 + HIPAA + EU-AI-Act) get a validate-conformant export NOW; ADD the HIPAA `substrate.field-crypto-policy` collector + the EU-AI-Act risk-register traversal; build the **full dashboard attestation wizard** (`apps/site`) to fill `manualSlots[]`. | **ADR-0181** |
| **BYOK credit-vs-BYOK billing**           | **FREE** — a metered AI action under a tenant key debits **$0 credits**; internal metering still runs as the spend-cap/abuse mechanism (not the billing signal); platform value = edition/subscription fee.                                                                                                               | **ADR-0182** |
| **BYOK key-submission UX + endpoint**     | Endpoint in the **`apps/site` route-handler** (reuses buyer session + `withTenant` RLS); UX MUST: validate-on-submit · write-only (masked last-4, never read back/logged) · atomic rotation.                                                                                                                              | **ADR-0183** |
| **Live-transport un-stub scope**          | **DIVERGES from S3-WORM-now draft rec:** **leave all three stubbed** (S3 WORM · hosted inference · on-device ONNX) — code is already fully implemented, only creds+infra+test are missing, deferred for all three. **No build results from this ADR.** Seams stay honestly-documented un-exercised-by-design.             | **ADR-0184** |
| **Bun OTel request-span instrumentation** | **Manual request spans** via a ~30-LOC `withSpan`/middleware wrapper (OTel SDK tracer API directly, zero new dep, works on Bun today); named ceiling (no auto child-spans). Closes the gap found at the 2026-07-01 Grafana cutover (Bun bypasses node:http/undici/pg auto-instrumentation).                               | **ADR-0185** |

Build scope: ADR-0179/0180/0181 drive the OSCAL SPEC; ADR-0182/0183 drive the BYOK SPEC; ADR-0184 = the
live-transports SPEC is DEFERRED (no build); ADR-0185 is a small shared-server observability helper.
**Status: all three SPECs are now BUILT (this session)** — OSCAL v1.2.2 JSON+XML export across all 3
frameworks (`packages/compliance`, golden fixtures under `__golden__/`), the free-BYOK billing policy +
buyer key form (`packages/{ai-kit,pricebook}` + `apps/site` `/dashboard/{ai-keys,compliance}`), and the
`withRequestSpan` Bun manual-span helper (`packages/observability`, wired into `services/docs`+`services/license`).
ADR-0184 (live-transports) was deferred by design, no build — **superseded 2026-07-01 by ADR-0201**
(editions-go-live session): all three transports proven against real infra (see the editions-go-live
section below).

## Closed by the 2026-07-01 LIFT slice-1 picker (operator-locked)

Five forks surfaced by the **LIFT phase** (survey `outputs/archive/specs/lift-phase/SLICE-PLAN.md`; per-item
SPECs `SPEC-agent-runner.md` / `SPEC-support-impersonation.md` / `SPEC-audit-harness-pipeline.md`), all
operator-locked 2026-07-01 to the recommendation column. Build order: **ADR-0188 (audit-harness) first**
→ whole-repo multi-model audit → then ADR-0186/0187 (the two new sellables).

| Fork                                                 | Decision                                                                                                                                                                                                                                                                                               | Record                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| **F1/F2/F5 — agent-runner boundary/config/pricing**  | New commercial `@caisson/agent-runner` (Agentic-Dev member, separate from agent-dev); provider-agnostic `{binary, baseUrlEnv, authEnv, model}` config; folded into the Agentic-Dev edition price, no standalone SKU (ADR-0137 below-sum).                                                              | **ADR-0186** (files at build)                             |
| **F3 — support-impersonation boundary + coverage**   | Fold into `@caisson/compliance` (needs audit-chain/collectors/withTenant — a separate pkg would depend "up", ADR-0003); ship SOC2 **and** HIPAA access-control collectors.                                                                                                                             | **ADR-0187** (FILED 2026-07-01, editions-go-live session) |
| **F4 — audit-harness reconcile scope + driver home** | `reconcile(previous, current, scope)` — explicit required `--domains` (fail-loud); out-of-scope previous findings pass through unchanged (fixes the silent cross-domain false-close). Dispatcher + Challenger driver **outside** the package in a Caisson-local skill (ADR-0134 / AGENTS.md boundary). | **ADR-0188** (FILED, building)                            |

**Numbering (reconciled 2026-07-01, editions + commerce go-live sessions):** 0186 stays reserved +
decision-locked, files at its build; **0187 is now FILED** (editions-go-live). The
site-marketplace-rework session filed **0189–0196** and the whole-repo-audit remediation filed
**0197–0199**, so the shipped ceiling is no longer 0188 — it is **0203** (the editions-go-live session
filed **0201** live-transports-go-live + **0202** retention-escalation; the commerce-goes-live session
filed **0200** Paddle-webhook-mount + **0203** Discord-role-grant, the latter renumbered from a drafted
0201 at merge since editions took 0201 first — ADR-0088 second-merger-renumbers convention). Slice-2
hardening tail (Wardfile B-series + convergent lift-sweep ranks) stays queued, unnumbered — EXCEPT **B2
retention-escalation, pulled forward and locked as ADR-0202** (SPEC:
`outputs/archive/specs/lift-phase/SPEC-retention-escalation.md`).

## Closed by the 2026-07-01 editions-go-live picker (operator-locked)

Four forks surfaced by the **editions-go-live** session (kickoff: un-stub the deferred live transports +
ship the Compliance impersonation sellable), all operator-locked 2026-07-01. ADR bodies:
`knowledge/decisions/ADR-0201`/`ADR-0202` (+ `ADR-0187` filed from its LIFT reservation).

| Fork                                     | Decision                                                                                                                                                                                                                                                               | Record       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **ADR-0184 revisit — un-stub scope**     | **Prove ALL THREE transports live** (diverges from the kickoff's lean S3-only rec): S3 WORM + hosted inference + availability-gated ONNX; live tests in per-package `live/` dirs outside the default suite; includes the ai-kit Responses-API fix.                     | **ADR-0201** |
| **S3 WORM provider + provisioning**      | **AWS S3, provisioned THIS session** (DEPLOY-class act explicitly authorized): bucket `caisson-worm` us-east-1, Object Lock at creation, GOVERNANCE-mode live proof, scoped prover IAM documented; R2/B2/Wasabi/MinIO all fail an adapter invariant today.             | **ADR-0201** |
| **Hosted (non-BYOK) inference endpoint** | **OpenRouter, both lanes** — ai-kit platform lane via `@ai-sdk/openai-compatible` (fixes the AI-SDK-v5 Responses-API default on openrouter/local/ollama) + local-ai `createOpenRouterRentedTransport` (/embeddings + /chat/completions → the metered RentedTransport). | **ADR-0201** |
| **Wardfile B2 retention-escalation**     | **Build now, own ADR** (pulled forward from slice-2): extend-only `extendRetention` + gated GOVERNANCE→COMPLIANCE escalation, chain-evidenced, row==object invariant preserved.                                                                                        | **ADR-0202** |

## Flagged for the Compliance session (P2 pre-work — do NOT build in the foundations track)

| Item                                                          | Why                                                                                                                                                                                                                                                                                                                       | Owner              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Amend ADR-0006 — field-crypto base tier → LOCKED ADR-0043** | Decision locked: per-tenant **HKDF** derivation at base tier + pluggable `FieldKeyProvider` KMS port (AWS adapter, GCP/Azure/Vault seam). Implementation lands in P2 `field-crypto` — golden-file + cross-tenant-isolation integration test before any evidence logic. **P2 crypto-shred + row-AAD now locked ADR-0055.** | compliance session |

## Closed by the 2026-07-01 site-marketplace-rework session (operator picker)

Nine forks (D-1…D-9) from the site-marketplace-rework audit, resolved in an operator picker after
code-grounding refuted several premised gaps (no second accent, one theme toggle, codified elevation, AA
nav contrast). D-8 closed no-op — no ADR.

| Fork                           | Decision                                                                                                                                           | ADR          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **D-1 — accent lock**          | Reaffirm the ≤10% single-accent lock; optional `--cs-proof` status token, no new brand hue.                                                        | **ADR-0189** |
| **D-2 — primary nav**          | Editions disclosure panel (WAI-ARIA APG Disclosure, text+mono, no icon grid).                                                                      | **ADR-0190** |
| **D-3 — marketplace routes**   | Three-route split (`/pricing` · `/modules` · `/build`) sharing one cart/pricing hook, `/build` flagship.                                           | **ADR-0191** |
| **D-4 — buy verb**             | Single "Add to cart" sitewide; demote/retire "Get X"; fix "Get started" nav CTA.                                                                   | **ADR-0192** |
| **D-5 — checkout surfaces**    | Differentiate drawer (glance) vs `/cart` (rich+procurement) vs `/dashboard/cart` (pay handoff); single-sourced line-item + bundle-math primitives. | **ADR-0193** |
| **D-6 — accessibility**        | WCAG 2.2 AA floor; every gap folds into its owning fork (drawer focus → D-5, mobile toggle → D-7, live regions → D-3).                             | **ADR-0194** |
| **D-7 — design-system codify** | Drop JetBrains Mono, Martian-only; hoist de-duped SKU matrix; mobile `ThemeToggle`; lock 2 button variants + 1 tertiary link.                      | **ADR-0195** |
| **D-8 — hero cursor-glow dot** | Closed no-op — does not exist in code; static `--cs-glow-accent` hover stays locked per DESIGN.md §6.                                              | — (no ADR)   |
| **D-9 — ⌘K search**            | Extend the trigger + key listener sitewide via `useSearchContext`; sequenced after D-2 as a secondary trigger.                                     | **ADR-0196** |

**Build sequence:** D-4 → D-7 → D-3 → D-2 → D-5 → D-9 → D-1, with a11y (D-6) folded into each owning fork
rather than a standalone phase, and copy/SEO passes last.

**ADR numbering (2026-07-01 site-marketplace-rework):** started at **0189** to sidestep the concurrent
"lift" phase's claim on 0186-0188 — the live shipped ceiling at authoring time is **0178**. If the lift
phase lands 0186-0188 first, this whole block renumbers by-meaning at merge (the repo's standard pattern
for concurrent-track ADR collisions, per the 0108→0110/0109→0113 P6 precedent).

## Closed by the 2026-07-02 security-billing-hardening (Strix) picker round (operator-locked)

Four forks surfaced verifying the six Strix pentest findings (`docs/security/strix-findings-2026-07-01.md`)
against the code, all operator-locked 2026-07-02 via AskUserQuestion. Two findings were clear real bugs
with no fork (vuln-0005 multi-item fulfillment, vuln-0006 BYOK owner-gate); one was a false-positive at
HEAD (vuln-0002). Single ADR body: **ADR-0204** (supersedes ADR-0140's admin-auth posture). PR #45 merged to main (merge commit `2dc44cc`); **ceiling → 0204 at this round** (the same-day edition-tails-ops round then took 0205–0209 — overall ceiling now 0209, see above).

| Fork                                   | Decision                                                                                                                                                                | ADR          |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **vuln-0004 — SSRF fix strategy**      | **Resolve + recheck IPs** (not connect-time pinning — Bun fetch can't pin; not an allowlist — breaks the any-public-host promise). One shared kernel guard, both sinks. | **ADR-0204** |
| **vuln-0001 — rate-limit trusted IP**  | **Trust `X-Real-IP` + a header-independent global cap** (drop the spoofable `x-envoy-external-address`); Cloudflare-in-front deferred as DEPLOY-class.                  | **ADR-0204** |
| **vuln-0003 — admin auth disposition** | **Add a fail-closed CF-Access-JWT middleware** (aud pinned to the admin app) — supersedes ADR-0140's edge-alone posture; closes the grey-origin bypass in code.         | **ADR-0204** |
| **vuln-0006 — compliance attestation** | **Owner-only** (attest + clear) — attestations feed the customer OSCAL export, so seats can't fabricate/clear them; seats see status read-only.                         | **ADR-0204** |

**Deferred (flagged, not auto-decided):** partial-refund of one line in a multi-item cart stays a
full-refund-only no-op (ADR-0113) — a per-line-revoke posture is a future operator fork.

## Closed by the 2026-07-02 lift-harvest slice-2 picker (operator-locked)

Kickoff B (LIFT harvest buildout, `outputs/archive/kickoffs/lift-harvest-buildout.md`). Act 0 ran a 20-agent
built-vs-remaining reconcile of the full ADR-0133/0134/0135 program (workflow `wf_22d4f058-b01`); the
result: 12 targets already terminal-done (cited in ADR-0210), 10 packages with named hardening gaps,
agent-runner not started. The three open program forks were then operator-locked in one picker; the
per-package decisions filed as ADR-0211–0217 (drafted 0205–0211, renumbered at merge per ADR-0088 — strix/edition-tails claimed 0204–0209 on main first) and ADR-0186 filed from its "files at build" reservation.

| Fork                                      | Decision                                                                                                                                                     | ADR               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| **H-1 — ai-evals/guardrails asymmetry**   | HARDEN IN PLACE — new capabilities land inside the existing base packages; edition membership unchanged (AI Production Kit keeps both).                      | **ADR-0210 §1**   |
| **H-2 — slice-2 wave scope**              | FULL remaining program (incl. the M/L tail: jobs consumer-side, rounding provenance, MinHash dedup) — only auth #9 deferred.                                 | **ADR-0210 §2**   |
| **H-3 — explicit defers**                 | auth lift-sweep #9 hash-at-rest session tokens DEFERRED (fights better-auth, ADR-0015); wave-6 residual candidates PARKED per program ordering.              | **ADR-0210 §3–4** |
| **agent-runner (F1/F2/F5, locked 07-01)** | Proceeds — not re-asked; ADR-0186 FILED at build start per the reservation.                                                                                  | **ADR-0186**      |
| **Per-package build decisions**           | jobs consumer-side · branded-money/rounding-provenance · ai-kit embeddings · ai-evals depth · guardrails · mcp-server manifest/ledger · ai-meter dedup gate. | **ADR-0211–0217** |

## Closed by the 2026-07-02 deferred-respec picker round (operator-locked)

The 11 deferred-by-decision items were researched into SPEC drafts (`outputs/specs/deferred-respec/`,
PR #55). The operator selected 5 for build-now and locked all 16 tabled forks in one picker round —
two picks override the spec recommendations (PF-1, AM-2) and one adds scope (ONNX F2). Six specs
stayed `draft — operator lock required` at that round; **three of the six were then locked the same
day** (registry self-hosted npm delivery → ADR-0223 · live-verification harness → ADR-0224 ·
edition members-fold republish → files at execution, see the three sections below). Three remain
draft (TBD).

| Fork                                      | Decision                                                                                                                                                                                                                | ADR          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **PF-1..4 — Paddle partial refund**       | C-b `line_item_id` columns (OVERRIDE of C-a side-table rec) · A-1 item-type semantics · B-1 per-line refcount · D-2 shape/D-1 population.                                                                               | **ADR-0218** |
| **CF-1..2 — CF front rate-limit**         | Flip docs-api proxied, license stays grey · Free-tier rules now, Pro evaluated at real traffic. Apply + DNS flip = DEPLOY-class.                                                                                        | **ADR-0219** |
| **AM-1..5 — admin mutation surface**      | 4 actions v1 (buyer-lookup dropped) · dedicated `admin_write` role (OVERRIDE of reuse-withTenant rec) · `admin_adjust` tag · WORM day 1 · new admin-scoped reissue credential. Supersedes ADR-0141's mutation deferral. | **ADR-0220** |
| **KMS-1..2 + ONNX G1/F1/F2 — live seams** | Shared prover principal · print-only provisioner (CMK deferred) · G1-A throwaway-install sign-off · F1-A doc-flip-only on green · F2-B EgressGuard unification in-slice (OVERRIDE of defer rec, security tag).          | **ADR-0221** |

## Closed by the 2026-07-02 distribution picker (operator-locked)

npm-login-verified facts drove this round: the npm name `caisson` is third-party-taken (bare
`caisson@0.1.3`), the operator owns npm org `caisson-sh`, and nothing open is on public npmjs
(publish.yml is GitHub-Packages-only, no npmjs credential). Same day the operator created the
GitHub org `caisson-sh` and transferred the monorepo to `caisson-sh/caisson`.

| Fork                              | Decision                                                                                                      | ADR          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------ |
| **Public npm scope**              | `@caisson-sh/*` locked now (mirror renames at export; in-repo stays `@caisson/*`; registry ids never rename). | **ADR-0222** |
| **npmjs publish path**            | The public mirror repo owns npmjs publishing; monorepo publish.yml stays GH-Packages (ADR-0069).              | **ADR-0222** |
| **Credit pack price**             | $49 for 5,000 credits — sandbox SKU created, pricebook row wired.                                             | **ADR-0222** |
| **agent-runner marketplace**      | Listed as the 15th module at $49 (matches registry 4900¢); members-map lag stays with members-fold republish. | **ADR-0222** |
| **greptile-gate latency + globs** | Wait 15→35 min; `tooling/` glob narrowed to `tooling/standards-gate/src/` (PR #60).                           | CI, no ADR   |

## Closed by the 2026-07-02 registry self-hosted npm delivery lock (operator-locked)

The same-day sequel to the distribution picker: one of the six specs left `draft` above. The
operator locked **option A** — `registry.caisson.sh` becomes a real npm registry (packuments +
tarballs), authenticated by the license token buyers already hold — plus all eight sub-forks in one
round (SPEC `outputs/archive/specs/deferred-respec/SPEC-registry-npm-delivery.md`). Supersedes the
structurally-dead GitHub-Packages buyer channel baked into `packages/cli/src/generate.ts` +
`packages/cli/templates/base/.npmrc`; the generator + docs flip land in the build that implements
the SPEC (**not yet built**). ADR-0222's `@caisson-sh/*` npmjs mirror stays the public-discovery
surface, this ADR owns the commercial delivery track.

| Fork                           | Decision                                                                                                                                                                    | ADR          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **A — tarball serving**        | A1 same-origin Worker proxy: the Worker serves tarball bytes through its R2 binding, re-checks the Bearer entitlement on every GET. No pre-signed URLs, one auth surface.   | **ADR-0223** |
| **B — base packages here too** | B1 base served here too, unauthenticated; commercial modules license-gated, one scope, one `.npmrc` line reusing the live base-∪-entitled union.                            | **ADR-0223** |
| **C — auth token**             | C1 raw license token IS the `_authToken` at launch (npm/bun send it as `Authorization: Bearer`); derived/rotatable tokens (C2) are the hardening follow-up.                 | **ADR-0223** |
| **D — miss semantics**         | D3 401 bare / 404 with token: no token → 401 (auth retry); verifies-but-not-entitled → 404 (no-existence-leak, ADR-0076).                                                   | **ADR-0223** |
| **E — dist-tag range**         | E1 latest only, mapped from the ledger; no prerelease channel until something produces prerelease tarballs.                                                                 | **ADR-0223** |
| **F — revocation**             | F1 offline revocation: the offline Ed25519 contract holds; a refunded buyer installs until token expiry. Online per-install revocation (F2) pairs with C2 later.            | **ADR-0223** |
| **G — hosting**                | G1 Cloudflare-native: extend the LIVE caisson-registry Worker (edge Ed25519 verify + native R2 binding + `registry.caisson.sh` route, same-account R2 egress free).         | **ADR-0223** |
| **H — tarball metadata**       | H1 private commercial tarball sidecar maps `(id, version)` → `{R2 key, shasum, integrity, size}`; the Apache-2.0 `registry-schema` + world-readable `index.json` untouched. | **ADR-0223** |

## Closed by the 2026-07-02 live-verification harness lock (operator-locked)

The second of the six draft specs, locked the same day. Six operator forks (F1–F6) gate a
verification harness that proves each of the five production-wired external seams (Paddle
checkout→webhook→grant · Discord role-grant · Linear Triage sink · Grafana Cloud query ·
`NEXT_PUBLIC_*` analytics) against its real remote, so the pre-launch key-rotation pass gets a
single green/red proof that the rotated creds actually work end-to-end. Test files + `test:live`
scripts only, no product code (SPEC `outputs/archive/specs/deferred-respec/SPEC-live-harness-production-seams.md`);
extends the ADR-0201 `live/` + `skipIf` convention to service-level seams. Two picks override the
spec recommendation (F1, F3).

| Fork                            | Decision                                                                                                                                                                                                                                                        | ADR          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **F1 — Paddle delivery method** | C — **BOTH** (OVERRIDE of the simulator-only rec): the simulator API is the routine headless webhook→grant proof; a rarely-run Playwright sandbox-checkout leg is the full-fidelity check.                                                                      | **ADR-0224** |
| **F2 — proof target**           | A — the DEPLOYED Railway fleet, with a reserved proof tenant + per-run UUID isolation + a teardown leg per seam (seams 3–4 read-only either way).                                                                                                               | **ADR-0224** |
| **F3 — Discord grant depth**    | B — **FULL grant + teardown** (OVERRIDE of the 404-only rec). Fixtures: the operator's main Discord account (guild owner) is the standing test member; throwaway role `caisson-proof` (id `1522364538790350980`, created 2026-07-02 via the Administrator bot). | **ADR-0224** |
| **F4 — analytics proof depth**  | A — build-grep: `next build` `apps/site` with the `NEXT_PUBLIC_*` envs set, grep the client bundle for the inlined key/domain. Ingestion stays dashboard-verified.                                                                                              | **ADR-0224** |
| **F5 — automation posture**     | A first — the local `bun run test:live:all` command the rotation runbook calls. A `workflow_dispatch` CI job is a later, separately-audited step (puts creds on a runner).                                                                                      | **ADR-0224** |
| **F6 — launch credential SOT**  | A — `~/.gridwork/caisson.env` STAYS the launch credential SOT the harness reads + asserts parity against. A 1Password vault, if stood up, is a durable recovery store, NOT the SOT.                                                                             | **ADR-0224** |

## Closed by the 2026-07-02 edition members-fold republish lock (operator-locked)

The third of the six draft specs (the members-fold in revision re-run). Locks the mechanics of
folding the Stage-2 primitives + `@caisson/agent-runner` into the edition `members` maps and
republishing the registry ledger/index. The ADR is filed **during the republish run itself** (C1),
not up front — consistent with the ADR-0178 ledger/index-only republish posture
(`CAISSON_PUBLISH_DRY_RUN` stays `"true"`).

| Fork                        | Decision                                                                                                             | ADR          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------ |
| **A — changeset scope**     | A1 consume-all EXECUTED: all 24 pending changesets consumed in one `changeset version` sweep.                        | **ADR-0228** |
| **B — edition member pins** | B1 repin-to-bumped EXECUTED: both `members` maps (Compliance + Agentic-Dev) repinned to the cascade-bumped versions. | **ADR-0228** |
| **C — ADR timing**          | C1 EXECUTED: ADR-0228 filed at execution recording the ledger 65→98 / 33-pair index-rebuild deltas.                  | **ADR-0228** |

## Closed by the 2026-07-02 third picker round (operator-locked)

The third operator picker round of the day (late): all 15 questions answered in one round, across
four tracks — the admin-v2 purchase-revoke SPEC (CAISSON-19, forks R-1..R-6,
`outputs/specs/admin-v2-purchase-revoke/`), the pre-launch credential-sweep SPEC (Forks 1–4,
`outputs/specs/pre-launch-credential-sweep/`), the commerce numbers (compliance reprice +
per-module catalog posture), and the two residual registry npm-delivery mechanism forks
(implementation-level under the already-locked ADR-0223 — no new ADR; recorded here + in the PLAN's
fork section). **Three picks are operator OVERRIDES of the tabled recommendation:** R-4 (build the
edge revocation list into v2), credential-sweep Fork 4 (on-incident-only rotation), and the
module-catalog posture (create the sandbox catalog now instead of guarding the rows).

| Fork                                  | Decision                                                                                                                                                                                                                                                                                | ADR                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **R-1 — does revoke touch money?**    | A: DB-only revoke, claw UNSPENT credits, NEVER call Paddle; the claw is a per-action operator checkbox defaulting ON; refunds stay Paddle-dashboard-driven, idempotent with the refund webhook.                                                                                         | **ADR-0225**                      |
| **R-2 — targeting granularity**       | A: source-scoped (a `subscription_id` or purchase/`paymentId`); reuses the webhook revoke helpers unchanged; refcount preserved.                                                                                                                                                        | **ADR-0225**                      |
| **R-3 — subscriptions revocable?**    | A: one-time purchases ONLY in v2; subscriptions are revoked by cancelling in Paddle (the `canceled` webhook is the durable path).                                                                                                                                                       | **ADR-0225**                      |
| **R-4 — edge propagation**            | B — **OVERRIDE of the Recommended A**: build the EDGE REVOCATION LIST — a CRL-style deny-set (revoked license/account ids) the registry Worker checks on a short cache, with a publish path from the revoke action; v2's build INCLUDES the slice, scoped as its own task/spec-section. | **ADR-0225**                      |
| **R-5 — audit action taxonomy**       | A: distinct new `purchase_revoke` action type; enum + CHECK extended via a numbered `@caisson/migrate` migration; the claw captured in the same action's before/after money snapshot.                                                                                                   | **ADR-0225**                      |
| **R-6 — UI confirmation**             | A: type-to-confirm PLUS a mandatory impact preview (source · exact refcount-aware entitlement drops · credit-claw preview bounded to balance).                                                                                                                                          | **ADR-0225**                      |
| **Cred Fork 1 — issuer keypair**      | a: regenerate a FRESH launch Ed25519 issuer keypair (zero prod licenses issued); re-bake the pubkey into the registry Worker in the same act.                                                                                                                                           | **ADR-0226**                      |
| **Cred Fork 2 — parity-tool home**    | a: `tooling/scripts/vault-parity-check.ts`, colocated with `railway-env-sync.ts`; names-only, never values.                                                                                                                                                                             | **ADR-0226**                      |
| **Cred Fork 3 — vault granularity**   | a: one 1Password item per env-var NAME, title === name (exact name-level parity).                                                                                                                                                                                                       | **ADR-0226**                      |
| **Cred Fork 4 — rotation cadence**    | c — **OVERRIDE of the Recommended per-class cadence**: rotation is ON-INCIDENT ONLY across the board, no scheduled cadence. Honestly the weakest of the three postures (no scheduled expiry backstop for an unnoticed compromise); the operator accepted this explicitly.               | **ADR-0226**                      |
| **Compliance reprice**                | $749 → **$799** one-time (member-sum on the display sheet $846; $799 = 5.6% below sum — the ADR-0137 below-sum invariant KEPT; member display lists unchanged). Execution (Paddle price + `apps/site/lib/pricing.ts`) rides the commerce execution wave, NOT the docs PR.               | **ADR-0227**                      |
| **Per-module catalog posture**        | **OVERRIDE of the guard-now recommendation**: create all 14 per-module Paddle products/prices in the SANDBOX now + fill the pricebook placeholder ids — module checkout testable immediately; the catalog is re-created in the production Paddle account at the commerce flip.          | **ADR-0227**                      |
| **Registry Fork 1 — tarball sidecar** | 1.1: git-tracked `registry/tarballs` sidecar, inlined into the Worker bundle at build exactly like `index.json`.                                                                                                                                                                        | ADR-0223 (impl-level, no new ADR) |
| **Registry Fork 2 — CI auth + route** | 2.1: scoped S3-compatible R2 access keys as GH Actions repo secrets + the `registry.caisson.sh` route versioned in `wrangler.toml`.                                                                                                                                                     | ADR-0223 (impl-level, no new ADR) |

## Closed by the 2026-07-03 fourth picker round (operator-locked)

The fork-answer round run after the execution wave landed (PRs #75-#85 + #84 merged; registry
Worker redeployed with the 0228 index + npm routes). Six answers across four tracks, plus two
scheduling picks. **One pick is an operator OVERRIDE of the tabled recommendation:** SEO Fork C
(pre-commit the glossary program instead of waiting for organic demand).

| Fork                               | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | ADR                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **Wave-6 disposition**             | Build the compliance/billing subset — SPEC rows 8, 9, 10, 44, 50, 51, 54, 56, 57, 59 — as ONE spec/workflow/PR set; the remaining 57 rows go roadmap-only (build-on-trigger / drop-with-reason per the SPEC table).                                                                                                                                                                                                                                                                                                                                                                                                                            | **ADR-0229**               |
| **WORM retention mode at launch**  | GOVERNANCE stays the live default pre-launch; escalate to COMPLIANCE for launch-forward anchors at the commerce flip via the ADR-0202 gated extend-only path; local/test never COMPLIANCE (0051 kept).                                                                                                                                                                                                                                                                                                                                                                                                                                         | **ADR-0230**               |
| **OSCAL AP rlink hosting**         | Option 1: signed evidence bundle, RELATIVE rlinks + hashes[] SHA-256, sibling-directory layout (no .tar); reverses the 0208 §4 won't-fix; amends 0179's absolute-URL path; no new hosted route/egress sink; the assessmentPlanHref override seam untouched.                                                                                                                                                                                                                                                                                                                                                                                    | **ADR-0231**               |
| **SEO Fork A — trigger threshold** | N ~ 20+ committed near-identical pages (Stream-D bar kept).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | **ADR-0232**               |
| **SEO Fork B — one program**       | A single committed initiative of >= 20 pages; no aggregating smaller programs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **ADR-0232**               |
| **SEO Fork C — first program**     | **OVERRIDE of the wait-for-demand rec**: PRE-COMMIT the bulk glossary/definition-term program now; it gets its own product SPEC and the renderer builds with it as the implementation detail.                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **ADR-0232**               |
| **SEO Fork D — board wording**     | Point the open row at the SPEC by name (done in this change).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **ADR-0232**               |
| **Ask-AI widget scheduling**       | Spec it now, forks TABLED: `outputs/archive/specs/ask-ai-widget/SPEC-ask-ai-widget.md` drafted with 7 operator forks (auth posture / model+budget / placement / corpus / abuse / telemetry / synthesis home) awaiting a picker round. No ADR until the forks lock.                                                                                                                                                                                                                                                                                                                                                                             | (scheduling pick — no ADR) |
| **Audit-harness v2 scheduling**    | Scope BEFORE re-run: `outputs/archive/specs/audit-harness-v2/SPEC-audit-harness-v2.md` drafted — derived+gated domain matrix (~66 domains x 7 dimensions incl. the NEW customer-facing/sales-ready + internal-vs-sold lenses, oss-mirror in scope) with 5 operator forks awaiting a picker round. The re-run is gated on the lock.                                                                                                                                                                                                                                                                                                             | (scheduling pick — no ADR) |
| **Audit-harness v2 forks A–E**     | LOCKED (second sitting, same day): A per-dir ~66 derived domains + coverage gate · B advisory run, gate-promotion a separate follow-up · C fresh dimension-keyed ledger, v1 archived, 1 finding carried · D oss-mirror audited BOTH as source and as exporter-output diff · E **OVERRIDE**: standalone shipped-source rubric doc (not an ADR-0080 extension), citing 0080 as parent. Harness build + re-run unblocked.                                                                                                                                                                                                                         | **ADR-0233**               |
| **Ask-AI widget forks F1–F7**      | LOCKED (third sitting, same day; FOUR overrides): F1 anonymous · F2 **OVERRIDE** dual model lanes — public anon = gemini-3.5-flash default, authed/Discord premium = claude-sonnet-4.6 (support-bot default upgraded too), $10/day fail-closed public spend cap · F3 **OVERRIDE** both placements day one (docs-inline + ⌘K tab) · F4 **OVERRIDE** corpus = docs + marketing/pricing indexed from source-of-truth data (services/docs pipeline expansion in scope) · F5 **OVERRIDE** Turnstile day one + edge rule + spend cap (per-IP bucket held in reserve) · F6 Plausible counts only · F7 RAG ported to the site route. Build dispatched. | **ADR-0234**               |

## Closed by the 2026-07-03 fifth picker round (operator-locked)

The backlog-fork round after all fourth-round builds merged (PRs #86–#93 on `main`). Six answers:
the glossary program's five tabled forks + the ask-AI question-text follow-up. **Two picks are
operator OVERRIDES of the tabled recommendation:** glossary Fork B (adversarial agent workflow
replaces the operator-review cadence) and ask-AI Q-text (capture now, not defer).

| Fork                                | Decision                                                                                                                                                                                                                                             | ADR          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **Glossary Fork A — term list**     | Lock the 32 terms as listed in the SPEC; operator may strike a row at content review, never add without a new lock.                                                                                                                                  | **ADR-0235** |
| **Glossary Fork B — authoring**     | **OVERRIDE**: agent-authored via a multi-agent workflow with research grounding + adversarial verification (claims dated, PAL/skeptic-challenged; strictest pass on the compliance cluster). The operator gate is the PR merge, not per-page review. | **ADR-0235** |
| **Glossary Fork C — rollout**       | Cluster batches: batch 1 = renderer + hub + JSON-LD + compliance cluster; later batches pure data, measuring indexation between.                                                                                                                     | **ADR-0235** |
| **Glossary Fork D — interlinking**  | Curated related-terms (2–4 same-cluster slugs per term + sells CTA + hub); no auto-linking.                                                                                                                                                          | **ADR-0235** |
| **Glossary Fork D-nav — placement** | Footer only + sitemap; primary nav stays lean (ADR-0079 §4).                                                                                                                                                                                         | **ADR-0235** |
| **Ask-AI Q-text capture**           | **OVERRIDE of the defer rec**: capture question text server-side with a visible consent notice; record is `{day, lane, text, outcome}` only (no IP/user-id/answer), 90-day hard-delete retention; Plausible stays counts-only.                       | **ADR-0236** |

## Closed by the 2026-07-03 fifth picker round, second sitting (site presentation rework)

Eight forks of `outputs/archive/specs/site-presentation-rework/SPEC-site-presentation-rework.md` locked in
one round, plus two operator posture riders. **Three picks are operator OVERRIDES of the tabled
recommendation** (F1 unified hub, F5 true id renames, F7 full-surface copy). Build waves are
sequenced after the glossary batch-1 merge (shared nav/routes/footer surface).

| Fork                          | Decision                                                                                                                                                                                                                              | ADR          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **F1 — marketplace IA**       | **OVERRIDE**: unified `/marketplace` hub (tabs Editions · Modules · Build · Plans), `/pricing` 301s in; supersedes the ADR-0191 three-route lock; single buy-verb + cart drawer unchanged.                                            | **ADR-0237** |
| **F2 — depth surfaces**       | Real routes for all 15 modules on the section-union renderer + a new `media` section kind; editions gain the media slot; subs get Plans-tab depth; Product/Offer JSON-LD everywhere; placeholder brand art now, real media later TBD. | **ADR-0237** |
| **F3 — nav arrangement**      | Logo left → centered link row → one right utility cluster (search · cart · Get-started · theme).                                                                                                                                      | **ADR-0237** |
| **F4 — dropdowns**            | **THREE card panels**: Editions · Marketplace · Resources (Docs/Glossary/Changelog/Security).                                                                                                                                         | **ADR-0237** |
| **F5 — name collision**       | **OVERRIDE**: true renames of the colliding module ids (catalog, entitlement slugs, registry/manifests, Paddle product names; 0216 retirement ledger); names proposed in the build PR; type chips on every price surface.             | **ADR-0237** |
| **F6 — icons**                | Bespoke in-brand set (~21 marks) via the designer lane.                                                                                                                                                                               | **ADR-0237** |
| **F7 — copy scope**           | **OVERRIDE**: full marketing surface rewrite through the draft→skeptic→gate pipeline.                                                                                                                                                 | **ADR-0237** |
| **F8 — analytics**            | Split by surface (extends 0118): Plausible cookieless funnel events on marketing; PostHog purchase/revenue server-side from the Paddle webhook; PostHog JS stays dashboard-only.                                                      | **ADR-0237** |
| **Rider 1 — brand system**    | ADR-0078/0189 tweakable by the designer lane for this rework — explicit design-system changes in the build PRs, contrast/a11y gates binding; no silent drift.                                                                         | **ADR-0237** |
| **Rider 2 — V1-live posture** | FULL launch posture: the site speaks as shipped V1 — no roadmap/"coming soon"/future framing anywhere; retires the ADR-0082 Agentic-Dev labeled-roadmap exception; true-to-built stays the floor.                                     | **ADR-0237** |

## Closed during the ADR-0237 build (2026-07-03, site-rework session — operator-locked in-session)

The F5 rename surfaced a product fork at build time (three picker rounds, evidence in the ADR):
the four colliding à-la-carte rows granted their WHOLE parent edition (a $299 module purchase
delivered the $799 edition + its Discord role), the operator's first pick ("grant the edition core
package only, rename all four ids") proved uninstallable (edition meta-packages hard-depend on
their commercial members — no separable core artifact exists), and the final lock was removal.

| Fork                                     | Decision                                                                                                                                                                                                                                                                                                                                                                                   | ADR          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| **F5 grant semantics + collision scope** | **Drop the four edition-core à-la-carte rows** (`compliance` $299 · `ai-kit` $149 · `local-ai` $299 · `agent-dev` $99) → an 11-module standalone catalog; editions are how composition is bought. Collision resolved by removal, not rename; collision data-lints added; no price NUMBER changes; supersedes ADR-0227's 14-sellable-module clause; type chips (F5 second half) still ship. | **ADR-0238** |

**Build status (2026-07-03): ADR-0237 + ADR-0238 are REALIZED.** PR #98 (the catalog row drop)
and PR #102 (the site presentation rework — unified `/marketplace` hub with `/pricing`/`/build`
301s per F1, 11 module depth routes on the section-union renderer with the `media` slot per F2,
nav rebuild F3/F4, bespoke icon set F6, full-surface copy rewrite F7, split analytics F8 —
Plausible funnel events on marketing + server-side PostHog purchase capture in the license
webhook — and the rider-2 V1-live posture sweep) are both merged to `main`. Recorded residuals:
F2's "real media later TBD" (placeholder brand art shipped) and glossary batches 2–3 (~20 terms,
ADR-0235 Fork C) — both tracked in `docs/state/opportunity-backlog.md` §8.

## Closed by the 2026-07-03 deploy-closeout picker round (operator-locked)

Three forks locked in one round during the post-site-rework deploy/closeout session (the two
parked audit-spec forks promoted per their SPECs, plus the wave-6 remaining scope):

| Fork                               | Decision                                                                                                                                                                                                                                                                    | ADR          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **Wave-6 remaining scope**         | **Build the 9 remaining `build-next` rows + close the ledger** (wave-6b, one spec/workflow/PR set). The 28 `build-on-trigger` rows stay parked on their per-row triggers; the lift-sweep report folds in-repo; the disposition SPEC goes terminal. Amends ADR-0229/0210 §4. | **ADR-0239** |
| **local-ai price (P1 spec fork)**  | **$349 stays canonical** — ADR-0137's below-sum reprice superseded ADR-0129's $399; manifest + site + Paddle already agree. No number change anywhere; the manifest PLACEHOLDER comment is rewritten to cite the lock.                                                      | **ADR-0240** |
| **Changeset prose (P2 spec fork)** | **Source gate, no silent formatter** — a standards-gate check fails PRs whose `.changeset/*.md` bodies carry internal prose (ADR cites, wave/row jargon, internal paths, agent slugs). The 22 pending changesets were hand-swept (PR #104) before the first live consume.   | **ADR-0241** |

## Closed by the 2026-07-04 visual-audit picker round (site-design session)

A full-site Playwright visual-audit workflow (48 routes × mobile/desktop × light/dark, critiqued
against the impeccable skill + DESIGN.md) surfaced 221 findings into
`tooling/design-critic/findings.toml`. Three genuine judgment-call forks; everything else in the
ledger has an unambiguous fix and routes straight to the remediation spec, no pick needed.

| Fork                                | Decision                                                                                                                                                                                                                                                                | ADR          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **Eyebrow-on-every-section voice**  | **Vary treatment per section** — keep `.cs-eyebrow` as the tokenized accent-budget primitive (ADR-0078), but differentiate wording/weight per section so the ~20-route repetition reads as voice, not AI-scaffolding reflex. A copy workstream, not a component change. | **ADR-0242** |
| **Real media on module pages (F2)** | **Reaffirm deferred** — this is the pre-existing ADR-0237 F2 gap, not new information. 14 ledger findings marked `accepted`; revisit when there's design bandwidth for bespoke diagrams/screenshots.                                                                    | **ADR-0242** |
| **Mobile buy-rail position**        | **OVERRIDE of the safe-default rec**: sticky bottom bar (persistent price + Add-to-cart) on mobile module depth pages, not a simple DOM reorder — the standard e-commerce mobile pattern, touching all 11 module depth pages' shared layout.                            | **ADR-0242** |

## State addendum — 2026-07-04/05 execution (site-design-2 close-out; no new forks)

PRs #110–#122 all executed under existing locks — no fork was opened or auto-decided:

- **Audit-v2 remediation specs ALL EXECUTED** (PRs #110–#115, the four operator-gated execution
  specs from PR #101). Field lesson recorded: never `.strict()` a provider webhook envelope —
  every real Paddle/Stripe delivery 400'd; plus a live Paddle-sim purchase proof.
- **ADR-0226 issuer-keypair rotation EXECUTED ×2** (PRs #117/#118) — active fingerprint
  `a170f7a0ab89bab0`; `caisson-license` + registry Worker redeployed; prod-signed golden fixtures
  retired for runtime-minted dev keys + an entitlement-token scan gate. The three web-minted
  credential rotations (OpenRouter / Discord / mirror PAT) remain operator-owed
  (`launch-runbook.md` §1.1).
- **ADR-0242 REALIZED**: visual-audit remediation shipped (PRs #116/#120 + the copy pass) and the
  `tooling/design-critic/findings.toml` ledger reconciled 2026-07-05 (PR #122) — 221/221 findings
  verified against fresh 48-route × 4-variant captures: **82 closed · 125 open · 14 accepted**.
- **ADR-0235 fully REALIZED**: glossary batches 2–3 shipped (PR #121) — all 32 locked terms live,
  llms.txt parity included. The ADR-0232 section-union renderer needs no further build (shipped
  with batch 1, generalized in PR #102).
- **Hygiene wave** (PR #119): the `refactor-split-opportunities.md` R1+R2 rows executed —
  `@caisson/rate-limit` (Apache-2.0) now owns the token-bucket + per-account store; `apps/base`
  no longer depends up on the commercial license service.
- **Launch-runbook §8 edge revocation deny-set FULLY LIVE** (operator-approved DEPLOY): R2 +
  `REVOCATIONS` binding + authed PUT shim + `license_revocation` DDL.

Open forks unrelated to the go-live sequence, surfaced 2026-07-05 for a future round: the **R3
compliance god-package split** (price-relock-gated — needs a superseding ADR against the ADR-0227
$799 anchor before any spec) and the **Agentic-Dev Next.js inspector** (code gap; substrate built).
The three.js signature spike stays parked. All three are queued in Kickoff A's picker round
(`outputs/archive/kickoffs/sot-expansion-and-automation.md`), not auto-decided.

A same-day second picker (2026-07-05, three work-organization picks — no ADR, scheduling-class)
split the outstanding work **by tree** into two parallel kickoffs: **Kickoff A** (docs tree —
SOT doc set · `bun run sot` · GTM distillation · the fork-queue picker) and **Kickoff B** (code
tree — the repo-improvement hygiene wave + audit remediation,
`outputs/archive/kickoffs/KICKOFF-B-hygiene-audit-remediation.md`). The audit pickup is **ALL 264 open
ledger findings** (91 high · 117 warn · 56 info — un-parks the TRIAGE §3 roadmap-only buckets),
with **verify-then-fix on all 91 highs** (TRIAGE §5's ~29 possibly-refuted round-3 highs make
every open-high a candidate, not a verdict).

## 2026-07-05 Kickoff-A picker round (SOT-expansion session) — 3 locks + 1 redirect

The SPEC §5 fork queue (`outputs/archive/specs/sot-expansion/SPEC.md`) went to the operator in one round:

- **Agentic-Dev inspector — LOCKED (ADR-0243)**: Fork A = A1 `Bun.serve` localhost script (the
  narrow ADR-0044 supersession that lock anticipated) · Fork B = B1 additive
  `LocalStore.list({limit,offset})`. Build queued for a code-tree session; lock-and-go against
  `outputs/archive/specs/deferred-respec/SPEC-agent-dev-inspector.md`.
- **Perpetual updates window — LOCKED (ADR-0244)**: one-time purchases = perpetual use + 12
  months of included updates + optional renewal (~40% of list, exact cents at the checkout
  flip). Must be in checkout/EULA copy before the flip.
- **Credit policy — LOCKED (ADR-0245)**: pooled rollover, every grant expires 12 months from
  issue, FIFO oldest-first burn. Pricing page may state it now.
- **R3 compliance split — REDIRECTED, price NOT locked.** The operator widened the fork instead
  of picking a number: the direction to pressure-test is **all editions become bundle options
  over an individually-sellable package catalog**, with explicit standards for (a) what goes
  OSS/base vs commercial-on-site and (b) when a package must split into sellable surfaces.
  Commissioned as **catalog-doctrine research** (this session, W4 —
  `outputs/archive/research/catalog-doctrine-2026-07.md`) producing a FORK QUEUE for a future picker;
  nothing in that direction is locked yet. R3's price re-lock folds INTO that round (still
  gated against the ADR-0227 $799 anchor + ADR-0238 catalog math); the R3 engineering SPEC is
  queued for its own session after the lock. The three.js signature spike stays parked.

## 2026-07-05 catalog-rework picker (same session, F1–F8 against the doctrine research) — 3 lock ADRs + a brainstorm mandate

The operator ran the F1–F8 queue the same day and opened the round as **brainstorm-class: NOT
bounded by prior packaging ADRs** (prior ADRs hold until each superseding lock lands). The
Kickoff-C tmp-dir session is superseded — the picker happened here; remaining work continues in
this worktree. Locks:

- **ADR-0246 — structure**: F1 = (b) every commercial package individually priced AND displayed
  (override of the curated-display rec) · F2 = (b) editions dissolve into true bundle objects
  **plus a bundle-set redesign mandate** (not a 1:1 relabel; candidate sets from the brainstorm,
  locked at a follow-up picker; the four editions stay displayed until then) · F6 = compliance
  **3-SKU carve** (core meta · frameworks-pack · signing), bundle price **derived from the F3
  formula**, exact numbers pending the pricing pass ($799 display stands meanwhile).
- **ADR-0247 — mechanics**: F3 = (a) ~25%-off-member-sum stays the bundle anchor · F7 = (a)
  growing bundles are snapshot-at-sale, updates-window-gated (a renewal window delivers later
  additions — option (b)'s benefit via (a)'s mechanics) · F8 = (a) self-serve upgrade crediting
  `bundle − owned_retail` off a pre-declared pricebook map.
- **ADR-0248 — line-drawing doctrine**: F4 = (a) buyer-based open-core standard + **ratchet
  engaging at first publish** + SPDX-as-boundary, Fair-Source out (the operator's first reply
  typed (b); corrected to (a) in-round — (a) is the lock) · F5 = (a) split checklist adopted +
  4 standards-gate checks queued as a code-tree build. **Pre-launch redraw clause:** nothing is
  published yet, so flipping Apache base packages to commercial and splitting `ui` into a
  basic-OSS floor + deep commercial design package are in-scope brainstorm candidates — decided
  per-package at the follow-up picker, one-way after first publish.

**G-series follow-up picker (same day, two structured rounds) — ADR-0249:** G1 bundle set =
**Persona + Provenance** (the four ICP bundles + Everything + a Provenance cross-bundle:
signing + audit-worm + field-crypto) · G3 `billing` splits (verify open / orchestration
commercial) · G4 `auth` carves (`workos`+`membership` → commercial) · G5 `credits` =
**decouple the cli debit gate, then flip** (override) · G6 `tenancy-rls` = **carve the
admin-write layer** (override; open fail-closed RLS foundation stays the proof point) · G7 the
three edition metas stay unpriced bundle-glue. **G2 (kit shape) redirected, NOT locked** — the
operator widened it: a public full-surface customizable/modular kit (possibly a new package off
`ui`), the internal brand system separate and built ON it, and per-package frontend surfaces as
build items; grounded options return after the frontend investigation.

**G2 third round (same day) — ADR-0250:** G2a = **P3 tiering, operator override** (`ui` stays
the Apache floor · new commercial `ui-pro` full kit, own SPEC before any build · new private
`brand` holds the mark + 22 glyphs + caisson preset) · G2b staged buildout (brand cut → theme
API/presets → public docs) · G2c per-package frontends = `./ui` subpath default, companion
packages only for framework-free cores, shared frontends package forbidden · G2d wave 1 = the
six S-effort surfaces (audit-worm viewer · license-issue log · local-store search ·
prompt-registry browser · ai-meter chart · audit-harness viewer), after the catalog-rework SPEC.

**ui-pro SPEC round (2026-07-06, Kickoff D Stage 1) — ADR-0259 (drafted 0251, renumbered at the E-merge):** component line =
**market-line split** (ui-pro = 7 deep/domain components — DataTable-Pro · Tree-Pro · Ops
Matrix (absorbs `sku-matrix`) · Audit Timeline · Payload Viewer · Type-to-Confirm · Adv
Date-Range — a strict leaf: no `packages/*` may depend on it; every table-stakes basic
stays/returns/backfills into the Apache floor, incl. charts as themed Recharts wrappers) ·
docs surface = **caisson.sh/ui gallery route** in apps/site, public live demos, registry-layer
gating, build deferred per 0250 G2b · **v1 = full 7** (operator override of the 5-core rec) ·
price-band input to Stage 2 = **$129–199, anchor $149, standalone-only** (ai-evals pattern —
no edition/bundle membership). Scope: `outputs/archive/specs/ui-pro/SPEC.md`.

**Pricing-revalidation round (2026-07-06, Kickoff D Stage 2) — ADR-0260 (drafted 0252, renumbered at the E-merge):** pricing logic =
**sum-of-parts comps-anchored** (Vanta-TCO = narrative, never pricing logic) · bundles
formula-locked at 0.75 × registry-truth member sums: **Compliance $1,049** (carve P_C $299 ·
P_F $249 · P_S $199) · **AI-Production $629** · **Agentic-Dev $329** (tool-exec $99) ·
**Provenance $399** · **Everything $1,749** (= 0.75 × Σ bundle prices, recompute-on-move) ·
new SKUs: auth-sso **$199/$249 conditional on the Stage-3 package shape** · credits $149 ·
billing-orchestration $99 · **ui-pro $129** · the 11 existing modules + both subscriptions +
the $49 top-up all revalidated-keep · **renewal cents = flat 40% X9-rounded** per SKU.
Display rides the Stage-3/4 rework build (no pricing.ts edit now). Evidence:
`outputs/research/pricing-revalidation-2026-07.md`.

**Catalog-rework SPEC round (2026-07-06, Kickoff D Stage 3, round 1) — ADR-0257:** bundle
model = **full rename + first-class `bundle` kind + resolve-time alias map** (operator
override of stable-ids; single alias point in `expandEntitlements`; shared vocabulary
constant consumed by Kickoff E's RENEWAL_BOOK — cross-session coordination locked, E never
re-keys) · **F7/F8 = data + D-side enforcement here on E's ADR-0255 plumbing precedent**
(pricebook member-timeline + F8 credit map + `entitledSince` sibling record + per-member
fail-soft filter; sequenced after E's PR #128; E owns per-version Worker enforcement;
absent key = grandfathered on both axes) · **org module = ONE merged `org-controls` $249**
(narrow membership carve — session-resolution stays open, the "zero blast radius" claim
REFUTED; all 6 admin-write exports; new `/dashboard/members` entitlement gate; $199
standalone branch dead) · **display = hub-extend + fifth Provenance persona page**, 1:N
`bundles[]` pricing model, renewal display deferred to dashboard. Scope:
`outputs/specs/catalog-rework/{SPEC,PLAN}.md`.

**Catalog pricing-consequence round (2026-07-06, Kickoff D Stage 3, round 2) — ADR-0258
(supersedes ADR-0260 on 3 numbers; supersedes ADR-0259 §5 on Everything content):**
**Local-first = full 3-way carve $629** (local-sync $199 · local-inference $249 ·
local-privacy $99; sum 845; privacy-first extraction order binding) · **credits joins
AI-Production → recompute $739** (sum 994) · **Everything $2,059 full-catalog content
incl. ui-pro** (only private `brand` excluded; 0.75 × Σ personas 2,746) · renewal cents:
AI $289 · Local-first $249 · Everything $819 · sync $79 · inference $99 · privacy $39 ·
**Paddle = big-bang sandbox rebuild** (operator override of additive-first; editions
retired in the same sweep; production recreation stays operator-gated at the commerce
flip). Below-sum ✓ on all six bundles at lock.

**ADR numbering note (2026-07-06):** Kickoff E's branch (`feat/independent-build-wave`)
holds 0253–0256 (incl. its own 0255 `updatesWindows` claims rewrite); D files from 0257 up
by cross-session agreement. The dual-branch 0251/0252 collision RESOLVED at the merge per
ADR-0088 (second merger renumbers): D's pair became **0259/0260**; 0261 = the Greptile-retirement
ADR (formalizing the 2026-07-06 vendor-drop lock).

**Still OPEN after Stage 3**: production Paddle catalog recreation (operator act at the
commerce flip; sandbox never ports) · optional Cookiy WTP validation (survey 374111 live;
~$20 recruitment needs live operator approval — now also covers the three local-ai carve
bands) · kit stage 2 (runtime theme API) then wave-1 `./ui` frontends (sequenced after the
catalog-rework waves per ADR-0250 G2b/G2d) · grandfathering policy (operator-owned,
ADR-0106 lineage)

A post-merge scheduling picker (2026-07-05, no ADR — Kickoffs A+B merged as PRs #126/#127) split
the remaining pool: **Kickoff D** = the catalog program (ui-pro SPEC → pricing pass →
catalog-rework SPEC → build) · **Kickoff E** = the catalog-independent build wave (checkout-flip
mechanics built NOW per the operator lock · agent-dev inspector · build-state rework · the
AI-citation + docs-conversion measurement loops, both un-parked). Parallel worktrees; D owns all
price numbers; both kickoffs research-first-then-deep-forks by design.
(a full pricing-revalidation research pass is operator-commissioned: re-validate/adjust all
displayed prices, price the 3 compliance SKUs and the per-package catalog, and fold in the
gate/split pricing of the OSS redraw). Brainstorm evidence lands in
`outputs/archive/research/catalog-rework-brainstorm-2026-07.md`.

## 2026-07-06 Kickoff-E picker rounds (independent-build-wave session) — 4 lock ADRs

Kickoff E ran research-first (7-agent fan-out over the W1 seams, W3 doc, W4 measurement pair),
then three picker rounds. W2 (agent-dev inspector) needed no round — ADR-0243 had pre-resolved
both forks; it was built lock-and-go in the same session. Research briefs:
`outputs/research/kickoff-e-research-2026-07/`.

| Fork                              | Decision                                                                                                                                                                                                            | ADR          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **W1 — window enforcement point** | Claim + edge filter: signed `updatesUntil` on the license claims; Worker + npm surface filter per-version `publishedAt`, recompute `dist-tags.latest`; `/issue` re-mints on window change; absent claim = unbounded | **ADR-0251** |
| **W1 — renewal SKU shape**        | ONE "Updates Renewal" Paddle product, per-SKU prices (sandbox, placeholder cents — Kickoff D owns numbers); fail-closed `RENEWAL_BOOK`; renewal extends `updates_expires_at` per `(account, entitlement)`           | **ADR-0251** |
| **W1 — EULA/checkout copy**       | Mixed posture over the 7 contradicting spots: fuller on the two JSON-LD FAQ surfaces, minimal surgical elsewhere; cart badge → "no forced renewal"; no percentage in copy                                           | **ADR-0251** |
| **W1 — FIFO ledger shape**        | Append-only `grant_consumption` join table + `expires_at` on `credit_event`; sandbox prod rows backfilled `created_at + 12mo`                                                                                       | **ADR-0252** |
| **W1 — FIFO tie-break**           | `created_at ASC, expires_at ASC, id ASC` (sooner-expiring burns first on the real multi-item-cart tie)                                                                                                              | **ADR-0252** |
| **W1 — expiry notification**      | Dashboard badge AND T-30d email, both now (operator pick above the badge-only rec — first transactional email template + jobs sweep + notified marker)                                                              | **ADR-0252** |
| **W3 — build-state rework shape** | Generated per-package counts via a 7th sot check (`checkPackageCountParity`, `--update` suggestions) + banner squash; prose stays hand-written                                                                      | **ADR-0253** |
| **W4 — citation tracker**         | Pay-as-you-go only (operator lock, custom answer): OpenRouter probe loop, monthly GHA cron, ~$1.20/run; DataForSEO-class PAYG evaluated for the AI-Overviews leg; NO subscription tracker pre-traffic               | **ADR-0254** |
| **W4 — citation results sink**    | Both: `docs/gtm/aeo-citation-tracking.md` snapshots (canonical 18-question list included, ships as-is) + `aeo_citation_probe` PostHog events                                                                        | **ADR-0254** |
| **W4 — docs funnel**              | Split (option C), build now: Plausible cookieless top-of-funnel goals/events + PostHog `account_created` with `?ref=` stitching; PostHog JS stays dashboard-only (F8 intact, option B rejected)                     | **ADR-0254** |

### SHIP-audit picker (same session, post-build)

The fable security audit + opus code review of the merged wave surfaced two fork-class
findings (everything mechanical was fixed inline, operator rule: no deferrals).

| Fork                               | Decision                                                                                                                                                                                                        | ADR          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **Window-claim scope (SEC-1)**     | Per-entitlement windows NOW (operator pick above the accept-and-record rec): `updatesWindows` map keyed by purchased id; per-pair issuer compute; most-favorable-window edge filter; supersedes 0251-D1 in part | **ADR-0255** |
| **Expiry-sweep scheduler (CR-S1)** | pg-boss inside `services/license`, inert until `CREDIT_EXPIRY_SCHEDULE` (cron env) is armed; daily account tick enqueues sweep + notice with singletonKey dedup — the first in-repo recurring-task precedent    | **ADR-0256** |

### Kickoff D ↔ E reconciliation (2026-07-06, binding boundary)

- **Enforcement split:** E = per-VERSION window filter (`publishedAt <= updatesWindows[id]`) in
  `registry/worker`, never touching `registry-schema`; D = per-MEMBER join-date filter
  (`entitledSince` vs bundle-member join dates, fail-soft skip) in
  `registry-schema/entitlements.ts`, never touching the worker's per-version check.
- **`entitledSince`** is specced by D as a sibling per-purchased-id claim record (absent key =
  grandfathered/unrestricted — the ADR-0255 posture); reserved by a comment at the claims schema.
- **Rename surfaces are D's:** the bundle-vocabulary constant + resolve-time alias map (single
  resolve point in `expandEntitlements`), normalizing the RENEWAL_BOOK lookup through it, the
  cosmetic sandbox Paddle price names, and appending RENEWAL_BOOK rows for net-new SKUs with real
  cents. E does not re-key RENEWAL_BOOK.
- **ADR numbering:** E stops at 0256 (files nothing above it without pinging D); D files from 0257. The dual 0251/0252 collision renumbers at merge per ADR-0088 (second merger renumbers,
  including supersession links).

### Greptile retired (2026-07-06, operator lock, same session)

Greptile's Starter monthly review limit hit mid-PR-#128 and the operator dropped the vendor
outright — no plan upgrade, no replacement external reviewer. `greptile-gate.yml` + `.greptile/`
deleted from the tree (git history keeps them); the review gate is the in-session SHIP audit lane
(gw-code-reviewer + gw-security-auditor + adversarial verify — CLAUDE.md §PR review gate
rewritten). Amends the ADR-0177 Greptile-PR-gate lock; the formal ADR is **deferred to the next
free number** (E's ceiling is frozen at 0256 per the D↔E numbering agreement above — D files it or
it lands post-merge). Operator follow-ups: uninstall the Greptile GitHub app from `caisson-sh`;
drop `GREPTILE_API_KEY` at the ADR-0226 credential sweep.

## 2026-07-06 Kickoff-F picker rounds (dx-demos-compat session) — 7 lock ADRs

Kickoff F ran research-first (6-workstream fan-out, every brief adversarially verified; two
stub returns caught by the verifiers and re-dispatched), then four picker rounds. Verification
reshaped the W5 rank table before the round: email SMTP/SES/Postmark + pg-boss were found
ALREADY SHIPPED (ADR-0170/0173 — adapter-expansion.md was stale), and the R2 "trivial
S3-compat reuse" premise was found factually wrong (R2 lacks S3 Object Lock).

**Numbering note:** F files **0262–0268**. 0257–0261 were observed already claimed by
Kickoff D in flight on `feat/catalog-program` (0257/0258 catalog-rework, 0261 Greptile
retirement); collisions at merge renumber per ADR-0088 (second merger renumbers).

| Fork                              | Decision                                                                                                                                                                               | ADR          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **W1 — flags↔prompts precedence** | Per-field gap-fill: flags win, absent fields prompt, stdin-isTTY gate, zero prompt code on the flag path; NEW cli.test.ts pins the (previously untested) argv contract                 | **ADR-0262** |
| **W1 — interactive shape**        | Per-module toggles over the registry allowlist, version = entry.latest; NO edition concept in the wizard (operator pick above the edition-preset rec)                                  | **ADR-0262** |
| **W1 — free-sample placement**    | Equal-weight menu choice, never pre-selected; --sample flag path untouched                                                                                                             | **ADR-0262** |
| **W2 — render mode**              | Static pre-rendered h264 mp4 in apps/site/public via plain `<video>`; renderer never runs in the deployed Next process; @remotion/player rejected                                      | **ADR-0263** |
| **W2 — pilot scope + module**     | One audit-worm pilot (append→tamper→verify story) before any fan-out to the other 18 slots                                                                                             | **ADR-0263** |
| **W2 — render-source location**   | apps/site/remotion/ (Remotion's own Next pattern), excluded from the Next build                                                                                                        | **ADR-0263** |
| **W2 — stackCompat section kind** | BUNDLED into this wave (operator pick above the separate-follow-up rec), sequenced after the W4 matrix corrections                                                                     | **ADR-0263** |
| **W3 — activation fidelity**      | Extend the IR NOW (operator pick above warnings-only): activation/paths fields through the Zod-strict boundary, fixing the shipped Cursor degrade; warnings field ships too            | **ADR-0264** |
| **W3 — target set**               | Devin Desktop (.devin/rules/ + .windsurf/rules/ legacy — 2026-06-02 rebrand) + Copilot + Cline; JetBrains/AmazonQ deferred                                                             | **ADR-0264** |
| **W3 — AGENTS.md reframe**        | Rename-only via superseding ADR: Codex target → universal AGENTS.md base layer; no bespoke overlay files (RFC #185 unratified)                                                         | **ADR-0264** |
| **W4 — launch-gating posture**    | ENTERPRISE-READY SWEEP (operator pick above hybrid docs-first): every coded transport live-proven or explicitly waived per checklist row before launch; creds operator-owned           | **ADR-0265** |
| **W5 — ORM adapters**             | Drizzle bridge AND Prisma adapter (operator pick above Drizzle-only); amends ADR-0014 in part — Prisma for buyers, never for Caisson's own code                                        | **ADR-0266** |
| **W5 — storage disposition**      | BOTH drivers, correctly (operator custom answer): GCS Bucket Lock + R2 on Cloudflare bucket-locks, fail-closed when the bucket rule can't satisfy retainUntil; naive R2-as-S3 rejected | **ADR-0267** |
| **W5 — deploy-template targets**  | Railway + Fly + Vercel off one shared Dockerfile base (services/docs pattern); deployTarget optional in Selection; unselected = byte-identical                                         | **ADR-0268** |

### Recorded without new ADRs (same rounds)

- **W5 wave composition (multiselect):** Drizzle bridge + auth/billing-webhook framework
  quickstarts + deploy templates, GCP KMS driver, AI-lane named enums — all three recommended
  items taken; **Slack QA-path extraction NOT selected → deferred** (Tier 3, member-mgmt
  descoped whenever it returns).
- **GCP KMS driver:** pre-authorized by ADR-0171's own binding ("adding a further KMS provider
  needs no new ADR") — goes straight to `kms-gcp.ts` mirroring `kms-aws.ts`.
- **AI-lane named enums** (groq/mistral/together): additive provider-enum values riding the
  existing openai-compatible case (~15 LOC + docs recipes) under the ADR-0160 posture.
- **MCP-HTTP framework quickstart: DEFERRED to its own spec** — MCP TypeScript SDK v2 is a
  6-day-old beta with whole-package-split blast radius on the ADR-0161-locked transport file;
  the auth + billing-webhook quickstarts proceed (already Fetch-native).
- **Already-shipped discoveries:** email multi-driver (ADR-0170) and pg-boss JobQueue
  (ADR-0173) were still framed "planned" in adapter-expansion.md — rows flip to shipped in the
  ADR-0265 doc-correction pass; compatibility-matrix.md §1's Email/Jobs rows corrected the
  same way.

## 2026-07-06 Kickoff-D merge close-out (catalog program LIVE on main)

**PR #130 MERGED** — the full catalog program (waves W0–W7) landed after E (#128) and F (#129):
the six-bundle catalog (compliance $1,049 · ai-production $739 · local-first $629 · agentic-dev
$329 · provenance $399 · everything $2,059) is the sold reality in the Paddle SANDBOX, the four
edition products + the legacy $1,499 bundle are archived, all 22 modules sell à la carte, and the
renumber agreement realized exactly as recorded above: **D filed 0257–0261** (0259/0260 = the
renumbered Stage-1/2 drafts; **0261 = the Greptile-retirement ADR the E-session note deferred —
now FILED**), F's 0262–0268 stand, ceiling **0268**.

**SHIP-audit lane (per the retired-Greptile review posture):** gw-code-reviewer (opus) +
gw-security-auditor (fable) on the full branch diff — 10 findings, ALL fixed in-session before
the PR: 2 P1 entitlement-engine (ui-pro reserved-id carve-out; the token now signs PURCHASED ids,
restoring the Worker's purchased-id-keyed updates-window fold that shipped provably dead — the
renewal program's enforcement was fail-open at both edge surfaces), 3 P1 display prices
understating checkout (now SOT-interpolated, never hand-typed), plus members-gate bundle
coverage, the resolveGate fresh-set catch, the reserved-ids gate regex, and P3 truth fixes.
Deferrals recorded, not dropped: `entitledSince` gate wiring (outstanding-work §2) and the
verifier-first deploy-sequence constraint (deploy STATE standing note).

**Open set after the close-out** (supersedes the "Still OPEN after Stage 3" list above):
production Paddle catalog recreation (operator act at the commerce flip; sandbox never ports) ·
grandfathering policy (operator-owned) · optional Cookiy WTP validation · the ui-pro PACKAGE
build (its SKU sells today under the reserved-id fail-soft; unreserve at first publish) · kit
stage 2 + wave-1 `./ui` frontends (now UNBLOCKED — the catalog-rework waves they were sequenced
behind are done).

## 2026-07-06 hygiene-package-standards session (Session B of the parallel pair)

**ADR-0269 — Developer plan covers owned entitlements (LOCKED, executed same session; HARDENED
by the SHIP audit pre-merge):** the operator locked the direction ("the plan should actually
grant updates, not have its copy walked back") in the session kickoff; the shape landed as the
recommended subscription-sourced re-grant of the buyer's active `one_time` ids on each granting
invoice (the Compliance-Updates mirror made dynamic). The originally-recommended pair-level KEY
DROP was replaced pre-merge after the fable security audit found it unbounded in perpetual
offline-verified tokens (two P1s): covered pairs' `updatesWindows`/`entitledSince` now EXTEND to
a paid coverage horizon (`now() + one plan cadence`, stamped + monotonically extended per
granting invoice), mirrors carry `line_item_id='covered'` and are refund-reconciled on every
one_time revoke path. "New-edition access" DEFINED as new releases/members of owned bundles
while active — never new bundle ids, never unbounded. Filed above 0268; ADR-0088
renumber-at-merge applies if the parallel site session collides.

**Post-audit picker (2026-07-06, four operator locks):**

1. **S3/S4 residuals → accept + Linear follow-up (LOCKED):** the out-of-order
   invoice-after-cancel race and Paddle pause-without-cancel dunning stay bounded (≤ 1 paid
   period) rather than eliminated — no subscription-state tracking built. ONE Linear issue
   tracks the three residuals: verify the live Paddle dunning config cancels (not pauses) on
   final failure before launch; the pre-existing static-grant ordering race; a SUBSCRIPTION
   payment refund does not claw the period's grandfathered horizon. Recorded in ADR-0269 D6.
2. **Covered-period grandfathering (LOCKED):** a coverage horizon is a PAID fact and persists
   across the subscription revoke — the bound stops extending at cancel, never shrinks (fresh
   re-mints and saved stale tokens agree). Implemented in `subscriptionCoverageHorizons` (no
   status filter); a refunded pair can never keep a horizon (its one_time backing is revoked, so
   the pair leaves the claim maps entirely).
3. **No grace period on the horizon (LOCKED):** a late renewal payment briefly withholds
   gap-published versions, then self-heals retroactively when `invoice.paid` lands — fail-closed,
   zero tunables.
4. **`everything` composes silently without reserved `ui-pro` (LOCKED):** hosted generation
   skips the sold-unpublished phantom pin exactly as `expandEntitlements` does; ui-pro
   graduates automatically when first indexed. No buyer-facing note, no generation block.

**CAISSON-24 executed:** `@caisson/compliance` manifest flipped to `kind:"bundle"` at 104900 and
republished (34 ledger entries total: the 29-entry version-cut wave + the post-audit 5-bundle
republish at 0.2.1 truing every canonical bundle's member pins, index rebuilt); retired-alias
metas trued to alias-target prices ($739/$329, the `local-ai` convention) with PRICE_AUTHORITY
rows. Worker + license-service redeploy STAGED (operator act — `docs/deploy/STATE.md` top block).

## 2026-07-06 merge-day close-out (Session A — site-design-3 build + both merges)

**PR #131 MERGED (`15ff1f32`) then PR #132 MERGED (`b8fe8731`)** — session A of the parallel
pair drove the merge train: B's hygiene branch squash-merged first, `main` merged into
`feat/site-design-3` (one import conflict), a `changeset-prose-adr` CI fix, gates + CI green,
squash-merge, both feature branches + B's worktree deleted. `main` single-branch. No ADR-0088
renumber needed — site-design-3 filed **no ADRs** (it implements the ADR-0257/0258 display
truth, ADR-0260 §5 renewal pricing, and the ADR-0251 lifecycle-notification lineage); ceiling
stays **0269**. Linear CAISSON-24 → Done.

**Site-design-3 SHIP audit (no new forks):** gw-code-reviewer (opus) + gw-security-auditor
(fable) on the branch diff — all confirmed findings fixed pre-merge: fable F1 (the 40%-X9
renewal while-loop never terminated below the first X9 → closed form, `null` below 9) and F2
(the renewal read-back looked up the raw-keyed `computeUpdatesWindows` map by canonical id, so
legacy `ai-kit`/`bundle` grants silently dropped from renewal emails → alias-group fold); opus
P1 (receipts printed the retired install command → `bunx @caisson-sh/cli@latest`) + 5 P2s
(mixed-cart double-total split, module-modal dead branch, UTC date hydration, cart-close on
add, stale W7 comment). One informational stays an operator call (open set below).

**Open set after the merge day** (supersedes the Kickoff-D close-out list): production Paddle
catalog recreation (operator act at the commerce flip) · grandfathering policy (operator-owned)
· optional Cookiy WTP validation · the ui-pro PACKAGE build (SKU sells under the reserved-id
fail-soft) · kit stage 2 + wave-1 `./ui` frontends (unblocked) · **(new, minor)** recurring
subscription `invoice.paid` cycles reuse the "Purchase confirmed" email wording — fable
informational; dedicated cycle-receipt wording is an operator call · marketing signature slot
stays parked.

## 2026-07-06 research-kickoff picker (Session A, post-merge — pre-launch research program armed)

Five outcomes from the post-merge picker + the operator's research directive:

1. **Grandfathering fork → RESOLVED + EXECUTED as the edition-trace purge (Linear CAISSON-26, ADR-0270).**
   Instead of grandfathering machinery for pre-existing edition buyers, the operator locked: **delete all
   trace of the editions + stale legacy code now** — zero real buyers exist, so churn is free, and
   this cleanup class is only free before the launch sequence. Supersedes-in-part the alias-forever
   posture (ADR-0257/0258). **DONE (ADR-0270, license-seam-wave):** the purchase-alias spine narrowed to
   empty, the edition→bundle INDEX relation decoupled (member sets byte-identical), the pricebook/renewal
   mint sites repointed to canonical bundle ids, and the idempotent grant-drain script shipped
   (`services/license/scripts/drain-legacy-edition-grants.sql`, run manually at DEPLOY behind the §4
   prove-empty gate). The spec separated edition aliases (removable) from module-rename/carve aliases
   (load-bearing) — fable-audit class.
2. **Subscription-cycle receipt wording → LOCKED: dedicated wording** (Linear CAISSON-27, the
   fable informational from the #132 audit). Small build, not deploy-blocking.
3. **Cookiy WTP → RUN.** Operator commits a **$100 pre-launch research budget** (balance today
   $1.20). Survey 374111 (Compliance-bundle Van Westendorp) needs one patch before recruitment:
   its updates-subscription question still says "$1,499/year" — stale vs the ADR-0260 renewal
   model (Developer plan + 40%-of-list renewal SKUs).
4. **Positioning re-examination OPENED (operator, DO NOT auto-decide):** compliance stays the hero
   WEDGE, but the framing of the larger scope — the full production codebase/feature starter —
   is under research and may pivot. Prior positioning ADRs (ADR-0040 lineage + site-posture locks)
   are **challengeable inputs** for this research program only; nothing is re-locked until the
   operator picks from the research synthesis.
5. **Competitor/UI reference program armed:** operator screenshots (getRoman.ai compliance-led
   marketing ×4, "Analyse" MCP-native feature cards, TurboStarter bento/free-tools/demo-dropdown
   ×3) seed a UI-reference extraction leg; a TurboStarter deep-dive + gap map is commissioned.
   The 7-leg live-web research fanout (TurboStarter · UI reference · positioning · pricing market
   · Paddle prod truth · AEO citation · launch channels) ran this session; synthesis lands in
   `outputs/research/`.

## 2026-07-07 research-synthesis picker (four operator locks off the 17-leg fanout)

Synthesis: `outputs/research/prelaunch-fanout-2026-07/SYNTHESIS.md` (decision menu D1–D8).
Operator locks:

1. **D1 Positioning → DUAL-DOOR HERO (LOCKED).** Compliance stays the hero wedge; `/` gets a
   first-scroll split — "Building something regulated?" → Compliance vs "Building for
   production?" → the five bundles/Everything. Compliance-specific acquisition repoints at the
   existing `/compliance` route. Supersedes the compliance-only hero execution (the ADR-0040
   two-layer frame stays; this is its correct rendering). The Cookiy frame-test (survey 287453)
   data still lands and informs the door copy, not the direction. → Linear CAISSON-28.
2. **D4 UI wave → TOP-3 FIRST (LOCKED):** real file-tree + code bento · architecture-isolation +
   data-lifecycle diagram pair · bundle-builder calculator. The rest of the Tier-1 catalog +
   copy sweeps queue behind them. Rides the same site kickoff as the dual-door build.
3. **D5/D6 GTM → AEO content program + affiliate program ARMED (LOCKED);** newsletter budget and
   the full 90-day sequence NOT yet armed (revisit at launch). AEO scope: 15–20 comparison pages,
   Product/FAQPage schema on bundle pages, crawlability audit, directory listings, 3 niche
   explainers. Affiliate: 30%→50% tiers, Paddle-side config + terms page. → CAISSON-29/30.
4. **D7 Paddle prep → FULL PREP (LOCKED, execution operator-gated):** pre-fix the four documented
   rejection causes on the site (unconditional refund copy · entity-name match · verbatim MoR
   sentence · support-as-software framing), build the scripted catalog-recreation tool from the
   sandbox catalog, update the launch runbook with Retain=CANCEL + the past_due-grace/
   canceled-revoke webhook mapping. Verification submission stays the operator's act. → CAISSON-31.

D2/D3 (seat allowance at $629/$739 · compliance/everything price level) deliberately HELD for the
Cookiy WTP data. D8 (/updates roadmap block vs V1-live posture) stays an open fork — not adopted.

## 2026-07-07 resume picker (second sitting — deploy + wave-arm session)

Four outcomes:

1. **D8 → DEFERRED TO POST-LAUNCH (operator).** The /updates roadmap block stays un-adopted and
   the fork stays OPEN with a named trigger: revisit once real buyers exist and a roadmap carries
   external evidence value. FULL V1-live posture (ADR-0237 rider 2) unchanged meanwhile.
2. **D2/D3 → HOLD RE-AFFIRMED** for the Cookiy WTP data (the paid run fires this session);
   displayed prices stay $1,049/$2,059 et al. until the post-WTP round.
3. **Cookiy research → FUNDED + GO.** The $100 top-up landed 2026-07-06 (Stripe checkout, +$2
   welcome credit); operator supplied a fresh API key in-session (the prior key bound the MCP to
   an unfunded account — rotate the pasted key after the research program wraps). Full paid
   sequence armed: synthetics ($0) → frame test N=60 (287453) → VW v2 N=60 (211341) → 3
   qualitative interviews.
4. **Wave scope → ALL FOUR tracks armed** for this session's parallel/waved execution: site
   cluster (CAISSON-28 dual-door + top-3 patterns · CAISSON-30 affiliate terms · CAISSON-31
   Paddle site fixes + catalog tool + runbook delta) · AEO program (CAISSON-29) · license-seam
   cluster (CAISSON-26 purge · CAISSON-27 receipt wording · renewal-refund un-extend ·
   entitledSince gate wiring) · ui-pro build wave (ADR-0259). The staged #131/#132 deploy block
   EXECUTED first this session (docs/deploy/STATE.md 2026-07-07 entry), so site-design-4 builds
   against a current production baseline.

## 2026-07-07 build-wave landed (second sitting — all four tracks merged)

The armed four-track wave EXECUTED as parallel worktree workflows (24 agents, adversarial
review chains) and merged serially through the in-session SHIP-audit lane: **PR #133**
site-design-4 (D1 dual-door hero + D4 honest-artifact patterns + `/affiliates` + the CAISSON-31
Paddle-readiness fixes — the seller entity reads **Caisson Software LLC** per the legal SOT after
an in-branch revert of a stale-instruction rename) · **PR #134** AEO program (CAISSON-29 complete:
crawlability audit, AI-crawler robots group, glossary 32→35, `/compare` hub + 20 pages) ·
**PR #135** ui-pro (ADR-0259 built; NOT published) · **PR #136** license-seam (edition-trace purge
**ADR-0270**, subscription-cycle receipt, renewal-refund un-extend + migration 0017, entitledSince
at both gates). Linear CAISSON-26..31 all Done. Nothing is DEPLOYED yet — the ordered redeploy is
an open operator gate (`docs/deploy/STATE.md` PENDING entry).

New OPEN forks surfaced by the wave (operator-owned, not decided):

- **Bundle-only index republish** — retire the three edition meta-packages from the SERVED
  registry index (a superseding ledger/index append, never an edit — ADR-0006). Separate from the
  ADR-0270 purchase-alias purge, which deliberately left them served. Until taken,
  `legacyEditionNamesFor`/`fullCatalogMembers` and the CLI pass-2 fallback stay live by design.
- **ui-pro first-publish timing** — publishing takes ONE atomic 3-part change (registry index
  entry + drop `ui-pro` from `RESERVED_MODULE_ENTITLEMENT_IDS` + flip the everything-members pin
  off `0.0.0`); landing partial or out of order under-entitles paying buyers or over-widens
  everything. Also gated on 3 confirmed pre-publish hardening findings (tracker §2 row).
- **Cookiy key rotation timing** — the working API key was pasted into a session transcript;
  rotate after the quant legs (776545 frame / 445432 VW) finish filling, or now if research is
  deprioritized. Qual leg is complete (5/5), combined report saved.

Deploy-order note for the redeploy gate: Worker (verifier) FIRST per the standing claims-schema
constraint, license second (its preDeployCommand applies migration 0017 — a refund/renewal webhook
against the old DB shape rolls back on the missing `renewal_extension` relation), site last.

## 2026-07-07 third sitting — deploy executed, two picker rounds, showcase+marketplace wave armed

The PENDING redeploy EXECUTED (Worker 4c6c61fa → ADR-0270 drain proven empty → license
migration-0017/v17 → site; docs/deploy/STATE.md EXECUTED entry). Hygiene list executed:
merged remote branches pruned, apps/studio leftover cleared, standards-gate turbo cache
soundness fix (PR #137 merged — the unsound-cache class that hid the ui-pro version-gap
latent red).

**Picker round 1 (open questions) — LOCKED:**

- **Bundle-only index republish → LOCKED "now"** (ADR-0271): delist the 3 edition
  meta-package entries at a dedicated republish + Worker redeploy, not folded into a later
  rebuild. Ledger append-only; tarball bytes stay R2-retained, but a delisted id returns 401/404 (never 200)
  through the gated npm surface (`npm-routes.ts` resolves every GET against `index.json`
  membership) — "serve forever" means retained-in-R2, not reachable; doc-accuracy
  correction, P2 pack, 2026-07-07.
- **Paddle production catalog timing → after the D2/D3 quant picker.** The production
  ACCOUNT application proceeds independently; recreation is scripted and waits for the
  Cookiy quant fills (frame 19/60, VW 10/60 at lock time).
- **CAISSON-25 dunning verify → simulate in sandbox now.** One Paddle-sim
  transaction.payment_failed against the live sandbox webhook this session.

**Picker round 2 (build scope) — LOCKED, SPEC `outputs/archive/specs/uipro-showcase-marketplace/SPEC.md`:**

- **Marketplace pop-out**: full purchase card for BOTH modules and bundles on the
  marketplace page (media + definition + what-ships + artifact + stack-compat + FAQ +
  add-to-cart); standalone pages remain as SEO/AEO spokes; bundle pages extract into a
  shared `lib/bundle-pages.ts` record. Operator rider: the nav bundles dropdown becomes a
  two-column layout (full bundle list | marketplace pages).
- **Marketplace extras — all four**: cart-aware bundle upsell · module-grid search +
  filters · live ui-pro demos in the pop-out · compare tray.
- **ui-pro expansion — all four**: charts pack · command palette · DiffViewer · kanban
  board; plus the 3 hardening fixes. The **first-publish trigger fires when this wave
  merges** (still its own atomic 3-part act: index entry + RESERVED drop +
  everything-members pin).

**Cookiy key rotation** stays trigger-parked (after quant fills; monitor armed).

## 2026-07-07 fourth sitting — wave merged, deep analysis delivered, research-response picker (ADR-0272–0278)

**Merged this sitting:** PR #139 (ui-pro wave: 4 new components + 3 hardening fixes + `/ui`
gallery; review P1+5 P2s fixed pre-merge) · PR #140 (two cache-masked main test reds:
audit-harness container-root coverage + the mcp-server ADR-0270 stale pin; root turbo `test`
now `dependsOn ^build` — 179/179 cold-sweep proof) · PR #141 (marketplace purchase pop-outs +
bundle record + two-column nav + cart upsell + search + compare tray; both audits PASS,
3 P2s fixed + rebase onto post-U main). ADR-0271 delist SHIPPED same sitting: PR #138 merged,
Worker republished at the 44-entry index (version `aa27cb94`), anon base floor 15 unchanged.

**Cookiy deep analysis delivered** (`outputs/research/prelaunch-fanout-2026-07/cookiy-deep-analysis-2026-07-07.md`):
all 45 raw transcripts re-analyzed (45 extractions → 4 lenses → accuracy critic). Headline:
the vendor report's themes are synthetic-derived (4/5 humans never reached the pitch);
proof-artifact SURFACING is the top action; social proof (~31/40) is the top pre-launch risk;
Theme 2's maturity axis is fabricated — do not use in positioning.

**Research-response picker round 1 (site/GTM) — LOCKED:**

- **Site surfaces — all four** (ADR-0272): evidence-pack page · stack-fit adapter matrix ·
  trial-path emphasis · founder-transparency block.
- **Pricing terms — full rework now** (ADR-0272 §5): post-12-months answer on the pricing
  page, renewal = security-patch continuity, support-responsiveness line,
  licensing/redistribution clarity at checkout.
- **Social proof → design-partner program** (ADR-0273): first-N reference deal, terms
  prepped now (numbers operator-owned), quiet application surface rides the site wave,
  launches at the production flip.
- **Next qual → restructured real-ICP round AFTER quant fills** (trigger-parked): fix the
  guide (pitch+price by mid-interview, ICP screener tightened), needs Cookiy balance top-up.

**Research-response picker round 2 (product/architecture; operator-opened — "prelaunch, no
repercussions, launch gated on LLC+EIN+Paddle account") — LOCKED:**

- **Evaluation access — BOTH** (ADR-0274): generator demo mode + time-boxed eval licenses,
  with the operator's binding anti-exfiltration rider (verified work email/domain, $0-auth
  card, operator review queue, per-eval source watermarking, fail-closed expiry).
- **Evidence pack — CI-generated artifact** (ADR-0275): per-bundle threat model + OSCAL
  crosswalk + coverage + SBOM + attestation; pre-purchase download AND in the tarball;
  release-gating (an incomplete pack fails CI loud).
- **Continuity — EULA clause** (ADR-0276): perpetual offline verification + source retention
  - self-maintenance conversion if patches stop N months; the auto-open-source dead-man was
    considered and DECLINED.
- **Product tail — all three** (ADR-0277 crosswalks · ADR-0278 support SKU · a spike):
  SOC 2/PCI-DSS/GDPR crosswalk exports (FedRAMP deferred) · priority-support subscription SKU
  (frame locked, price/SLA operator-owned) · MySQL-compat scoping SPIKE (decision doc, not
  code).

## 2026-07-07 fifth sitting — parallelize + follow-up research picker (ADR-0279)

Four sequencing/posture forks locked while the research-response builders run:

- **Comparison sweep → research memo only.** The competitor-comparison leg lands as a cited
  memo in `outputs/research/prelaunch-fanout-2026-07/followups/`; the operator reviews before
  any site content uses it. Comparison pages are a later, separately-audited decision.
- **Track K — plumb now, price-agnostic** (ADR-0278 execution): SKU/checkout/entitlement
  plumbing built with the price unset in config, fail-closed (not purchasable until the
  operator sets price + SLA). The support-tier comparables memo informs that call.
- **Track E2 — design-memo picker first** (ADR-0274 execution): the eval-verification
  research produces 2-3 concrete verification-flow designs; the operator picks one BEFORE the
  fable-lane build starts. RESOLVED same sitting: **hybrid scoring locked (ADR-0280,
  refines + supersedes-in-part 0274)** — free pre-gate (MX/domain-age/disposable-list), risk
  score with auto-reject/auto-approve/borderline-to-review-queue, card leg = Paddle free-trial
  card-on-file (no $0-auth primitive exists at Paddle), card-fingerprint reuse alerts,
  thresholds as config. E2 still builds LAST in the wave.
- **Crosswalk claim posture — mixed by proof level** (**ADR-0279**, refines 0277): assertive
  "implements control X as documented" ONLY where a live test/CI artifact proves it (proof
  linkable per row); conservative "maps to / provides evidence toward" + a
  not-a-certification disclaimer everywhere else. The claim-language memo's floor binds:
  never "certified/compliant/satisfies" with Caisson as subject (AICPA/PCI SSC/EDPB
  ineligibility + the FTC accessiBe precedent).

**Follow-up research legs dispatched** (all land in
`outputs/research/prelaunch-fanout-2026-07/followups/`): competitor-comparison sweep ·
eval-verification flows (feeds the E2 design picker) · crosswalk claim language (LANDED —
disclaimer patterns + the five-column shared-responsibility format) · support-SKU +
design-partner comparables (feeds two operator-owned pricing calls). **Spike M LANDED**
(`followups/mysql-compat-spike-2026-07-07.md`): RLS is universal across the multi-tenant
surface — there is no cheap partial MySQL port; ship the honest fit-matrix rows (scenario a),
treat full parity (6-10 wk, weaker isolation posture) as a later ADR-gated decision. **Track
L EULA continuity draft LANDED** (`outputs/specs/research-response/eula-continuity-draft.md`,
variant A "confirmatory self-help" recommended; 12-month/90-day knobs + N stay
operator-owned) — awaiting operator text approval.

**Fifth sitting, second round (same day):**

- **MySQL — no lane, LOCKED as ADR-0281** (the Spike M fork; operator: "there's no port"):
  Postgres-required stated as a security property; the honest stack-fit rows are the buyer
  answer; revisiting is demand-driven only and must name the weaker isolation posture.
- **EULA continuity — variant A + N=12, LOCKED as ADR-0282** (the Track L fork):
  confirmatory self-help, 12-month general patch-cessation trigger, 90-day successor window;
  escrow (variant C) is the sanctioned later upgrade; final wording approval at the EULA
  release stays operator-owned.
- **Trial-path CTA — resolved by rationale (no code change):** the reviewer flagged
  `bunx @caisson-sh/cli@latest` as 404ing (npm publish behind the manual gate). Operator:
  leave the command — the site is CF-Access-gated pre-launch and the publish fires in the
  go-live sequence, so the command is true before anyone public sees it. The go-live runbook
  ordering (npm publish BEFORE the site gate drops) is now load-bearing for this claim.
- **Homepage "pre-launch" wording — soften** (keeps ADR-0272's transparency intent inside
  ADR-0237's V1-live posture): "We're early — no logo wall to point at yet."
- **PR #142 ui-pro first publish MERGED** (both audits PASS, six review P2s fixed pre-merge);
  **PR #143 Track E1 demo mode MERGED** (fable P1 dep-confusion fixed with the tokenless
  scope-mapping `.npmrc`; all review P2s folded). The 45-entry Worker republish is
  operator-gated (DEPLOY act) and pending.

**Fifth sitting, third round (same day — wave close-out + deferred-triage picker):**

- **The remaining three wave PRs MERGED:** #144 Track S site wave (stack-fit
  misclassification P1 + mobile-nav P1 fixed pre-merge) · #145 Track K support-SKU plumbing
  (price-agnostic fail-closed; docs-corpus F2 fixed) · #146 Track C regime crosswalks (CC7.2
  overclaim corrected to maps-to pre-merge). Research-response wave: all five PRs on `main`.
- **Deploy sequence EXECUTED** (operator: "approved on the full deploy sequence of the new
  code once clean state"): registry Worker republished at the 45-entry index (version
  `51be4302`, anon floor verified 15 — ui-pro absent) + license/site/docs/support-bot
  redeployed from `main` @ `09ed1c89`, all probes green. Pre-launch gates stay ON. Evidence:
  `docs/deploy/STATE.md` top entry.
- **Deferred/backlog triage picker (operator-locked):** fix packs = BOTH (the ADR-0271
  registry-delist P2 pack AND the comp-grant allowlist — the fable F1 resolver-bricking
  follow-up); build-window scope = ALL FOUR (Track V evidence-pack + Track E2 verified-eval
  AND kit stage 2 (ADR-0250 G2b) AND per-package frontends wave 1 (G2c/G2d) AND the site
  Tier-1 catalog/copy remainder); **version cut = DEFERRED to the next release wave** (the
  #142 changeset skew self-reconciles at that cut). Six builders dispatched in parallel
  worktrees; Track E2 sequenced AFTER Track V merges (fable on the seam).

**Sixth sitting (same day — admin incident + reposition picker):**

- **admin.caisson.sh 502 ROOT-CAUSED + FIXED LIVE:** the `HOSTNAME=0.0.0.0` Railway
  variable had been lost — Next standalone bound to the container hostname, Railway's
  proxy got refused, and the CF-Access 302 masked the origin failure from unauthenticated
  probes. Variable restored + admin redeployed (log now shows `Network: http://0.0.0.0:8080`);
  the durable fix (ENV in `apps/admin/Dockerfile` + `CAISSON_REGISTRY_INDEX_PATH`) rides
  the comp-grant PR.
- **Admin auth reposition — LOCKED as ADR-0283** (operator: GitHub sign-in, gridwork-dev):
  in-app GitHub OAuth via better-auth replaces CF-Access on `admin.caisson.sh`; allowlist
  pins the gridwork-dev GitHub NUMERIC user id; fail-closed middleware; flip order is
  code-live-first, gate-drop-second. `security`/`auth` tags → fable at SHIP.
- **Unified catalog + email consolidation — LOCKED as ADR-0284:** one shared component-demo
  registry feeding both the site `/ui` page and a FULL admin catalog (34 base + 11 pro
  components + all email templates with sample-data previews and send-test); the two
  plain-HTML growth emails migrate into `packages/email`; aggressive graduation of site
  compositions into ui-pro REJECTED this wave. Builds queue behind the current merge wave
  (they read kit stage-2 + the merged admin tree).

**Seventh sitting (same day — triage-wave close-out + screenshot-recon picker):**

- **The six triage-window builds all MERGED:** #147 registry-delist P2 pack · #148 Track V
  evidence-pack CI artifact (ADR-0275) · #149 kit stage-2 runtime theming (three-prong
  cascade P1 fixed pre-merge) · #150 site Tier-1 remainder (credits-as-free P1 fixed) ·
  #151 comp-grant allowlist + the durable admin HOSTNAME/index-path Dockerfile fixes ·
  #152 per-package frontends wave 1 (license-seam fail-closed W2 + transitive React walk
  fixed pre-merge; shipped-prose gate fix en route). All through the in-session SHIP audit
  lane (fable on the two license seams). `registry/index.json` unchanged — no Worker
  republish needed.
- **Deploys EXECUTED (operator-approved):** caisson-site, then caisson-license
  (`/health` `{"ok":true}`) and caisson-admin (`Network: http://0.0.0.0:8080` — the durable
  HOSTNAME fix is now the deployed image) from merged `main`. Pre-launch gates stay ON.
- **Marketplace one-surface rework — LOCKED as ADR-0285** (operator-annotated screenshots +
  recon round): `/marketplace` becomes ONE screen (unified bundle+module grid, one card-viewer
  dialog over both kinds, compare tray for both, Build-your-stack dissolved into a cart-aware
  "Your stack" rail); Plans stays separate; **periphery custom-lock:** `/compare`, `/stack-fit`,
  `/ui` stay standalone visible routes whose content single-sources into the marketplace cards;
  media = carousel + per-module manifest (diagram | image | interactive | video), initial
  authored diagram set, filetree redesign in the same pack.
- **Next wave ARMED — all four tracks** (operator multi-select), parallel worktrees, audits +
  gates on all: site wave (ADR-0285 + annotation fixes) · admin GitHub OAuth (ADR-0283) ·
  unified catalog + emails (ADR-0284, kit stage 3 folded) · Track E2 verified eval licenses
  (ADR-0274/0280, fable at SHIP) + tails (CAISSON-39/42).

**Eighth sitting (same day — Cookiy key truth + intel/catalog research picker):**

- **Cookiy false alarm reversed:** the "quant legs never launched" finding was a
  wrong-account-key artifact (stale session-pasted key fails SILENTLY with empty-looking
  states). Verified with the fresh account key: frame test 776545 recruit active 20/60,
  Van Westendorp 445432 active 14/60, balance $8.25 — both filling. Fresh key set as the sole
  `COOKIY_API_KEY`, old keys scrubbed from env backups, CAISSON-36 canceled.
- **F-1 index-parity probe** folded into the running E2 builder (license `/health` gains
  `indexDigest`, `registry/scripts/index-parity-probe.ts`; admin leg queued behind the admin
  merge queue) — CAISSON-37.
- **Admin intelligence layer — LOCKED as ADR-0286** (operator override of the memo's lean
  default): standing daemon in ONE local container on gw-ms-a2 + dormant wiring + error triage
  - an admin intel page, findings pushed to the admin Postgres and surfaced on
    admin.caisson.sh; frameworks = all four + monthly SOC2; scheduling prefers Claude Code
    Routines/cloud agents, else the local container. Research memo:
    `outputs/archive/research/admin-intel-catalog-roadmap-memo-2026-07-07.md`.
- **Catalog wave-1 — LOCKED as ADR-0287:** BOTH in parallel — the S-effort driver batch
  (analytics port · Slack ChatPlatform · Clerk · BullMQ) and the Next.js starter template.
- OAuth (ADR-0283) build returned; fable + opus audits running on the diff before its PR.

## 2026-07-07 ninth sitting — seven-PR wave merged + deployed, admin OAuth live, deferred picker (ADR-0288–0289)

The eighth-sitting armed tracks all landed as a **seven-PR wave, merged serially green+audited**
(in-session SHIP audit lane: opus review + fable on money/license/auth seams, findings fixed
pre-merge):

- **#153** catalog + emails (ADR-0284) · **#154** marketplace one-surface (ADR-0285) · **#155**
  admin GitHub OAuth (ADR-0283) · **#156** E2 eval licenses (ADR-0274/0280) · **#157** Next.js
  starter template (ADR-0287) · **#158** admin intel daemon (ADR-0286) · **#159** catalog driver
  batch (ADR-0287).
- Audit catches worth recording: E2 fable FAIL→fixed (anonymous eval token foreclosed the binding
  ADR-0274 anti-exfiltration rider → added a signed `eval` claim discriminator; scope ceiling;
  registrable-domain uniqueness) then fable **re-verified PASS**; Clerk fable FAIL→fixed
  (org-missing-role defaulted to `owner` — fail-open escalation → defaults to `seat`); intel opus×2
  - fable (scheduler overlap guard, runWatcher never-throws, empty-200 baseline-wipe, least-priv
    role artifact); a new-oss-package **ledger/index gate** (analytics needed a real published entry
    via `appendLedger` + `build-index`, not RESERVED/private).

**DEPLOY executed (operator-approved):** `caisson-site` (marketplace+emails), `caisson-license`
(E2 `/health` indexDigest, live `42817dcc9a2e`/45 entries), and `caisson-admin` all redeployed
from `main`. **Admin OAuth flip completed end-to-end:** GitHub OAuth app created · dedicated
`admin_auth` Postgres database (isolated from commerce — better-auth's own tables) · six `ADMIN_*`
vars set · migration run (see CAISSON-48: the `preDeployCommand` is a no-op on the Next standalone
image, migration run manually) · sign-in verified · **CF-Access `admin_gate` destroyed via
`terraform apply` (2 destroyed, `site_gate` untouched)** — admin.caisson.sh now gated solely by the
GitHub-numeric-id allowlist. No Worker republish (index unchanged by the wave; the driver batch's
analytics entry is manifest-only, npm tarball stays behind `confirm=publish`).

**Ninth-sitting picker locks (over the deferred-item round of the research memo):**

- **D2/D3 bundle price levels ($629/$739 seat allowance · compliance/everything point) → HOLD
  RE-AFFIRMED** for the Cookiy WTP quant close (surveys funded + filling; no ADR — a deferral).
- **Priority-support SKU → LOCKED as ADR-0288:** **$999/yr · next-business-day** first response
  (between Developer $499 and Compliance-Updates $1,499; ~2× dev anchor); forward grandfather.
  Executes ADR-0278; unblocks CAISSON-42 (Paddle SANDBOX 99900, prod price at the catalog-recreation act).
- **Eval-delivery leg → LOCKED as ADR-0289:** build the full leg **next** (watermark → card
  callback → admin review queue), with the **binding watermark-before-issuance order** (issuance
  stays 409-dark until per-eval tarball watermarking is live, keyed on the E2 `eval` claim).
  Refines ADR-0274/0280; sequenced after the admin merge queue drains.
- **Deferred bucket → ARMED into the next wave:** the hardening trio (ADR-0269 residuals ·
  clawback read-then-claw concurrency guard · shared migration-chain package for a real admin
  PGlite parity gate) · ops nits (lost-HOSTNAME root-cause · site-design-2 stash) · the real
  support-escalation inbound (draft answer + feed back through docs-RAG). Held: everything else in Triage.

**Still open (unchanged):** D2/D3 pricing (quant-gated) · grandfathering policy (operator-owned) ·
the eval-delivery build (ADR-0289, next wave) · the intel container box-deploy (operator-gated,
this session's final act) · CAISSON-48 admin migration fix · the admin intel page (queued behind
the admin merge queue).

## 2026-07-07 tenth sitting — pre-launch build drive + design picker (ADR-0290–0291)

Continuation session: gridwork-core PR #398 (intel security-surfaces ledger rows) merged; the
ninth-sitting wave reconciled in Linear (CAISSON-32/33/34/46/47 → Done; 44/45 shipped but classifier
held the close — operator to close). PR #161 (`gw-frontend-designer` visual fixes) merged after the
in-session SHIP review returned PASS + one P3 fix (hero bundle count derived from `BUNDLE_PRICES`).

**No-fork pre-launch hardening → dispatched as four background worktree builders** (not yet merged):
CAISSON-43 bot content-gap fix (bundle-composition generated doc + post-purchase CLI/AI-agent
quickstart, so the RAG corpus answers the two most common buyer questions) · CAISSON-20+25 billing
correctness (clawback read-then-claw concurrency guard + ADR-0269 residuals) · CAISSON-37+38+41
deploy-reliability (registry index parity probe · lost-HOSTNAME root-cause · site-design-2 stash) ·
CAISSON-42 support-SKU entitlement wire-up (executes ADR-0288).

**CAISSON-43 diagnosis (recorded):** the support bot behaved CORRECTLY — it retrieved the six
nearest docs, judged them insufficient (`INSUFFICIENT_CONTEXT`), and escalated instead of
hallucinating (fail-closed RAG). Two CONTENT gaps, not a bot bug: (1) bundle→module membership is
not in the corpus (lives in `apps/site/lib/bundle-pages.ts`; the pricing generator emits names+prices
only) · (2) no post-purchase CLI+AI-agent quickstart. The corpus (`services/docs`, ADR-0096) ingests
`apps/site/content/docs/**/*.mdx` + public `packages/*/README.md` + generated pricing docs — ADRs/specs
excluded. Fix in the CAISSON-43 builder.

**Tenth-sitting design picker locks** (over the two `gw-frontend-designer` plans; research → picker →
ADR → code):

- **Marketplace media standard → LOCKED as ADR-0290:** standardized static picture-slides —
  **live-component + real-artifact** content (new `component`/`code-artifact` slide kinds), **all 28
  re-standardized** onto one framed template, **no video** (audit-worm mp4 → static; Remotion pipeline
  reserved, unused by the launch set). Refines ADR-0285/0263.
- **UI interactive-primitive expansion → LOCKED as ADR-0291:** **split by complexity** — Tabs,
  Checkbox, Radio, Switch, Badge, Accordion in the open Apache-2.0 `@caisson/ui`; Tooltip, Popover,
  Menu in commercial `@caisson/ui-pro`. **All hand-rolled, zero-Radix** (recipe purity), then
  **repoint** the hand-rolled inline controls; a11y regression enforced. Extends ADR-0099/0250.
  Theming contract + `/ui` showcase rebuild (CAISSON-35) are adjacent follow-ons, not bound here.
- **Media + UI builders → dispatched next** off these ADRs (two disjoint-scoped worktrees).

**Still open (unchanged):** D2/D3 pricing (quant-gated) · the operator-owed launch acts
(`docs/state/outstanding-work.md` §1 — Paddle account/catalog, credential rotations, CF-Access
`site_gate` flip, EULA continuity final text, design-partner numbers) · CAISSON-44/45 Linear close.

## 2026-07-07 eleventh sitting — merge drive + buyer-lifecycle audit + lifecycle picker (ADR-0292–0294)

**Merged this sitting:** PR #162 support-SKU wire-up (fable PASS + opus PASS-with-findings; the
converged precedence fix — NON_MODULE ids win over slug-colliding indexed packages — applied
pre-merge with a pinning test; registry-schema changeset bumped to minor; ADR-0288 graduation
riders documented in outstanding-work §1) · PR #163 deploy-reliability (env-sync CLEARED of the
HOSTNAME hypothesis, read-only contract now enforced at the `railway()` choke point by a runtime
verb allowlist after review WR-01; admin healthz registry-digest + parity-probe admin leg) ·
PR #164 billing clawback concurrency (both auditors independently found an ABBA deadlock between
the new coverage and claw advisory locks; fixed with the canonical order — `acquireAccountBillingLock`
FIRST on every mutating path incl. invoice.paid and subscription.canceled — fable re-verified
CONFIRMED-FIXED; the false "subscription refund is a credits no-op" claim corrected and the actual
behavior pinned by test). The `changeset-prose-adr` gate rule surfaced this sitting: ADR citations
are BANNED in changeset bodies (they ship into buyer CHANGELOGs) — three #162 changesets and the
#165 changeset were reworded; internal tracker ids likewise swept from shipped source.

**New pre-launch surfaces executed (operator-approved):**

- **CF-Access e2e bypass LIVE:** `caisson-e2e-prober` service token + a `non_identity` Service
  Auth policy added to the `site_gate` Access application (terraform applied, committed 2cbf4441).
  The human email-OTP gate is untouched; bare request 302s to Access login, token headers pass 200.
  Token pair in the operator env file (`CAISSON_E2E_CF_CLIENT_ID`/`_SECRET`).
- **Paddle dunning no-op LIVE-PROVEN:** a sandbox `transaction.payment_failed` simulation delivered
  to the deployed webhook returned 200 `{"ok":true}` — no 5xx retry loop. Finding: dunning/past-due
  event types are not even subscribed on the notification setting (nothing is ever delivered);
  the temporary subscription used for the probe was restored, `traffic_source` left at `all`.
- **Buyer-lifecycle audit (72-agent workflow):** 11 stages mapped, **43 confirmed gaps**
  (3 P0 · 12 P1 · 15 P2 · 12 P3), 17 claims refuted —
  `outputs/archive/research/buyer-lifecycle-map-2026-07-07.md`. G10/G11 were already closed by PR #164.

**Eleventh-sitting picker (all four answered):**

- **License first mint → LOCKED as ADR-0292:** webhook-push at grant (idempotent per
  account+major), purchase email carries the license, admin first-mint lever as rescue.
  Closes lifecycle P0 G1.
- **Subscription management → LOCKED as ADR-0293:** **in-app native build** (operator chose
  against the portal recommendation) — plan-page `owned` from real state, server-side Paddle
  cancel with the webhook staying revoke-truth, in-app invoice history. Closes G13/G14/G26.
- **Chargebacks → LOCKED as ADR-0294:** subscribe + alert-only, no automated revocation. G20.
- **Wave scope → everything code-fixable (33 items)** this sitting, parallel worktree builders.
- **PR #167 ADR-0291 deviation → LOCKED as ADR-0295** (second picker round, same sitting):
  **enforce the mobile-nav repoint** via a NEW dialog-class `Drawer` primitive in ui-pro
  (focus trap, Escape/scrim close, focus-return); marketplace-tabs repoint DROPPED on shape
  grounds (cross-page nav — `role=tablist` would be an anti-pattern; builder + independent
  review agreed). Refines ADR-0291. Session rules also tightened by the operator: **no fable
  reviewers for the remainder** (opus at SHIP even on money seams), sonnet for bounded
  implementation dispatches, forks continue via picker.
- **Drawer mechanism re-locked as ADR-0296** (third picker round, 2026-07-08): the delta review
  of the built ui-pro Drawer surfaced that `aria-modal` without `inert` leaves the background
  reachable to iOS VoiceOver, AND that the open `@caisson/ui` Dialog already ships
  `variant="drawer"` with native `showModal()` (free inert/trap/scroll-lock). Operator chose
  **reuse the open Dialog** — mobile-nav repoints to it, the hand-rolled ui-pro Drawer is
  deleted before #167 merges. Supersedes 0295's mechanism; the repoint enforcement stands.

**Sitting CLOSED 2026-07-08 — 13-PR wave ALL MERGED** (every PR through the in-session
SHIP-audit lane, findings fixed in-branch or documented deferred): #165 marketplace media
standard (ADR-0290) · #166 CAISSON-43 RAG content gap · #167 UI interactive primitives — 6 open

- 3 ui-pro, hand-rolled (ADR-0291, deviation resolved via 0295→0296: mobile-nav rides the open
  Dialog `variant="drawer"`, ui-pro Drawer deleted pre-merge) · #168/#174 the PGlite 30s-timeout
  fix then the 35-file repo-wide sweep (the CI flake class killed structurally) · #169
  create-caisson delivery-path P0 cluster (npmrc-redot, resolve-index, turbo inputs) · #170
  Playwright prod-route live harness (found real prod defects → Linear CAISSON-50 login
  hydration High / CAISSON-51 CF beacon Low) · #171 support-surface wave (ask-AI escalation
  `POST /escalate`, rate-limit lane, role picker) · #172 marketing honesty wave · #173 in-app
  subscription management (ADR-0293; merged after an in-flight main-conflict resolve) · #175
  dashboard/cart hardening · #176 admin-ops wave (intel page, first-mint lever, resend-email,
  WORM verify + the review-caught `credit_event` provision-script fix — the ADR-0225
  revoke-preview would 500 in prod without it) · #177 license-lifecycle wave (ADR-0292/0294:
  post-commit first-mint push signing purchased ids only, chargeback subscribe-and-alert with the
  review-caught resend dedupe on the stable transaction id, webhook never-5xx hardening; merged
  after a money-seam conflict resolve that folded #173's order/subscription writes INSIDE the
  idempotency callbacks). Earlier same sitting: #162 priority-support SKU wire-up (ADR-0288) ·
  #163 deploy-reliability (CAISSON-37/38/41) · #164 clawback/coverage-mirror races · the
  CF-Access service-token bypass for the e2e prober. Post-wave hygiene: 11 agent worktrees
  removed, local branches pruned, build-state counts regenerated, sot green.

## Closed by the 2026-07-08 twelfth-sitting picker (post-deploy fix wave)

Asked mid-fix-wave at the operator's request (the wave's PRs #178-#184 in flight). Quant
status checked live at ask time: frame test 26/60 complete, Van Westendorp 21/60 — both
recruits active.

- **D2/D3 bundle pricing → HOLD RE-AFFIRMED (checked, kept).** Both Cookiy quant legs still
  filling; the pricing picker fires when they mature. The Paddle production catalog stays
  chained behind it.
- **EULA continuity final wording → POLISH PASS, THEN RE-PRESENT.** The pass ran in-session
  (PAL leg blocked on OpenRouter credit exhaustion — top-up is operator-owed); five proposed
  edits landed in `outputs/specs/research-response/eula-continuity-polish-2026-07-08.md`
  (§365(n) successor language the highest-value one). Variant A + N=12 stay locked (ADR-0282);
  the operator approves the final text before it ships.
- **Design-partner first-N terms → LOCKED as ADR-0297**: 5 partners · 40% off · 12-month
  reverting discount · case-study rights contingent on conversion (candidate A at the
  comparables mid-point). Executes ADR-0273; no longer waits on the production flip.
- **Stray support-bot Railway domain → DELETION APPROVED + EXECUTED** (the accidental
  `caisson-support-bot-production.up.railway.app` created by the legacy `railway domain`
  list-creates behavior is gone).
- **Comparison-pages drafting → GREENLIT, found ALREADY SHIPPED.** The dispatch discovered the
  full 20-page compare family merged 2026-07-07 (`apps/site/lib/comparisons.ts` + `/compare/`);
  the memo's one genuine delta (a live-verified multi-tenant cost-study fact, two PAL-caught
  overclaims fixed) sits on branch `feat/comparison-pages` awaiting operator review per the
  gw-gtm-copywriter stops-at-branch rule.
- **CAISSON-25 first-cycle race → LEFT OPEN** (not ticked): the disposition (accept-as-bounded
  vs build the tombstone/liveness fix) stays an open fork; the residual's recovery path is the
  manual admin revoke lever — there is no automatic reconcile job.
- **three.js signature slot → QUEUED as a design-track kickoff** (not ticked as keep-parked):
  moves off "design bandwidth someday" onto the kickoff queue; ADR-0104's blank slot holds
  until that kickoff runs.

**Wave CLOSED same sitting — all seven PRs #178–#184 MERGED**, every review finding fixed
in-branch pre-merge (two opus money/data-seam reviews PASS, two sonnet reviews PASS). Three CI
failure classes unmasked en route each got a structural fix on main: the standards-gate
pre-install Bun-auto-install roulette (install-first, #183), the audit-harness bin-target
mode-flip reading as a phantom changed-package in the changeset gate (executable bit committed),
and the apps-are-changeset-covered convention (#184's missing changeset added — builders assume
apps are exempt; they are not).

## 2026-07-09 Kickoff-H platform-hardening — fork round 1 (operator-locked)

Session `feat/platform-hardening` (worktree; sibling `KICKOFF-G` owns buyer surface). W1–W4
research fanned out (13 agents) then this first fork round. Four locks:

- **Parked-bucket re-triage → CONFIRM all 13** (operator-ordered). 12 rows verified as the
  kickoff verdict table states; no revisit trigger fired since 2026-07-06. The 13th ("Real media
  on module depth pages") was a filing slip — correctly PULLED to Kickoff-G but still physically
  in `outstanding-work.md` §3; removed from §3 this session. First-cycle credit race (CAISSON-25)
  stays PARTIAL→W3: accept-vs-build fork stays open, the two code residuals ride W3.
- **Support-SKU `creditsPerCycle` → 1000 (Developer parity)** — resolves the ADR-0288 rider (b)
  owed number. Schema forbids 0; the SKU's real value is the support lane, but parity with the
  $499 Developer grant reads clean and avoids the stingy-optics of 100-next-to-1000 on a pricing
  page. Wired in W3 (`packages/pricebook/src/plans.ts` priority_support row). **ADR-0301** (filed at W3 SHIP).
- **External uptime monitor → Better Stack Free ($0)** — 10 monitors / 3-min checks / native
  Slack+email; defers spend. Discord/Telegram reach needs a small webhook-shape adapter (handled
  in W2). Ruled out: UptimeRobot free (2024 ToS bars commercial use). Points at `caisson.sh` +
  license `/health` — operator-signup checkpoint in W2.
- **Read-only mutation gate → ADMIN LEVER ONLY, no dunning freeze** — wire `assertNotReadOnly`
  to a manual maintenance/incident switch (doubles as the W2 incident-runbook tool); do NOT
  freeze writes on `subscription.past_due`. Rationale: Paddle's own docs recommend `past_due →
Full access` (grace) and caisson already ships exactly that (deliberately-unhandled past_due,
  only `canceled` revokes) — a dunning freeze would be a new caisson-specific policy contradicting
  both. Closes CAISSON-58's useful half; the dunning-freeze half is dropped as won't-fix (correct
  per Paddle). **ADR-0300** (filed at W3 SHIP).

Fork round 2 (changeset-cut timing · strix round-2 scope/engine + the missing E2E CF-Access
bypass creds · CAISSON-25 residual disposition · pg-boss alert routing) follows before the
gated builds; the fully-unblocked wave items build in parallel worktree workflows after.

### Fork round 2 (operator-locked, same session)

- **Strix round-2 → FULL authed-live; operator provisions creds first.** Engine defaults to the
  ChatGPT-sub bridge (gpt-5.5-class, matches round-1). BLOCKER surfaced as an operator checkpoint:
  add `CAISSON_E2E_CF_CLIENT_ID`/`CAISSON_E2E_CF_CLIENT_SECRET` to `~/.gridwork/caisson.env` (the
  CF-Access service-token that lets the tool through the pre-launch gate) + add the E2E identity to
  admin's GitHub-OAuth allowlist (`ADMIN_GITHUB_ALLOWED_USER_IDS`) + `codex login --device-auth` +
  the `chatgpt-bridge serve` daemon. Until then: white-box + Worker/support-bot black-box can run;
  authed buyer/owner/seat + admin sessions wait. W1 rate-limit / free-floor / SHA-pins proceed
  regardless.
- **Changeset cut → SCHEDULE its own sitting.** W4 does NOT `changeset version` this session (the
  4 concurrent waves keep adding changesets). Deferred to a dedicated release act; tracked in
  `outstanding-work.md` §1. W4 this session = eval widening + live-harness re-run only.
- **CAISSON-25 → BUILD BOTH residuals.** (a) static-grant ordering-race liveness fix (cancel
  tombstone / grant-time liveness check) AND (b) subscription-payment-refund → coverage-horizon
  rollback. (b) REVERSES the ADR-0269 D6 accept lock → **ADR-0302** (superseding ADR filed at W3 SHIP).
  Both are money-seam → fable implementation + opus review + fable security verdict.
- **Alert routing → ADD a Discord webhook adapter, unify in Discord.** pg-boss failure alerts get
  a new `createDiscordChannel` in `@caisson/alerting` (SSRF-guarded, embed shape) → the caisson
  support Discord `#ops-alerts`; the Better Stack uptime monitor's webhook is reshaped to Discord
  embed format by a small adapter. Operator checkpoint: create the Discord webhook + set its URL.

All forks now closed; the fully-unblocked wave items build in parallel worktree workflows, money
seams on the fable lane with opus review. Operator checkpoints (strix creds · Railway PITR · Grafana
contact point + 4 rules · Better Stack signup · Discord `#ops-alerts` webhook) run alongside.

_Note (merge reconcile): H's three ADRs were drafted 0298-0300 on the branch and renumbered to
**0300-0302** at merge per ADR-0088 — Kickoff-G's 0298/0299 reached main first. The refs above
carry the final numbers._

## Closed by the 2026-07-09 Kickoff-G fork rounds (operator-locked → ADR-0298)

Kickoff G (buyer-surface remediation, `feat/surface-remediation` session; sibling H owns
platform hardening) ran W1–W4 research first — recon verified every defect citation, refero
supplied pattern evidence, exa-code/exa the fumadocs-Shiki root cause and email-client
dark-mode matrix — then locked **twelve forks in three AskUserQuestion rounds**, all recorded
in **ADR-0298**: footer single-column stack <480px · `.cs-matrix` fixed table layout ·
contained-scroll mobile matrices (sticky first column) · single shared migration list
(prod-canonical names) + drift test · topbar pill truncate + drawer sign-out · ai-keys
entitlement gate + upsell · authored SVG diagrams ×8 (Remotion excluded per ADR-0290) ·
metadata-first popout with bounded code region · carousel code-slide dropped (WR-03 pattern) ·
docs FULL sweep ~26 pages · email hybrid dark-mode (invert-safe palette + authored dark CSS) ·
docs sidebar/pagination P3s ride W4.

Held checkpoints (NOT covered by merge-when-green): the EULA credit-clause **wording**
(CAISSON-61) needs operator approval before the W2 merge; the live migration apply for
`0020–0022` stays the operator-gated DEPLOY checkpoint in W5 (0006–0009 bless pattern).

## Closed by the 2026-07-09 post-audit residual round (operator-locked → ADR-0299)

After Kickoff G closed (0 P0 / 0 buyer-visible P1 on G-owned surfaces), the residual board's
four design calls went to the operator in one AskUserQuestion round, all recorded in
**ADR-0299**: the sitewide barred zero → a Mona-Sans U+0030 unicode-range patch face composed
ahead of Hubot (body font NOT swapped) · the 11 "still expanding" docs hedges → full
source-grounded API-reference expansion, callouts deleted · both P3 cosmetics fixed now
(compare 3-column Detail-half split; diagram chrome bar → short `<slug>.svg` label, caption
stays the one visible narration) · the design-bandwidth remainder (three.js signature slot,
bespoke module media) → one Kickoff-I design-track spec drafted next, operator locks scope
before build. The same sitting root-fixed CAISSON-50/51 at the Cloudflare zone (the RUM
injection ruleset's `enabled=false` — `auto_install=false` alone was proven insufficient;
terraform pins both, PR #195) and armed the prod client env for Turnstile + dashboard PostHog
(build ARGs + PostHog CSP origins, PR #195).

## Closed by the 2026-07-10 Kickoff-J pricing picker (operator-locked → ADR-0304/0305)

The D2/D3 pricing picker ran per the Kickoff-J charter on qual(final) + frame test + ladder —
the off-ICP quant panel can never validate the anchor, so waiting for 60/60 bought precision on
the wrong population. `gw-pricing-analyst` produced the WTP memo
(`outputs/research/wtp-memo-2026-07-10.md`; never sets a price); the seat-band comparables were
re-verified live mid-sitting (Supastarter $349/1-seat · $799/5-seat · $1,499/10-seat current;
MakerKit's stale "$599 Team" figure corrected to a $349-headline + Teams-tier shape).

- **D3 anchor level → HOLD Compliance $1,049 / Everything $2,059** → **ADR-0304**. A
  "don't-touch-on-this-evidence" lock, not a proven-number lock. Named reopeners: real-ICP
  anchor reactions (study `019f4a11` / design partners) · live checkout-funnel data · a
  code-ownership competitor at parity.
- **D2 seat posture → premise CORRECTED, then closed** → **ADR-0305**. The shipped EULA is
  already per-org/unlimited-authorized-personnel — no seat concept exists in Caisson's license;
  SYNTHESIS §2's "single-seat bundles" described display silence, not terms. Seat allowance is
  void (the license already exceeds a 5-seat grant); one advantage-copy line ("licensed per
  organization — your whole team, no per-seat pricing") rides the CAISSON-75/77 copy pass.
- **F3 (à-la-carte price-high-steer-to-bundle) and F4 (40%/X9 renewal + $499/yr Developer)**
  re-affirmed unchanged on the memo's convergence table — no new ADR; existing locks stand.
  F4 is the memo's strongest qual×quant convergence; residual work is 12-month-cliff copy only.
- **VW-recruit reallocation fork → RESOLVED: let 445432 fill** (all 60 completes were already
  bought — sunk and API-irreducible) **+ a NEW real-ICP live-interview study LAUNCHED**: Cookiy
  study `019f4a11-8029-7726-ab71-aef06ac4dcae`, 12 qualitative recruits at $119.88 (Stripe
  off-session auto top-up $111.83, operator-approved), 4-gate screener (producer-only · buying
  influence · regulated surface · TS/Node), discovery hard-capped at 4 min, pricing section
  mandatory — the instrument that closes the "no real ICP buyer has ever seen the price" gap.
  Frame-test recruit 776545 lets fill (the within-subject leg works as designed; 39/60).
- **Market-intel triage (5 tickets):** CAISSON-75 Delve copy (accepted, →High, scoped
  copywriter brief) · CAISSON-79 EU-AI-Act hook (accepted, due 2026-08-02, closing window) ·
  CAISSON-77 MCP reframe (accepted, scoped brief) · CAISSON-76 AuditKit parity (accepted,
  analysis lane) · CAISSON-78 Microsoft watch (deferred, trigger-parked). Copy builds ride the
  next site sitting.
- **Design-partner execution (ADR-0297):** partner-facing terms one-pager + ranked outreach
  shortlist landed (`docs/gtm/design-partner-program.md` · `docs/gtm/design-partner-outreach.md`
  over the 30-row research `outputs/research/design-partner-candidates-2026-07-10.md`); the
  outreach itself stays an operator GTM act.

**Operator residue from the round:** the live study's guide retains a stale "single-seat"
phrase in two spots (the terms-section script + one question) — the Cookiy MCP guide-patch API
rejected every edit shape tried. 2-minute hand-edit in the console
(`s.cookiy.ai/console/study/019f4a11-8029-7726-ab71-aef06ac4dcae?tab=study`): replace the
script bullet "Some mid-tier bundles are priced $629–$739 as single-seat licenses" with "Every
bundle is licensed per organization — everyone the company authorizes can work with the code;
competitors at similar prices sell 5-seat licenses", and the question "How do you react to
$629–$739 bundles being single-seat licenses?" with "Mid-tier bundles at $629–$739 are licensed
per organization — your whole team can work with the code — while competitors at similar prices
sell 5-seat licenses. How does that land for you?"; also bump interview duration 15→30 min if
the console exposes it. One in-flight interview may carry the stale premise — discount its seat
answer at synthesis.
