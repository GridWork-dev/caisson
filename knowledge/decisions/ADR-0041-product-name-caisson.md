# ADR-0041 — Product name: Caisson

Status: accepted · 2026-06-27 (positioning session — operator-locked). Closes the "real product
name" fork. Supersedes the working name **`stack` / `@stack/*`** and the placeholder **`Forge`**.

The product is named **Caisson**. Package scope is **`@caisson/*`**.

Rationale: a _caisson_ is a watertight engineered foundation sunk **under pressure** so everything
built above it holds **under load** — the exact product thesis (compliance-grade infrastructure
that stays correct when audited, metered, and regulated). The register is pro-tool
obscure-but-precise (Tessera / Stripe / Linear class) and matches the locked dark, technical,
evidence-forward design center (`specs/03` §1).

Availability (research 2026-06-27, `outputs/research/` name-availability pass):

- **Collision: LOW** — the only namesakes are offshore/geotechnical foundation-engineering tools in
  an unrelated industry; the dev-tools / security / compliance lane is wide open. Strong trademark
  distinctiveness (vs. the rejected common-word candidates).
- **npm:** the bare `caisson` package is taken (dead legacy pkg); the **`@caisson/*` org scope** is
  the play (same pattern as `@stack/*`). Confirm + claim `@caisson` at npm signup.
- **Domains:** `.com` and `.dev` are registered (true for every dictionary-word candidate). Primary
  is **`caisson.sh`** (available ~$45/yr; the dev-tool TLD convention); fallbacks
  `getcaisson.com` / `caisson.build`.

Sub-brands: the evidence-pack / audit-chain module may carry **Attest** or **Provenance** as a
_feature_ sub-brand (both are dead as company marks — askattest.com, Provenance Blockchain — but
ideal as a module name and reinforce the audit/evidence hero).

Rejected: **Footing** (LOW-MED collision but a common dictionary word → weak trademark, and a niche
Python `footing` tool sits next to our `create-stack` generator); **Plumb** (MED — small AI-workflow
tools useplumb/plumbed.io/dbreunig·plumb); **Bedrock / Keel / Bastion / Substrate / Verity /
Provenance / Bulwark / Attest / Cornerstone** (all HIGH collision _in our exact lane_ — Amazon
Bedrock, keel.sh, verityaml.com "continuous compliance," Parity Substrate, bulwark-security, etc.);
**keep `stack`** (a placeholder that blocks all brand work).

Binding: the package scope is `@caisson/*`; the primary domain is `caisson.sh`. The `specs/*` set
is renamed to Caisson in this session (specs are amendable). Prior `Forge` / `stack` references in
the **append-only** ADR-0001..0012 are **superseded by this ADR**, not edited in place
(append-only invariant, ADR-0002/0006) — read "Forge"/"stack" there as "Caisson." Claim `@caisson`
on npm and register `caisson.sh` before first publish.
