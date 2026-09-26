// Module golden suite (ADR-0021 §golden / ADR-0013 golden-first). Declares the DETERMINISTIC output
// @caisson-sh/local-store pins: the fused RRF ranking for a FIXED (vectors, FTS docs, query) input
// (RRF_K=60). The fixture lives in `src/__golden__` (the manifest `golden` dir) and is re-blessed via
// `BLESS=1` only when the output legitimately changes. Golden-first: the fixture is authored, and its
// assertions land, before the retrieval logic that turns them green.
import { defineModuleGolden } from "@caisson-sh/testing/golden-module";
import { scrubForEgress } from "./embed-scrub-guard.ts";
import { LocalStore } from "./store.ts";
import type { HybridSearchOptions, StoreDoc } from "./store.ts";

/** The fixed corpus + query the golden pins. */
interface RrfFixture {
  dim: number;
  docs: StoreDoc[];
  query: HybridSearchOptions;
}

/**
 * A fixed corpus + query chosen so the RRF *fusion* is observable (not a single-leg echo):
 *  - `fox`        tops BOTH legs          → ranks #1
 *  - `fox-quick`  last in vec, top in FTS → fused up to #2 (the FTS leg rescues a vec-weak doc)
 *  - `lazy-fox`   mid in both legs        → #3
 *  - `canine`     #2 in vec, NO FTS hit   → drops to #4 (a strong single-leg doc loses to hybrids)
 * Deterministic: the vec0 L2 KNN order and the FTS5 bm25 order are fixed for this input — no clock,
 * randomness, or env. The embedding is pre-computed here (the injected seam), never modeled live.
 */
const RRF_FIXTURE: RrfFixture = {
  dim: 3,
  docs: [
    { id: "fox", text: "fox", embedding: [1, 0, 0] },
    { id: "fox-quick", text: "fox fox fox quick", embedding: [0, 1, 0] },
    {
      id: "canine",
      text: "canine animal companion",
      embedding: [0.95, 0.05, 0],
    },
    { id: "lazy-fox", text: "the lazy fox", embedding: [0, 0, 0.8] },
  ],
  query: { queryText: "fox", queryVector: [1, 0, 0], limit: 10 },
};

// ── Egress secret-scrub golden (golden-first for the egress guard) ─────────────────────────────────
// The local store's embedder PORT (ADR-0067) is the one path that can carry buyer content OFF the box
// (to a cloud embedder). Before any such egress the egress guard MUST scrub credential-bearing
// content. This fixture PINS that guard's contract — a table of credential-bearing `raw` inputs → the
// exact `scrubbed` output the guard must produce — and lands BEFORE the logic (ADR-0013 golden-first).
//
// Why this case `produce` echoes the authored contract instead of calling the guard: at authoring
// time the guard (`src/embed-scrub-guard.ts`) did not exist yet, so importing it would have made the suite
// fail to RESOLVE (a broken tree), not assert a contract. The fixture committed green first
// ("passes-on-fixture"); the guard implementation then rewrote this `produce` body to
// `scrubForEgress(c.raw)`, and the committed `scrub.json` enforces — BLESS unset — that the real guard
// reproduces this table byte-for-byte. So the EXPECTED outputs below ARE the guard's spec, authored
// deterministically.
//
// The contract the `scrubbed` values encode (the algorithm the guard implements), applied in order, each
// secret span collapsing to the fixed sentinel `[REDACTED]` (a constant — no entropy is ever echoed):
//   A. PEM private-key block  (`-----BEGIN … PRIVATE KEY----- … -----END … PRIVATE KEY-----`) → `[REDACTED]`.
//   B. URL userinfo password  (`scheme://user:pass@host`)                                     → `scheme://user:[REDACTED]@host` (user kept, password dropped).
//   C. Secret-named assignment(`<key><=|: ><value>` where key matches the secret-name set)    → `<key><sep>[REDACTED]` (whole value dropped).
//      secret-name set (case-insensitive substring): api[_-]?key · secret · token · password ·
//      passwd · pwd · authorization · bearer · access[_-]?key · private[_-]?key.
//   D. Known inline token shape (no key=value context): AWS access-key id `AKIA[0-9A-Z]{16}`,
//      GitHub `ghp_…`/`github_pat_…`, OpenAI `sk-…`, JWT `eyJ….….…`                          → `[REDACTED]`.
// Non-secret text passes through unchanged (clean-passthrough case).

