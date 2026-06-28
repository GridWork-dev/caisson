// Shared changelog entries — consumed by both the /changelog page and the RSS 2.0 feed.
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
    slug: "evidence-pack-generator-v0-3",
    date: "2026-06-27",
    version: "v0.3",
    title: "Compliance edition: evidence-pack generator",
    body: "The evidence-pack generator ships with the Compliance edition. Pass a control-objective list; get a structured export of RLS policies, Object-Lock configuration, and audit-chain verification output — formatted for an auditor, not a dashboard screenshot. Covers SOC 2 CC6.1/CC7.2 and HIPAA §164.312(a)(1)/(b).",
    tags: ["compliance", "evidence-pack"],
  },
  {
    slug: "field-crypto-module-v0-2",
    date: "2026-06-10",
    version: "v0.2",
    title:
      "field-crypto: per-tenant AES-256-GCM encryption at the column level",
    body: "field-crypto is now available in the Compliance edition. Per-tenant encryption keys, AES-256-GCM authenticated encryption, and a key-derivation layer that scopes each tenant's key material to their row context. No plaintext key material in the application layer. Covers HIPAA §164.312(a)(2)(iv) (encryption and decryption).",
    tags: ["field-crypto", "compliance"],
  },
  {
    slug: "early-access-opens",
    date: "2026-05-15",
    title: "Early access opens",
    body: "Caisson early access is open. The Compliance edition — fail-closed Postgres RLS, S3 Object-Lock WORM storage, an append-only SHA-256 audit chain, and per-tenant field encryption — is available to the first cohort. Request access from the home page. The evidence-pack generator and field-crypto modules ship with the edition.",
    tags: ["launch"],
  },
] as const;

export const FEED_TITLE = "Caisson changelog";
export const FEED_DESCRIPTION =
  "Compliance-grade infrastructure updates: new modules, control mappings, evidence-pack releases, and framework coverage.";
export const FEED_URL = "https://caisson.sh/changelog";
export const FEED_RSS_URL = "https://caisson.sh/changelog/rss.xml";
