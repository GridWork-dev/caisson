---
task: CAISSON-76
updated: 2026-07-10
scope: feature-for-feature parity — AuditKit.dev vs Caisson (@caisson/audit-worm + Compliance bundle)
note: NO pricing recommendations. Pricing anchor is locked (ADR-0304) and owned by gw-pricing-analyst.
      Prices below are cited FACTS (published competitor price, Caisson's already-locked catalog
      price) for parity/GTM context only — not a proposal to change either.
sources:
  - https://auditkit.dev (crawl4ai md, 2026-07-10)
  - https://auditkit.dev/soc-2 (crawl4ai md, 2026-07-10)
  - https://auditkit.dev/docs (crawl4ai md, 2026-07-10)
  - https://github.com/AuditKitDev/auditkit (crawl4ai md, 2026-07-10 — README + repo metadata)
  - repo: packages/audit-worm, packages/compliance, packages/compliance-core, packages/frameworks-pack,
    packages/signing-primitive, packages/field-crypto, packages/tenancy-rls, packages/retention-runner,
    packages/alerting, registry/index.json, registry/scripts/build-evidence-pack.ts,
    knowledge/decisions/ADR-0275*, ADR-0277*, ADR-0279*, docs/gtm/comparison-targets.md
---

# AuditKit.dev vs Caisson — parity table + gap list

## 0. What AuditKit actually is (framing, not a claim)

AuditKit is a **hybrid** of two things Caisson keeps separate: (a) a hosted audit-log-as-a-service
SDK (`@auditkit/sdk` — TS/Python/Go/Java, tamper-evident hash-chained events, an embeddable React
viewer, a managed API) and (b) a SOC-2-prep GRC-lite layered on top (Evidence Vault, Control
Catalog, 15 Policy Templates, Access Reviews, Vendor Tracking, Risk Register, Auditor
Collaboration Portal). It is AGPLv3 core + a commercial-license-gated `/ee` directory + a managed
cloud (`$99–$999+/mo`, published pricing, auditkit.dev, crawled 2026-07-10). Company facts: repo
`AuditKitDev/auditkit`, 2 stars, 3 contributors, v1.3.0 latest release (14 May 2026), TypeScript
94.6% (github.com/AuditKitDev/auditkit, crawled 2026-07-10) — a young, small-team product, not an
established incumbent like Vanta/Drata (per `docs/gtm/comparison-targets.md` Group B).

Caisson's closest surface is `@caisson/audit-worm` (the WORM chain primitive) composed into the
**Compliance bundle** (`@caisson/compliance` + `compliance-core` + `frameworks-pack` +
`signing-primitive` + `field-crypto` + `tenancy-rls` + `alerting` + `retention-runner`) —
source-owned infrastructure a buyer licenses once and runs in their own stack, not a subscription
platform they log into.

## 1. Side-by-side parity table