/** One scrub contract row: a credential-bearing input and the exact scrubbed output the guard owes. */
interface ScrubCase {
  /** Stable case label (which rule it exercises). */
  name: string;
  /** Credential-bearing input — synthetic, non-live secrets (safe to commit). */
  raw: string;
  /** The deterministic scrubbed output the egress guard must reproduce for `raw`. */
  scrubbed: string;
}

/** The fixed scrub contract table the golden pins. */
interface ScrubFixture {
  /** The single redaction sentinel every secret span collapses to (constant — never leaks entropy). */
  redaction: string;
  cases: ScrubCase[];
}

const SCRUB_FIXTURE: ScrubFixture = {
  redaction: "[REDACTED]",
  cases: [
    // C — secret-named env assignment; the OpenAI key value is dropped whole.
    {
      name: "env-assignment-api-key",
      raw: "OPENAI_API_KEY=sk-proj-AAAABBBBCCCCDDDDEEEEFFFF",
      scrubbed: "OPENAI_API_KEY=[REDACTED]",
    },
    // C — secret-named YAML-style assignment (`: ` separator); a GitHub PAT value dropped whole.
    {
      name: "assignment-auth-token",
      raw: "auth_token: ghp_0123456789ABCDEFabcdef0123456789ABCD",
      scrubbed: "auth_token: [REDACTED]",
    },
    // D — inline AWS access-key id with no key=value context (AWS's documented EXAMPLE id).
    {
      name: "inline-aws-access-key",
      raw: "Rotate AKIAIOSFODNN7EXAMPLE before the audit.",
      scrubbed: "Rotate [REDACTED] before the audit.",
    },
    // B — URL userinfo: the password is dropped, the username + host/port/path are kept.
    {
      name: "url-userinfo-password",
      raw: "DATABASE_URL=postgres://app:s3cr3t-p4ss@db.example.com:5432/main",
      scrubbed:
        "DATABASE_URL=postgres://app:[REDACTED]@db.example.com:5432/main",
    },
    // A — a whole PEM private-key block collapses to the sentinel.
    {
      name: "pem-private-key-block",
      raw: "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAFAKEKEYMATERIAL\nnotarealkeyjustafixture\n-----END RSA PRIVATE KEY-----",
      scrubbed: "[REDACTED]",
    },
    // D — inline JWT bounded by ordinary words; only the token span is replaced.
    {
      name: "inline-jwt",
      raw: "The session cookie was eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abcDEF123-_ which expired.",
      scrubbed: "The session cookie was [REDACTED] which expired.",
    },
    // Non-secret content is never altered (no false-positive redaction).
    {
      name: "clean-passthrough",
      raw: "Refactor the RRF ranker so the FTS leg rescues a vec-weak doc.",
      scrubbed:
        "Refactor the RRF ranker so the FTS leg rescues a vec-weak doc.",
    },
  ],
};

export const localStoreGolden = defineModuleGolden({
  module: "@caisson-sh/local-store",
  goldenDir: "src/__golden__",
  cases: [
    {
      name: "rrf-ranking",
      input: RRF_FIXTURE,
      produce: (input) => {
        const fixture = input as RrfFixture;
        const store = LocalStore.open({ dim: fixture.dim });
        try {
          for (const doc of fixture.docs) store.upsert(doc);
          return store.hybridSearch(fixture.query).map((hit, i) => ({
            rank: i + 1,
            id: hit.id,
            score: Number(hit.score.toFixed(6)),
          }));
        } finally {
          store.close();
        }
      },
    },
    {
      // The fixture, now ENFORCED by the real egress guard (golden-first, ADR-0013): `produce` runs each
      // `raw` through `scrubForEgress`, and the committed `scrub.json` asserts — BLESS unset — that the
      // guard reproduces the authored input→output contract byte-for-byte.
      name: "scrub",
      input: SCRUB_FIXTURE,
      produce: (input) => {
        const fixture = input as ScrubFixture;
        return fixture.cases.map((c) => ({
          name: c.name,
          raw: c.raw,
          scrubbed: scrubForEgress(c.raw),
        }));
      },
    },
  ],
});
