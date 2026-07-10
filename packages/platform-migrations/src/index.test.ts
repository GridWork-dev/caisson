// Chain-equality proof: `PLATFORM_MIGRATIONS_DIGEST` below was computed by running
// `assembleMigrations([platformPackage()]).schemaVersion` against the PRE-EXTRACTION
// apps/site/lib/deploy-migrate.ts (the sole owner before this package existed) — the kernel's
// `schemaVersion` is a sha256 chained over every migration's filename + content checksum in order
// (packages/kernel/src/migration-assembly.ts), so ANY reordering or byte-level content drift
// changes it. Reassembling the chain's PRE-EXTRACTION MEMBERSHIP (filtered by name — the shared
// chain has since grown by legitimate appends, which must never invalidate this proof) plus the two
// apps/site-local `ask_ai_*` entries and re-checking that digest is the load-bearing proof that the
// extraction moved bytes, not migrations.
import { expect, test } from "bun:test";
import { assembleMigrations } from "@caisson/kernel";
import { platformMigrationsPackage } from "./index.ts";

/** The two apps/site-local migrations `platformMigrationsPackage`'s `extra` param folds back in —
 *  copied verbatim, byte-for-byte, from apps/site/lib/ask-ai/{spend,question-log}.ts (not imported:
 *  this package cannot depend "up" on apps/site) so this test can reconstruct the FULL pre-extraction
 *  chain and check it against the pinned digest below. */
const ASK_AI_SPEND_SCHEMA_SQL = `
CREATE TABLE ask_ai_spend (
  day        date NOT NULL,
  lane       text NOT NULL,
  micro_usd  bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (day, lane)
);
`;
const ASK_AI_QUESTION_SCHEMA_SQL = `
CREATE TABLE ask_ai_question (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  lane       text NOT NULL,
  question   text NOT NULL,
  outcome    text NOT NULL
);
CREATE INDEX ask_ai_question_created_at_idx ON ask_ai_question (created_at);
`;

/** Pinned from the pre-extraction `assembleMigrations([platformPackage()])` — see module doc. */
const PRE_EXTRACTION_SCHEMA_VERSION =
  "ea27055fcd3f40485789306e5b64d15e96e7e7a482793099bc881bf4ccbb5882";

const PRE_EXTRACTION_FILENAMES = [
  "0001_app_role.sql",
  "0002_credits.sql",
  "0003_entitlement_grant.sql",
  "0004_license_grant.sql",
  "0005_ai_meter.sql",
  "0006_account_member.sql",
  "0007_credit_rounding.sql",
  "0008_entitlement_line_item.sql",
  "0009_credit_line_item.sql",
  "0010_billing_processed_event.sql",
  "0011_ask_ai_spend.sql",
  "0012_ask_ai_question.sql",
  "0013_rls_empty_guc_guard.sql",
  "0014_credit_expiry.sql",
  "0015_grant_consumption.sql",
  "0016_entitlement_updates_window.sql",
  "0017_renewal_extension.sql",
  "0018_subscription_status.sql",
  "0019_order_record.sql",
];

test("the chain's pre-extraction membership + the two site-local ask_ai_* entries reassemble to the EXACT pre-extraction chain (byte-identical)", () => {
  const pkg = platformMigrationsPackage([
    { name: "0011_ask_ai_spend.sql", sql: ASK_AI_SPEND_SCHEMA_SQL },
    { name: "0012_ask_ai_question.sql", sql: ASK_AI_QUESTION_SCHEMA_SQL },
  ]);
  // Filter to the pre-extraction membership: the shared chain has grown by append since the
  // extraction (0023_order_record_subscription_link and on) — appends land AFTER 0019 by
  // sort-by-filename, so the historical prefix's bytes/order/checksums are untouched and this
  // proof stays valid by filtering, never by re-pinning the digest.
  const preExtraction = {
    ...pkg,
    migrations: pkg.migrations.filter((m) =>
      PRE_EXTRACTION_FILENAMES.includes(m.name),
    ),
  };
  const assembly = assembleMigrations([preExtraction]);

  expect(assembly.sequence.map((m) => m.filename)).toEqual(
    PRE_EXTRACTION_FILENAMES,
  );
  expect(assembly.schemaVersion).toBe(PRE_EXTRACTION_SCHEMA_VERSION);
});

test("platformMigrationsPackage() with no extra applies the shared chain (everything but the two site-local ask_ai_* entries)", () => {
  const assembly = assembleMigrations([platformMigrationsPackage()]);
  // `assembleMigrations` renumbers `filename` contiguously from the merged position (seq), not the
  // original per-migration name — so with the two ask_ai_* entries absent, everything from the old
  // 0013 on shifts down two. `sourceName` still carries the ORIGINAL name unchanged, which is the
  // byte-identity that matters (proven against the pinned digest in the test above).
  expect(assembly.sequence.map((m) => m.sourceName)).toEqual([
    ...PRE_EXTRACTION_FILENAMES.filter(
      (f) => f !== "0011_ask_ai_spend.sql" && f !== "0012_ask_ai_question.sql",
    ),
    "0023_order_record_subscription_link.sql",
    "0024_checkout_abandonment.sql",
  ]);
  expect(assembly.sequence.map((m) => m.filename)).toEqual([
    "0001_app_role.sql",
    "0002_credits.sql",
    "0003_entitlement_grant.sql",
    "0004_license_grant.sql",
    "0005_ai_meter.sql",
    "0006_account_member.sql",
    "0007_credit_rounding.sql",
    "0008_entitlement_line_item.sql",
    "0009_credit_line_item.sql",
    "0010_billing_processed_event.sql",
    "0011_rls_empty_guc_guard.sql",
    "0012_credit_expiry.sql",
    "0013_grant_consumption.sql",
    "0014_entitlement_updates_window.sql",
    "0015_renewal_extension.sql",
    "0016_subscription_status.sql",
    "0017_order_record.sql",
    "0018_order_record_subscription_link.sql",
    "0019_checkout_abandonment.sql",
  ]);
});

test("the assembly is deterministic — a re-run is byte-identical", () => {
  const a = assembleMigrations([platformMigrationsPackage()]);
  const b = assembleMigrations([platformMigrationsPackage()]);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});