| Capability                                      | AuditKit                                                                                                                                         | Caisson                                                                                                                                                                                                                                                                                                                                           | Verdict                                                                                                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tamper-evident audit log                        | SHA-256 hash chain, per event (auditkit.dev, docs)                                                                                               | SHA-256 append-only chain, kernel `chainEntry`/`canonicalize` (`packages/audit-worm/src/chain-store.ts`)                                                                                                                                                                                                                                          | parity                                                                                                                                                                                                                     |
| Tamper-detection scope                          | Chain-break detection (docs: `verifyChain` → `brokenLinks`)                                                                                      | Interior tamper, mid-chain insert/reorder/drop, wholesale rewrite (bad tip vs anchor), **and tail truncation** — the WORM anchor is a trusted length oracle a truncated DB can't produce (`chain-store.ts` `verify()`)                                                                                                                            | caisson-ahead (documented truncation-detection is a named invariant with its own test class; AuditKit's docs don't describe a truncation guard, only chain-break)                                                          |
| Cryptographic root-of-trust                     | In-DB hash chain (their `/v1/verify` reads the DB's own chain state)                                                                             | **External WORM anchor** — every append mints a length-keyed, write-once object in S3 Object-Lock/GCS/R2/local, so the trusted tip lives outside the mutable DB (`store.ts`, `chain-store.ts`)                                                                                                                                                    | caisson-ahead (a DB-only chain can't detect an admin who rewrites the DB itself; an anchor stored write-once outside the DB can)                                                                                           |
| Batch/Merkle proof verification                 | Merkle tree proofs — **Business tier ($499/mo) and up only** (auditkit.dev pricing cards)                                                        | Not implemented — anchor verification is per-tenant chain replay, not a Merkle batch proof                                                                                                                                                                                                                                                        | GAP (AuditKit)                                                                                                                                                                                                             |
| Evidence/artifact signing                       | Ed25519 digital signatures "on every upload" (auditkit.dev /soc-2)                                                                               | Ed25519 detached signature over the canonical evidence-pack manifest + **optional RFC-3161 trusted-timestamp countersignature** (`packages/signing-primitive/README.md`)                                                                                                                                                                          | caisson-ahead (adds an independent timestamp authority; AuditKit doesn't mention one)                                                                                                                                      |
| Embeddable audit-log UI                         | `<AuditKitViewer>` React component, JWT-token-scoped, fetches from their hosted API (auditkit.dev/docs)                                          | `ChainViewer` React component — **headless, data-in**: no DB connection, no fetch, host owns data-fetching and the client boundary (`packages/audit-worm/src/ui/chain-viewer.tsx`)                                                                                                                                                                | different-class (AuditKit's is a wired, hosted-backend component; Caisson's is a presentational primitive a buyer wires to their own backend — fits the "own the code" model)                                              |
| Multi-tenant isolation                          | "Row-level tenant isolation" + JWT-scoped access tokens (auditkit.dev homepage) — enforcement layer not disclosed                                | Postgres **FORCE ROW LEVEL SECURITY**, fail-closed (a query that forgets `WHERE account_id=` denies rather than widens) — DB-enforced, not app-layer (`packages/tenancy-rls/README.md`)                                                                                                                                                           | different-class / probable caisson-ahead (Caisson's mechanism is named and testable; AuditKit's internals aren't public — no overclaim either way)                                                                         |
| Field-level encryption at rest                  | Not offered                                                                                                                                      | Per-tenant AES-256-GCM, HKDF-derived keys, row-bound AAD, key-version rotation, pluggable KMS (AWS/GCP wired) (`packages/field-crypto/README.md`)                                                                                                                                                                                                 | different-class (AuditKit hashes for tamper-evidence; it doesn't encrypt evidence content)                                                                                                                                 |
| Right-to-erasure / crypto-shred                 | Not offered                                                                                                                                      | `retention-runner` (pluggable multi-store erasure, CCPA/GDPR) + `field-crypto` crypto-shred (irreversible per-subject key destruction)                                                                                                                                                                                                            | different-class                                                                                                                                                                                                            |
| SOC 2 control catalog                           | 51 pre-built controls, all 9 Common Criteria + optional TSC (auditkit.dev, /soc-2)                                                               | Own-authored `soc2Tsc` framework pack, clean-room (no SCF ingest) (`packages/frameworks-pack/README.md`) — control _count_ not surfaced in this scrape                                                                                                                                                                                            | parity-ish (AuditKit publishes a control count; Caisson's catalog exists but this research didn't find a published control count to compare 1:1)                                                                           |
| Named-regime crosswalk (SOC 2 / PCI-DSS / GDPR) | SOC 2 control catalog only; no PCI-DSS/GDPR crosswalk found                                                                                      | 19-row crosswalk across SOC 2 (6), PCI-DSS (6), GDPR (7), each row typed `implements`/`maps-to` with a mandatory `buyerResponsibility` column (`packages/frameworks-pack/src/crosswalks/regimes.ts`, ADR-0277/0279)                                                                                                                               | caisson-ahead                                                                                                                                                                                                              |
| Claim-language discipline                       | Marketing copy asserts controls are "ready"/mapped; no visible proof-linkage per claim                                                           | `claim: "implements"` is a discriminated-union type that **will not compile** without a `proof` pointer to a real test/CI job/OSCAL check; unproven rows are mechanically forced to `"maps-to"` (ADR-0279, `regime-crosswalk.ts`)                                                                                                                 | caisson-ahead (structural, not stylistic, honesty guarantee)                                                                                                                                                               |
| Machine-readable compliance export              | PDF, CSV, JSON, OCSF, CEF (auditkit.dev FAQ)                                                                                                     | **OSCAL v1.2.2** (NIST schema) — SAR + POA&M export, JSON→XML round-trip, schema-validated against the real NIST schema by `oscal-cli` in CI (`registry/scripts/build-evidence-pack.ts`, `.github/workflows/ci.yml` job `oscal-conformance`)                                                                                                      | caisson-ahead (OSCAL is the federal/enterprise-GRC-tooling-interop format; AuditKit's export set is document/SIEM-oriented, not OSCAL)                                                                                     |
| Evidence-generation posture                     | Manual: upload → SHA-256 hash → tag to a control (auditkit.dev "Evidence Vault")                                                                 | **Automated, deterministic, byte-stable.** Declarative collectors run against live system state; identical evidence canonicalizes to identical bytes (golden-file-checkable); generation **hard-refuses** when any control's evidence is unresolved — "flag, never guess" (`packages/compliance/README.md`, `packages/compliance-core/README.md`) | caisson-ahead (AuditKit's vault still requires a human to gather and upload the artifact; Caisson's collectors derive evidence from the system itself)                                                                     |
| Build-provenance evidence pack                  | Not offered (their evidence is about the _buyer's_ system, not about AuditKit's own build)                                                       | Per-commit CI-generated pack: standards-gate output, registry-index byte-identity proof, full test-suite + OSCAL-conformance CI-job references, all SHA-256-hashed and Zod-validated, tied to the exact commit SHA + CI run URL (ADR-0275, `registry/scripts/build-evidence-pack.ts`)                                                             | different-class (this proves _Caisson's own supply chain_, not a buyer's controls — a category AuditKit doesn't address at all)                                                                                            |
| Access review campaigns                         | Quarterly campaigns, reviewer assignment, approve/revoke tracking — **Pro tier ($299/mo) and up** (auditkit.dev pricing)                         | Not offered                                                                                                                                                                                                                                                                                                                                       | GAP (Caisson)                                                                                                                                                                                                              |
| Vendor tracking                                 | Vendor inventory, SOC 2 report tracking, DPA storage, expiration alerts — **Pro tier and up**                                                    | Not offered                                                                                                                                                                                                                                                                                                                                       | GAP (Caisson)                                                                                                                                                                                                              |
| Risk register (general security)                | Likelihood/impact scoring, treatment plans, owner assignment — **Pro tier and up**                                                               | Only a _scoped_ EU-AI-Act risk register (Art. 9 risk-management evidence collector — assessed+mitigated flag, not a general scoring tool) (`packages/compliance-core/src/evidence/collectors/ai-risk-register.ts`)                                                                                                                                | GAP (Caisson) — partial: the AI-specific version exists, the general one doesn't                                                                                                                                           |
| Policy templates                                | 15 pre-written security policies, employee acknowledgment tracking (auditkit.dev)                                                                | Not offered                                                                                                                                                                                                                                                                                                                                       | GAP (Caisson)                                                                                                                                                                                                              |
| Auditor collaboration portal                    | Multi-user portal — **Business tier ($499/mo) and up**                                                                                           | Not offered (Caisson ships a downloadable evidence pack instead of a hosted portal)                                                                                                                                                                                                                                                               | GAP (Caisson) — different delivery model, see §2                                                                                                                                                                           |
| Trust center (public security page)             | **Business tier and up**                                                                                                                         | Not offered                                                                                                                                                                                                                                                                                                                                       | GAP (Caisson)                                                                                                                                                                                                              |
| Personnel tracker                               | **Business tier and up**                                                                                                                         | Not offered                                                                                                                                                                                                                                                                                                                                       | GAP (Caisson)                                                                                                                                                                                                              |
| SIEM streaming (Splunk/Datadog/Elastic)         | Native connectors — **Pro tier and up**                                                                                                          | `alerting` package has a generic `AlertChannel` port with Email/Webhook(+HMAC)/Slack/Telegram drivers, no named SIEM connector (`packages/alerting/README.md`)                                                                                                                                                                                    | GAP (Caisson) — the port exists, the SIEM-specific drivers don't                                                                                                                                                           |
| AI anomaly detection                            | "AI anomaly detection" flags suspicious patterns (auditkit.dev — mechanism undisclosed)                                                          | Not offered — the codebase's evidence engine is explicitly deterministic/flag-never-guess, in tension with an ML-based "maybe" signal                                                                                                                                                                                                             | GAP (Caisson), but philosophically adjacent — see §2                                                                                                                                                                       |
| Multi-language client SDKs                      | TypeScript, Python, Go, Java (github.com/AuditKitDev/auditkit)                                                                                   | TypeScript/Bun only                                                                                                                                                                                                                                                                                                                               | GAP (Caisson)                                                                                                                                                                                                              |
| Self-host vs. owned-source                      | AGPLv3 core self-hostable via Docker Compose; **the differentiated features live in `/ee`, which "requires a commercial license"** (repo README) | Apache-2.0 base substrate; Compliance bundle is `LicenseRef-Caisson-Commercial`, source shipped in full, owned outright after purchase                                                                                                                                                                                                            | different-class (AuditKit's "self-hostable" claim doesn't include its Business/Supersize-tier features unless you also buy a commercial `/ee` license; Caisson ships the whole Compliance bundle's source for one license) |
| Pricing model                                   | Subscription, event-volume-metered: $99–$999+/mo published (auditkit.dev, crawled 2026-07-10)                                                    | One-time bundle license, `@caisson/compliance` v0.5.0 = **$1,049** (`registry/index.json`, `priceCents: 104900`) — not volume-metered                                                                                                                                                                                                             | different-class (fact only — see pricing note in frontmatter)                                                                                                                                                              |
| GDPR/CCPA erasure automation                    | Not offered                                                                                                                                      | `retention-runner`: pluggable multi-store erasure, per-target error isolation, reason-tagged audit row, scheduled `auto_90d` sweep                                                                                                                                                                                                                | different-class                                                                                                                                                                                                            |

## 2. GAP list — AuditKit capabilities Caisson lacks

For each: what it is, whether it fits Caisson's owned-code-module model, and a backlog verdict.

### Access review campaigns

**What:** scheduled (quarterly) reviews where a reviewer is assigned a user list, approves/revokes
access, and the decision is logged (auditkit.dev "Access Reviews", Pro tier).
**Fit:** partial. It's a workflow (scheduling + assignment + a decision UI), not a technical
control by itself — but Caisson already has the underlying primitives (`tenancy-rls` for the user
scope, `retention-runner`'s scheduling pattern via `@caisson/jobs`, `audit-worm` for the decision
record). A thin package composing those three is plausible, not a stretch.
**Verdict: build-candidate** — moderate effort, reuses existing patterns (the `retention-runner`
scheduled-task shape is a close template), no new architectural surface.

### Vendor tracking

**What:** a vendor inventory with SOC 2 report tracking, DPA storage, risk tiers, expiration
alerts (auditkit.dev "Vendor Tracking", Pro tier).
**Fit:** weak. This is largely CRUD (a vendor list + dates + reminders) with no distinctive
technical-control content — it's closer to a lightweight CRM than a security primitive. It could
ride on `alerting` for the expiration reminders, but the vendor-record data model itself doesn't
showcase anything Caisson's architecture is built to prove.
**Verdict: watch** — low technical differentiation for the engineering cost; revisit if buyer
demand signal (Cookiy/Linear) actually names it.

### Risk register (general security)

**What:** risks with likelihood/impact scoring, treatment plans, owner assignment, connected to
anomaly detection (auditkit.dev "Risk Register", Pro tier).
**Fit:** good, partially proven. Caisson already ships a scoped version of exactly this shape —
`ai-risk-register.ts` (assessed/mitigated flags per entry, EU AI Act Art. 9) — the general-purpose
data model (risk id, subject, assessed, mitigated/scored) generalizes cleanly; the collector
pattern (fail-closed, `unresolved`/`flagged`/`pass`) is the same discipline the rest of
`compliance-core` uses.
**Verdict: build-candidate** — the EU-AI-Act version is a working proof of the pattern; the
generalization is mostly widening the schema and adding likelihood/impact fields, not new
architecture.

### Auditor collaboration portal

**What:** a hosted multi-user surface where the buyer's auditor logs in, comments, requests
evidence, and tracks status (auditkit.dev "Auditor Collaboration Portal", Business tier).
**Fit:** poor. This is a hosted-SaaS workflow feature — live collaboration, external-user invites,
notification threads — fundamentally at odds with Caisson's "buyer owns the source, runs it in
their own stack" model. There's no natural package boundary for "a portal Caisson would host."
**Verdict: wrong-class.** Caisson's honest substitute is the downloadable, versioned evidence pack
(ADR-0275) handed directly to the auditor/reviewer — a different delivery shape for the same
underlying need ("give the auditor what they need without a screenshot scramble"), not a portal.

### Policy templates

**What:** 15 pre-written security policies (Acceptable Use, Incident Response, etc.) with
employee-acknowledgment tracking (auditkit.dev, /soc-2).
**Fit:** good, and cheap. These are prose/legal documents, not code — a `policies/` markdown
bundle shipped alongside the Compliance bundle is a content task, not an engineering one. The
acknowledgment-tracking half could reuse `alerting` (reminder) + a simple audit-worm-logged
acknowledgment event.
**Verdict: build-candidate** — the lowest-effort gap to close; content authoring, not new
primitives. (The Cookiy corpus behind ADR-0275/0277 already flagged policy-template demand.)

### Trust center / personnel tracker

**What:** a public-facing security-posture page for the buyer's own customers, and an
employee-roster + training-tracking module (auditkit.dev, Business tier).
**Fit:** poor for both — hosted-page and HR-adjacent data tracking, neither has a natural home in
a composable code-library model.
**Verdict: wrong-class** for personnel tracker (HR data, not a technical control). **Watch** for
trust center — a buyer could plausibly hand-build one FROM the evidence pack Caisson already
generates; that's a positioning angle more than a backlog item.

### SIEM streaming (named connectors)

**What:** push events to Splunk, Datadog, S3 in real time (auditkit.dev, Pro tier).
**Fit:** good. `alerting`'s `AlertChannel` port already isolates transport from pipeline logic
(dedup/rate-cap/quiet-hours) — adding `createSplunkChannel`/`createDatadogChannel` drivers is the
same shape as the existing Slack/Telegram/Webhook drivers, not a new abstraction.
**Verdict: build-candidate** — low incremental effort given the port already exists.

### AI anomaly detection

**What:** ML-based flagging of suspicious event patterns (auditkit.dev; mechanism not disclosed).
**Fit:** philosophically in tension with the codebase's evidence-engine posture: `compliance-core`
is explicitly deterministic and "flag, never guess" — a probabilistic ML signal is a different
kind of claim than the rest of the evidence pack makes.
**Verdict: watch** — a rule-based (non-"AI") anomaly heuristic is a plausible cheaper substitute
if demand is real; a genuine ML feature would need its own honesty-posture decision first.

### Multi-language client SDKs (Python/Go/Java)

**What:** native SDKs beyond the primary language (github.com/AuditKitDev/auditkit).
**Fit:** moderate — `audit-worm` is TS/Bun by design (composed with the rest of the base
substrate); a non-TS buyer would need a thin REST/gRPC front rather than a full port.
**Verdict: watch** — no signal yet that Caisson buyers run non-TS backends against this surface;
revisit if it comes up in a real deal.

## 3. Caisson-ahead list — comparison-page ammunition (every claim cited + dated)

1. **Tail-truncation detection.** Caisson's WORM anchor is a trusted length oracle stored
   write-once _outside_ the mutable DB — a truncated chain has an anchor for a length it can no
   longer produce. `packages/audit-worm/src/chain-store.ts` `verify()`, 2026-07-10.
2. **External root-of-trust.** The anchor lives in S3 Object-Lock/GCS/R2, not inside the same DB
   the chain rows live in — an admin who rewrites the DB directly still can't produce a matching
   anchor. `packages/audit-worm/src/store.ts` + `chain-store.ts`, 2026-07-10.
3. **Field-level encryption + crypto-shred.** Per-tenant AEAD keys (HKDF-derived, zero
   infra), row-bound AAD, and an irreversible per-subject crypto-shred erasure primitive —
   AuditKit's public surface has no equivalent (it hash-chains events, it doesn't encrypt evidence
   content). `packages/field-crypto/README.md`, 2026-07-10.
4. **Deterministic, byte-stable evidence generation that refuses to guess.** Evidence-pack
   generation hard-blocks when any control's evidence is unresolved; the pack body canonicalizes
   to identical bytes for identical evidence (golden-file-testable). AuditKit's Evidence Vault is
   manual upload-and-hash. `packages/compliance/README.md`, `packages/compliance-core/README.md`,
   2026-07-10.
5. **OSCAL v1.2.2 (NIST) export, schema-validated in CI.** SAR + POA&M export, JSON→XML
   round-trip, validated by `oscal-cli` against the real NIST schema on every push/PR — a format
   AuditKit's export list (PDF/CSV/JSON/OCSF/CEF) doesn't include.
   `registry/scripts/build-evidence-pack.ts` (`oscal-conformance` job reference), 2026-07-10.
6. **Named-regime crosswalks with structural honesty.** 19 rows across SOC 2/PCI-DSS/GDPR; an
   `"implements"` claim is a TypeScript discriminated union that won't compile without a linkable
   `proof` pointer to a real test/CI job — not a copywriting convention.
   `packages/frameworks-pack/src/crosswalks/regime-crosswalk.ts`, ADR-0277/ADR-0279, 2026-07-10.
7. **Per-commit build-provenance evidence pack.** A CI-generated, SHA-256-hashed, Zod-validated
   pack proving _Caisson's own_ supply chain (standards gate, registry-index byte-identity, full
   test suite, OSCAL conformance) at an exact commit — a category AuditKit's evidence model
   (about the buyer's system, not the vendor's) doesn't address. ADR-0275,
   `registry/scripts/build-evidence-pack.ts`, 2026-07-10.
8. **GDPR/CCPA erasure automation.** A pluggable multi-store erasure runner with per-target error
   isolation and a scheduled `auto_90d` sweep — no equivalent found on AuditKit's public surface.
   `packages/retention-runner/README.md`, 2026-07-10.
9. **RFC-3161 trusted-timestamp option on top of Ed25519 signing.** AuditKit signs evidence with
   Ed25519 only (auditkit.dev/soc-2); Caisson's `signing-primitive` adds an optional independent
   timestamp-authority countersignature. `packages/signing-primitive/README.md`, 2026-07-10.
10. **Fail-closed, DB-enforced tenant isolation.** Postgres `FORCE ROW LEVEL SECURITY` — a query
    that forgets its tenant filter denies rather than widens. AuditKit documents "row-level tenant
    isolation" without naming an enforcement mechanism. `packages/tenancy-rls/README.md`,
    auditkit.dev homepage, both 2026-07-10.
11. **Source ownership, no `/ee` split.** AuditKit's Merkle proofs, SSO/SCIM, GraphQL API, and
    auditor portal require _either_ the managed cloud _or_ a separate commercial license for the
    `/ee` directory even when self-hosting the AGPLv3 core (github.com/AuditKitDev/auditkit README,
    "The `/ee` directory requires a commercial license," 2026-07-10). Caisson's Compliance bundle
    ships its full source for one purchase.

## 4. "Own vs rent" — comparison-page input (6–8 rows, dated, no invented numbers)

For a future `Caisson vs AuditKit` page (`docs/gtm/comparison-targets.md` conventions — honest
trade-offs, cited claims, PAL-challenged before publish, operator publishes):

1. **Pricing shape.** AuditKit: subscription, event-volume-metered, published $99–$999+/mo
   (auditkit.dev pricing cards, crawled 2026-07-10; note the homepage FAQ text quotes different,
   lower figures — $39/$99/$349/mo — than the pricing cards on the same page, an inconsistency
   observed as-is, not reconciled by this research). Caisson: `@caisson/compliance` bundle is a
   one-time $1,049 license (`registry/index.json` v0.5.0, `priceCents: 104900`), not metered by
   event volume.
2. **What "self-hostable" actually includes.** AuditKit's AGPLv3 core is self-hostable via Docker
   Compose, but its higher-tier features (Merkle proofs, SSO/SCIM, GraphQL API, auditor portal)
   sit in `/ee`, which "requires a commercial license" even for self-hosters (repo README,
   2026-07-10). Caisson's Compliance bundle ships its entire feature set as source for one
   purchase — no second gate behind a subscription tier.
3. **Evidence: gathered vs generated.** AuditKit's Evidence Vault is upload-then-hash — a human
   still gathers the screenshot/export/document (auditkit.dev/soc-2: "Evidence Collection ...
   consumes 60-70% of total compliance effort," their own copy). Caisson's evidence pack is
   generated by collectors running against live system state and hard-refuses to ship an
   incomplete pack rather than guess (`packages/compliance/README.md`, 2026-07-10).
4. **Data protection depth.** Caisson field-encrypts sensitive columns at rest (per-tenant AEAD
   keys, row-bound AAD) with a crypto-shred erasure primitive; AuditKit hash-chains audit _events_
   for tamper-evidence but doesn't encrypt evidence content or offer subject erasure
   (`packages/field-crypto/README.md`, auditkit.dev, both 2026-07-10 — genuinely different
   problems; don't overclaim AuditKit "lacks" what it never claimed to do).
5. **Export format.** Caisson exports OSCAL v1.2.2 (NIST-schema-validated in CI); AuditKit exports
   PDF/CSV/JSON plus OCSF/CEF (auditkit.dev FAQ, 2026-07-10) — OSCAL targets federal/enterprise
   GRC tooling interop, OCSF/CEF targets SIEM ingestion; different downstream consumers, name both
   honestly rather than declaring one "better."
6. **Claim posture as a structural guarantee.** Caisson's crosswalk rows can't claim "implements"
   without a linkable proof — enforced by the type system, not a style guide (ADR-0279). This is a
   genuine, citable engineering difference in how claims are made, independent of feature parity.
7. **Company maturity signal (handle carefully).** AuditKit: 2 GitHub stars, 3 contributors,
   latest release v1.3.0 (14 May 2026) (github.com/AuditKitDev/auditkit, crawled 2026-07-10) — a
   young product. Cite this factually if used; don't frame it as a knock, since Caisson's own
   public GitHub presence (`caisson-sh/caisson-oss`) is also early per the repo's own history.
8. **Delivery model for the auditor.** AuditKit sells access to a portal the buyer's auditor logs
   into (Business tier). Caisson hands the buyer a versioned, signed, downloadable evidence pack
   (ADR-0275) with no third-party login required — a genuinely different distribution shape for
   the same "give the auditor what they need" job, worth stating as a trade-off rather than a win.

## Gaps in this research

- AuditKit's exact SOC-2 control-catalog count is published (51); this research did not find a
  published control count for Caisson's `soc2Tsc` pack to compare 1:1 — flagged in §1 rather than
  guessed.
- AuditKit's tenant-isolation enforcement mechanism (RLS vs. app-layer filtering) isn't disclosed
  in public docs/marketing — the comparison in §1/§3 is stated as "undisclosed," not assumed weaker.
- Did not create an AuditKit trial account; all AuditKit claims are from public marketing/docs/repo
  content only, dated 2026-07-10 (their internal `COMPETITIVE-INTELLIGENCE.md` /
  `SOC2-MARKET-RESEARCH.md` repo files exist but weren't fetched — out of scope for a parity table
  built from their public-facing claims).
