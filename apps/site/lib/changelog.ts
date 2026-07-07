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
