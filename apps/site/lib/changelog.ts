// Shared release entries — consumed by both the /updates page and the RSS 2.0 feed.
// Entries are newest-first; dates in ISO 8601 (YYYY-MM-DD).
// This is the single source of truth: add a new entry here and it appears on both surfaces.

export interface ChangelogEntry {
  readonly slug: string;
  /** ISO 8601 date string, YYYY-MM-DD. */
  readonly date: string;
  /** Optional semver label shown as a chip. */
  readonly version?: string;
  readonly title: string;
  /** One-paragraph body in plain prose. No HTML — both the page and the RSS feed consume it. */
  readonly body: string;
  /** Short tag tokens for the chip row. */
  readonly tags?: readonly string[];
}

export const CHANGELOG_ENTRIES: readonly ChangelogEntry[] = [
  {
    slug: "kernel-browser-safe-v0-6",
    date: "2026-07-30",
    version: "v0.6",
    title:
      "The kernel's main entry is browser-safe; refunds now net against upgrade credit",
    body: "@caisson-sh/kernel reaches 0.7.0 and its main entry no longer reaches a Node built-in, so packages built on it — the trust-page generator and the artifact renderer among them — can be imported directly into a browser bundle. Everything that needs Node moved to a new @caisson-sh/kernel/node entry point: constant-time secret comparison, audit-chain hashing, migration assembly, and the SSRF guard. That entry re-exports the main one in full, so server code that uses a moved function changes one import path and keeps the rest of its import list; nothing changed about what any of them do. If you import verifyChain, safeEqualFixed, assembleMigrations, or any of the SSRF helpers, point that import at @caisson-sh/kernel/node — type-only imports need no change. Separately, a partial refund now reduces what a purchase counts as paid, so an upgrade quote credits what you were actually charged rather than the original amount, and a refund notice that names the same purchased line twice is rejected outright instead of being half-applied. The reference compliance pack gains a fourth control, risk identification and assessment, evidenced by a traversal of a scored AI risk register. @caisson-sh/frameworks-pack gains a @caisson-sh/frameworks-pack/registry entry point exposing the control model on its own. Full per-module detail ships in each package's changelog.",
    tags: ["kernel", "browser-safe", "billing", "compliance", "release"],
  },
  {
    slug: "oscal-spine-v0-5",
    date: "2026-07-28",
    version: "v0.5",
    title:
      "oscal-spine ships as its own module; field-crypto moves to scoped key operations",
    body: "The OSCAL surface — catalog loading, profile resolution, and component-definition assembly — moves out of the bundles it was embedded in and ships as @caisson-sh/oscal-spine, installable on its own and included for Compliance and Everything buyers. field-crypto changes shape underneath: key material now lives in a request-scoped context that is provisioned when the context binds and zeroized when it unbinds, and callers borrow a key for the length of one operation instead of receiving one to hold. A key-management adapter for Azure Key Vault and an immutable-storage adapter for Azure Blob are available for deployments that want the key or the archive outside the application. Background jobs gain an Inngest v4 driver alongside the existing Trigger.dev, pg-boss, BullMQ, and in-memory ones. Current prices for every module and bundle are on the marketplace page.",
    tags: ["oscal-spine", "field-crypto", "catalog", "release"],
  },
  {
    slug: "catalog-release-v0-4",
    date: "2026-07-12",
    version: "v0.4",
    title:
      "Catalog-wide release: kernel 0.4.3, installable-version guarantee, lifecycle emails",
    body: "A coordinated release across the whole module catalog. The registry now enforces an installable-version guarantee: every advertised version of every module resolves to a downloadable, hash-verified tarball, checked in CI before anything ships. Purchases and renewals send lifecycle confirmation emails. The kernel reaches 0.4.3, project templates track it, the support bot's answer quality is regression-gated against a recorded baseline, and modules across the catalog pick up hardening and fixes. Full per-module details ship in each package's changelog.",
    tags: ["kernel", "registry", "release"],
  },
  {
    slug: "base-substrate-v0-3",
    date: "2026-06-27",
    version: "v0.3",
    title: "Base substrate: RLS, field-crypto, audit chain, create-caisson",
    body: "The Caisson base substrate is available. Ships: fail-closed Postgres RLS (FORCE-enabled, cross-tenant isolation CI-tested), per-tenant AES-256-GCM field encryption (HKDF-SHA256 key derivation, one key per tenant), an append-only SHA-256 audit chain via kernel verifyChain, auth and billing primitives, and the create-caisson generator. Start with bunx @caisson-sh/cli@latest.",
    tags: ["substrate", "rls", "field-crypto", "audit-chain", "create-caisson"],
  },
  {
    slug: "field-crypto-v0-2",
    date: "2026-06-10",
    version: "v0.2",
    title:
      "field-crypto: per-tenant AES-256-GCM encryption at the column level",
    body: "field-crypto ships as part of the base substrate. Per-tenant encryption keys derived via HKDF-SHA256, AES-256-GCM authenticated encryption, and a key-derivation layer that scopes each tenant's key material to their row context. No plaintext key material in the application layer. Covers HIPAA §164.312(a)(2)(iv) (encryption and decryption).",
    tags: ["field-crypto", "substrate"],
  },
  {
    slug: "kernel-registry-v0-1",
    date: "2026-05-15",
    version: "v0.1",
    title: "Kernel, registry runtime, and fail-closed RLS: initial release",
    body: "The Caisson kernel and registry runtime are available. The kernel provides verifyChain (append-only SHA-256 audit chain), tenant context primitives, and fail-closed RLS helpers. The registry exposes typed module definitions for every bundle. Fail-closed Postgres RLS (FORCE-enabled, cross-tenant isolation tested in CI) is available in the base substrate.",
    tags: ["kernel", "registry", "rls"],
  },
] as const;

export const FEED_TITLE = "Caisson updates";
export const FEED_DESCRIPTION =
  "Compliance-grade infrastructure updates: new modules, control mappings, and framework coverage.";
export const FEED_URL = "https://caisson.sh/updates";
export const FEED_RSS_URL = "https://caisson.sh/updates/rss.xml";
